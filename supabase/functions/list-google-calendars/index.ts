import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== LIST GOOGLE CALENDARS ===')
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

    // Get Google configuration (use user's tokens but display will's credentials)
    console.log('Fetching Google configuration...')
    const { data: config, error: configError } = await supabase
      .from('api_configurations')
      .select('*')
      .eq('user_id', user.id)
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

    console.log('Google configuration found, fetching calendars...')
    
    // Fetch the user's calendar list
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
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
          const newAccessToken = await refreshGoogleToken(supabase, user.id)
          console.log('Token refreshed successfully, retrying calendar fetch...')
          
          // Retry the calendar list request with new token
          const retryResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
            headers: {
              'Authorization': `Bearer ${newAccessToken}`,
              'Accept': 'application/json'
            }
          })
          
          if (retryResponse.ok) {
            const retryData = await retryResponse.json()
            const calendars = (retryData.items || []).map((calendar: any) => ({
              id: calendar.id,
              name: calendar.summary,
              description: calendar.description || null,
              primary: calendar.primary || false,
              accessRole: calendar.accessRole,
              backgroundColor: calendar.backgroundColor || null
            }))
            
            return new Response(
              JSON.stringify({
                success: true,
                data: calendars
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
    console.log('Fetched', calendarData.items?.length || 0, 'calendars')

    // Filter and format calendars for the frontend
    const calendars = (calendarData.items || []).map((calendar: any) => ({
      id: calendar.id,
      name: calendar.summary,
      description: calendar.description || null,
      primary: calendar.primary || false,
      accessRole: calendar.accessRole,
      backgroundColor: calendar.backgroundColor || null
    }))

    return new Response(
      JSON.stringify({
        success: true,
        data: calendars
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('=== LIST CALENDARS ERROR ===')
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