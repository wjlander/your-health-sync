import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { makeGoogleApiCall } from '../_shared/token-refresh.ts'

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

    // Use shared Google configuration from will@w-j-lander.uk
    console.log('Fetching shared Google configuration...')
    const { data: config, error: configError } = await supabase
      .from('api_configurations')
      .select('*')
      .eq('user_id', 'b7318f45-ae52-49f4-9db5-1662096679dd') // will@w-j-lander.uk
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
      console.log('No shared Google configuration found or no access token')
      return new Response(
        JSON.stringify({ 
          error: 'No shared Google configuration found. The administrator (will@w-j-lander.uk) needs to connect Google Calendar first.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Shared Google configuration found, fetching calendars...')
    
    try {
      // Use the shared utility for automatic token refresh with master account
      const calendarResponse = await makeGoogleApiCall(
        supabase,
        'b7318f45-ae52-49f4-9db5-1662096679dd', // Use will@w-j-lander.uk's tokens
        'https://www.googleapis.com/calendar/v3/users/me/calendarList'
      )

      if (!calendarResponse.ok) {
        const errorText = await calendarResponse.text()
        console.log('Google Calendar API error:', calendarResponse.status, errorText)
        
        if (calendarResponse.status === 401) {
          return new Response(
            JSON.stringify({ error: 'Google authorization expired. The administrator needs to reconnect the Google account.' }),
            { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          )
        }
        
        return new Response(
          JSON.stringify({ error: 'Failed to fetch Google calendars' }),
          { status: calendarResponse.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        )
      }

      const calendarData = await calendarResponse.json()
      console.log('Calendar fetch successful')
      
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
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
      
    } catch (error) {
      console.error('Error fetching calendars:', error)
      
      if (error.message.includes('refresh')) {
        return new Response(
          JSON.stringify({ error: 'Google authorization expired. The administrator needs to reconnect the Google account.' }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Google calendars' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

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