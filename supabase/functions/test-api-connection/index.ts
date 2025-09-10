import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Test API Connection function called')
    
    // Get the auth header to identify the user
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      console.log('No authorization header provided')
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Authorization required',
          data: null 
        }),
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

    const { service } = await req.json()
    console.log('Testing connection for service:', service)

    if (!service) {
      console.log('No service name provided')
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Service name is required',
          data: null 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get user from auth header
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      console.log('Auth error:', authError)
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Invalid authorization',
          data: null 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Testing connection for user:', user.id, 'service:', service)

    // Get API configuration for this service and user
    const { data: config, error: configError } = await supabase
      .from('api_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('service_name', service)
      .maybeSingle()

    if (configError) {
      console.log('Config error:', configError)
      return new Response(
        JSON.stringify({ 
          success: false,
          message: `Database error: ${configError.message}`,
          data: null 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!config) {
      console.log('No config found for service:', service)
      return new Response(
        JSON.stringify({ 
          success: false,
          message: `No configuration found for ${service}`,
          data: null 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Found config for', service, 'with access_token:', !!config.access_token)

    // Test connection based on service type
    let testResult = { success: false, message: '', data: null }

    switch (service.toLowerCase()) {
      case 'fitbit':
        testResult = await testFitbitConnection(config)
        break
      case 'alexa':
        testResult = { 
          success: false, 
          message: 'Alexa connection test not implemented yet', 
          data: null 
        }
        break
      case 'google':
        testResult = await testGoogleConnection(config)
        break
      default:
        testResult = { 
          success: false, 
          message: `Testing not implemented for ${service}`, 
          data: null 
        }
    }

    console.log('Test result:', testResult)
    return new Response(
      JSON.stringify(testResult),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in test-api-connection function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || 'Unknown error occurred',
        data: null 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function testFitbitConnection(config: any) {
  try {
    console.log('Testing Fitbit connection...')
    
    if (!config.access_token) {
      return { 
        success: false, 
        message: 'No access token found for Fitbit. Please complete the OAuth flow first.', 
        data: null 
      }
    }

    // Test Fitbit API with user profile endpoint
    console.log('Making request to Fitbit API...')
    const response = await fetch('https://api.fitbit.com/1/user/-/profile.json', {
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Accept': 'application/json'
      }
    })

    console.log('Fitbit API response status:', response.status)

    if (response.status === 401) {
      // Token might be expired, try to refresh if we have a refresh token
      if (config.refresh_token) {
        console.log('Access token expired, attempting to refresh...')
        const refreshResult = await refreshFitbitToken(config)
        if (refreshResult.success) {
          return { 
            success: true, 
            message: 'Token refreshed and connection successful', 
            data: refreshResult.data 
          }
        } else {
          return { 
            success: false, 
            message: 'Access token expired and refresh failed', 
            data: null 
          }
        }
      } else {
        return { 
          success: false, 
          message: 'Access token expired and no refresh token available. Please re-authorize the app.', 
          data: null 
        }
      }
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.log('Fitbit API error response:', errorText)
      return { 
        success: false, 
        message: `Fitbit API error: ${response.status} ${response.statusText}`, 
        data: null 
      }
    }

    const data = await response.json()
    console.log('Fitbit API success, user:', data.user?.displayName)
    
    return { 
      success: true, 
      message: 'Fitbit connection successful', 
      data: { 
        user: data.user?.displayName || 'Unknown User',
        memberSince: data.user?.memberSince || 'Unknown'
      } 
    }

  } catch (error) {
    console.error('Fitbit connection test error:', error)
    return { 
      success: false, 
      message: `Fitbit connection failed: ${error.message}`, 
      data: null 
    }
  }
}

async function testGoogleConnection(config: any) {
  try {
    console.log('Testing Google Calendar connection...')
    
    if (!config.access_token) {
      return { 
        success: false, 
        message: 'No access token found for Google Calendar. Please complete the OAuth flow first.', 
        data: null 
      }
    }

    // Test Google Calendar API with calendar list endpoint
    console.log('Making request to Google Calendar API...')
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Accept': 'application/json'
      }
    })

    console.log('Google Calendar API response status:', response.status)

    if (response.status === 401) {
      return { 
        success: false, 
        message: 'Access token expired. Please re-authorize Google Calendar access.', 
        data: null 
      }
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.log('Google Calendar API error response:', errorText)
      return { 
        success: false, 
        message: `Google Calendar API error: ${response.status} ${response.statusText}`, 
        data: null 
      }
    }

    const data = await response.json()
    console.log('Google Calendar API success, calendars found:', data.items?.length || 0)
    
    return { 
      success: true, 
      message: 'Google Calendar connection successful', 
      data: { 
        calendarsCount: data.items?.length || 0,
        primaryCalendar: data.items?.find((cal: any) => cal.primary)?.summary || 'Unknown'
      } 
    }

  } catch (error) {
    console.error('Google Calendar connection test error:', error)
    return { 
      success: false, 
      message: `Google Calendar connection failed: ${error.message}`, 
      data: null 
    }
  }
}

async function refreshFitbitToken(config: any) {
  try {
    console.log('Attempting to refresh Fitbit token...')
    
    const response = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${config.client_id}:${config.client_secret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: config.refresh_token
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.log('Token refresh failed:', response.status, errorText)
      throw new Error(`Token refresh failed: ${response.status}`)
    }

    const tokenData = await response.json()
    console.log('Token refresh successful')
    
    // Note: In a real implementation, you'd want to update the database with the new tokens
    return { 
      success: true, 
      data: { 
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || config.refresh_token
      } 
    }

  } catch (error) {
    console.error('Token refresh error:', error)
    return { success: false, message: error.message }
  }
}