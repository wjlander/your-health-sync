import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { makeGoogleApiCall } from '../_shared/token-refresh.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== SYNC GOOGLE CALENDAR ===')
  console.log('Method:', req.method)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get the auth header to identify the user
    const authHeader = req.headers.get('authorization')
    console.log('Auth header present:', !!authHeader)
    
    if (!authHeader) {
      console.log('No authorization header provided')
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create authenticated Supabase client with user's JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    )

    // Get shared calendar settings instead of user-specific selection
    console.log('Fetching shared calendar settings...')
    const { data: calendarSettings } = await supabase
      .from('shared_calendar_settings')
      .select('setting_value')
      .eq('setting_key', 'selected_calendar_id')
      .single()
    
    const selectedCalendarId = calendarSettings?.setting_value ? 
      JSON.parse(calendarSettings.setting_value) : 'primary'

    // Get user from auth header
    console.log('Getting user from auth header...')
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    
    if (authError || !user) {
      console.log('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('User found:', user.id)

    // Get Google configuration from will@w-j-lander.uk (master user)
    console.log('Fetching master Google configuration...')
    const masterUserId = 'b7318f45-ae52-49f4-9db5-1662096679dd' // will@w-j-lander.uk
    
    const { data: config, error: configError } = await supabase
      .from('api_configurations')
      .select('*')
      .eq('user_id', masterUserId)
      .eq('service_name', 'google')
      .maybeSingle()

    if (configError) {
      console.log('Database error:', configError)
      return new Response(
        JSON.stringify({ error: `Database error: ${configError.message}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!config || !config.access_token) {
      console.log('No Google configuration found or no access token')
      return new Response(
        JSON.stringify({ 
          error: 'No Google configuration found or not connected. Please complete the Google OAuth flow first.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Google configuration found, fetching calendar events...')
    
    // Get calendar events from the selected calendar
    const now = new Date()
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${selectedCalendarId}/events?` +
      `timeMin=${now.toISOString()}&` +
      `timeMax=${oneWeekFromNow.toISOString()}&` +
      `singleEvents=true&` +
      `orderBy=startTime&` +
      `maxResults=50`

    console.log('Fetching events from calendar:', selectedCalendarId)
    const response = await fetch(calendarUrl, {
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.log('Google Calendar API error:', response.status, errorText)
      
      if (response.status === 401) {
        console.log('Access token expired, attempting refresh...')
        try {
          const newAccessToken = await refreshGoogleToken(supabase, masterUserId)
          console.log('Token refreshed successfully, retrying calendar sync...')
          
          // Retry the calendar events request with new token
          const retryResponse = await fetch(calendarUrl, {
            headers: {
              'Authorization': `Bearer ${newAccessToken}`,
              'Accept': 'application/json'
            }
          })
          
          if (retryResponse.ok) {
            const calendarData = await retryResponse.json()
            console.log('Fetched', calendarData.items?.length || 0, 'events from Google Calendar')

            // Continue with processing events...
            let newEventsCount = 0
            let updatedEventsCount = 0

            if (calendarData.items && calendarData.items.length > 0) {
              for (const event of calendarData.items) {
                if (!event.start || !event.end) continue // Skip events without times

                const startTime = event.start.dateTime || event.start.date
                const endTime = event.end.dateTime || event.end.date
                
                if (!startTime || !endTime) continue

                // Check if event already exists
                const { data: existingEvent } = await supabase
                  .from('calendar_events')
                  .select('id')
                  .eq('user_id', user.id)
                  .eq('event_id', event.id)
                  .single()

                const eventData = {
                  user_id: user.id,
                  event_id: event.id,
                  title: event.summary || 'Untitled Event',
                  description: event.description || null,
                  start_time: startTime,
                  end_time: endTime,
                  is_health_related: isHealthRelated(event.summary || '', event.description || '')
                }

                if (existingEvent) {
                  // Update existing event
                  const { error: updateError } = await supabase
                    .from('calendar_events')
                    .update(eventData)
                    .eq('id', existingEvent.id)

                  if (!updateError) {
                    updatedEventsCount++
                  }
                } else {
                  // Insert new event
                  const { error: insertError } = await supabase
                    .from('calendar_events')
                    .insert(eventData)

                  if (!insertError) {
                    newEventsCount++
                  }
                }
              }
            }

            return new Response(
              JSON.stringify({
                success: true,
                message: `Calendar sync completed successfully`,
                data: {
                  newEvents: newEventsCount,
                  updatedEvents: updatedEventsCount,
                  totalProcessed: calendarData.items?.length || 0,
                  calendarId: selectedCalendarId
                }
              }),
              { 
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            )
          }
        } catch (refreshError) {
          console.log('Token refresh failed:', refreshError)
        }
        
        return new Response(
          JSON.stringify({ 
            error: 'Google access token expired and refresh failed. Please reconnect your Google account in API settings.' 
          }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          error: `Google Calendar API error: ${response.status} ${response.statusText}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const calendarData = await response.json()
    console.log('Fetched', calendarData.items?.length || 0, 'events from Google Calendar')

    // Process and insert events into our database
    let newEventsCount = 0
    let updatedEventsCount = 0

    if (calendarData.items && calendarData.items.length > 0) {
      for (const event of calendarData.items) {
        if (!event.start || !event.end) continue // Skip events without times

        const startTime = event.start.dateTime || event.start.date
        const endTime = event.end.dateTime || event.end.date
        
        if (!startTime || !endTime) continue

        // Check if event already exists
        const { data: existingEvent } = await supabase
          .from('calendar_events')
          .select('id')
          .eq('user_id', user.id)
          .eq('event_id', event.id)
          .single()

        const eventData = {
          user_id: user.id,
          event_id: event.id,
          title: event.summary || 'Untitled Event',
          description: event.description || null,
          start_time: startTime,
          end_time: endTime,
          is_health_related: isHealthRelated(event.summary || '', event.description || '')
        }

        if (existingEvent) {
          // Update existing event
          const { error: updateError } = await supabase
            .from('calendar_events')
            .update(eventData)
            .eq('id', existingEvent.id)

          if (!updateError) {
            updatedEventsCount++
          }
        } else {
          // Insert new event
          const { error: insertError } = await supabase
            .from('calendar_events')
            .insert(eventData)

          if (!insertError) {
            newEventsCount++
          }
        }
      }
    }

    console.log('Sync completed:', { newEventsCount, updatedEventsCount })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Calendar sync completed successfully`,
        data: {
          newEvents: newEventsCount,
          updatedEvents: updatedEventsCount,
          totalProcessed: calendarData.items?.length || 0,
          calendarId: selectedCalendarId
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('=== SYNC ERROR ===')
    console.error('Error:', error)
    console.error('Stack:', error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: `Server error: ${error.message}`,
        details: error.stack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Helper function to determine if an event is health-related
function isHealthRelated(title: string, description: string): boolean {
  const healthKeywords = [
    'doctor', 'appointment', 'medical', 'health', 'dentist', 'therapy', 'workout', 
    'gym', 'fitness', 'medicine', 'checkup', 'hospital', 'clinic', 'surgery',
    'physical', 'mental health', 'counseling', 'medication', 'treatment',
    'wellness', 'yoga', 'meditation', 'nutrition', 'diet'
  ]
  
  const searchText = `${title} ${description}`.toLowerCase()
  return healthKeywords.some(keyword => searchText.includes(keyword))
}

// Helper function to refresh Google access token
async function refreshGoogleToken(supabase: any, userId: string): Promise<string> {
  console.log('Refreshing Google token for user:', userId)
  
  // Get refresh token from user's config
  const { data: config, error: configError } = await supabase
    .from('api_configurations')
    .select('refresh_token, id')
    .eq('user_id', userId)
    .eq('service_name', 'google')
    .single()
    
  if (configError || !config?.refresh_token) {
    console.log('No refresh token found:', configError)
    throw new Error('No refresh token available. Please re-authorize Google.')
  }

  // Get client credentials from environment secrets
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  
  if (!clientId || !clientSecret) {
    console.log('Missing Google OAuth configuration in secrets')
    throw new Error('Google OAuth configuration not found in system secrets.')
  }
  
  // Refresh the token
  const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: config.refresh_token,
      grant_type: 'refresh_token'
    })
  })
  
  if (!refreshResponse.ok) {
    const errorText = await refreshResponse.text()
    console.log('Token refresh failed:', refreshResponse.status, errorText)
    throw new Error('Failed to refresh Google token. Please re-authorize.')
  }
  
  const tokenData = await refreshResponse.json()
  console.log('Token refresh successful')
  
  // Update the configuration with new token
  const { error: updateError } = await supabase
    .from('api_configurations')
    .update({
      access_token: tokenData.access_token,
      expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', config.id)
    
  if (updateError) {
    console.log('Failed to update token:', updateError)
    throw new Error('Failed to save new token')
  }
  
  return tokenData.access_token
}