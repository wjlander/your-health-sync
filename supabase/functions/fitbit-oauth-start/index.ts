import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Fitbit OAuth start function called')
    console.log('Request method:', req.method)
    console.log('Request headers:', Object.fromEntries(req.headers.entries()))
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

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

    // Get user from auth header
    console.log('Getting user from auth header...')
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    
    if (authError) {
      console.log('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: `Authentication error: ${authError.message}` }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    if (!user) {
      console.log('No user found')
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('User found:', user.id)

    // Get Fitbit configuration
    console.log('Fetching Fitbit configuration...')
    const { data: config, error: configError } = await supabase
      .from('api_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('service_name', 'fitbit')
      .maybeSingle()

    console.log('Config query error:', configError)
    console.log('Config found:', !!config)
    
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

    if (!config) {
      console.log('No Fitbit configuration found')
      return new Response(
        JSON.stringify({ 
          error: 'No Fitbit configuration found. Please configure Client ID and Redirect URL first.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Config client_id:', !!config.client_id)
    console.log('Config redirect_url:', !!config.redirect_url)

    if (!config.client_id || !config.redirect_url) {
      console.log('Missing required config fields')
      return new Response(
        JSON.stringify({ 
          error: 'Missing Fitbit configuration. Please configure Client ID and Redirect URL first.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Generate state parameter for security
    const state = crypto.randomUUID()
    console.log('Generated state:', state)
    
    // Store state temporarily (in a real app, you'd use a more persistent store)
    // For now, we'll include the user_id in the state to validate later
    const stateData = {
      user_id: user.id,
      timestamp: Date.now()
    }
    
    // Create the authorization URL
    const authUrl = new URL('https://www.fitbit.com/oauth2/authorize')
    authUrl.searchParams.set('client_id', config.client_id)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', config.redirect_url)
    authUrl.searchParams.set('scope', 'activity heartrate location nutrition profile settings sleep social weight')
    authUrl.searchParams.set('state', btoa(JSON.stringify(stateData)))

    console.log('Generated OAuth URL:', authUrl.toString())

    const response = {
      authUrl: authUrl.toString(),
      message: 'Redirect to this URL to authorize Fitbit access'
    }

    console.log('Returning success response:', response)

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error in fitbit-oauth-start function:', error)
    console.error('Error stack:', error.stack)
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