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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { service } = await req.json()
    console.log('Testing connection for service:', service)

    if (!service) {
      console.log('No service name provided')
      return new Response(
        JSON.stringify({ error: 'Service name is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get the auth header to identify the user
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get user from auth header
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

    console.log('Testing connection for user:', user.id, 'service:', service)

    // Get API configuration for this service and user
    const { data: config, error: configError } = await supabase
      .from('api_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('service_name', service)
      .single()

    if (configError || !config) {
      console.log('Config error:', configError, 'Found config:', !!config)
      return new Response(
        JSON.stringify({ error: `No configuration found for ${service}` }),
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
        testResult = await testAlexaConnection(config)
        break
      default:
        testResult = { success: false, message: `Testing not implemented for ${service}`, data: null }
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
    if (!config.access_token) {
      return { success: false, message: 'No access token found for Fitbit', data: null }
    }

    // Test Fitbit API with user profile endpoint
    const response = await fetch('https://api.fitbit.com/1/user/-/profile.json', {
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Accept': 'application/json'
      }
    })

    if (response.status === 401) {
      // Token might be expired, try to refresh if we have a refresh token
      if (config.refresh_token) {
        const refreshResult = await refreshFitbitToken(config)
        if (refreshResult.success) {
          return { success: true, message: 'Token refreshed and connection successful', data: refreshResult.data }
        } else {
          return { success: false, message: 'Access token expired and refresh failed', data: null }
        }
      } else {
        return { success: false, message: 'Access token expired and no refresh token available', data: null }
      }
    }

    if (!response.ok) {
      return { success: false, message: `Fitbit API error: ${response.status} ${response.statusText}`, data: null }
    }

    const data = await response.json()
    return { 
      success: true, 
      message: 'Fitbit connection successful', 
      data: { 
        user: data.user?.displayName || 'Unknown User',
        memberSince: data.user?.memberSince || 'Unknown'
      } 
    }

  } catch (error) {
    return { success: false, message: `Fitbit connection failed: ${error.message}`, data: null }
  }
}

async function refreshFitbitToken(config: any) {
  try {
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
      throw new Error(`Token refresh failed: ${response.status}`)
    }

    const tokenData = await response.json()
    
    // Update the config with new tokens (this would need to be implemented)
    // For now, just return the success with token data
    return { 
      success: true, 
      data: { 
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || config.refresh_token
      } 
    }

  } catch (error) {
    return { success: false, message: error.message }
  }
}

async function testAlexaConnection(config: any) {
  try {
    if (!config.access_token) {
      return { success: false, message: 'No access token found for Alexa', data: null }
    }

    // Test Alexa API - this would depend on what Alexa endpoints you're using
    // For now, return a placeholder response
    return { 
      success: true, 
      message: 'Alexa connection test not fully implemented yet', 
      data: { status: 'placeholder' } 
    }

  } catch (error) {
    return { success: false, message: `Alexa connection failed: ${error.message}`, data: null }
  }
}