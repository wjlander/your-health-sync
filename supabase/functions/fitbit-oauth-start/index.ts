import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== FITBIT OAUTH START ===')
  console.log('Method:', req.method)
  
  if (req.method === 'OPTIONS') {
    console.log('Returning CORS response')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Processing OAuth start request...')
    
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

    // Get Fitbit configuration from environment secrets
    console.log('Using centralized Fitbit configuration from secrets...')
    const clientId = Deno.env.get('FITBIT_CLIENT_ID')
    const clientSecret = Deno.env.get('FITBIT_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      console.log('Missing Fitbit OAuth configuration in secrets')
      return new Response(
        JSON.stringify({ 
          error: 'Fitbit OAuth configuration not found in system secrets.' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Set redirect URL
    const redirectUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fitbit-oauth-callback`
    
    console.log('Using client_id:', clientId)
    console.log('Using redirect_url:', redirectUrl)

    // Generate state parameter for security
    const stateData = {
      user_id: user.id,
      timestamp: Date.now()
    }
    const state = btoa(JSON.stringify(stateData))
    console.log('Generated state:', state)
    
    // Create the authorization URL with proper parameters
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUrl,
      scope: 'activity heartrate location nutrition profile settings sleep social weight',
      state: state
    })
    
    const authUrl = `https://www.fitbit.com/oauth2/authorize?${params.toString()}`
    console.log('Generated OAuth URL:', authUrl)

    const response = {
      authUrl: authUrl,
      message: 'Redirect to this URL to authorize Fitbit access'
    }

    console.log('Returning success response')

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('=== FUNCTION ERROR ===')
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