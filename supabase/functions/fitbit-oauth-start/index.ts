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
    console.log('Handling CORS preflight')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Processing OAuth start request...')
    
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

    if (!config || !config.client_id || !config.redirect_url) {
      console.log('Missing config or required fields')
      console.log('Config:', config)
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

    console.log('Config client_id:', config.client_id)
    console.log('Config redirect_url:', config.redirect_url)

    // Generate state parameter for security
    const stateData = {
      user_id: user.id,
      timestamp: Date.now()
    }
    const state = btoa(JSON.stringify(stateData))
    console.log('Generated state:', state)
    
    // Create the authorization URL with proper parameters
    const params = new URLSearchParams({
      client_id: config.client_id,
      response_type: 'code',
      redirect_uri: config.redirect_url,
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