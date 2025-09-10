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
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

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
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get Fitbit configuration
    const { data: config, error: configError } = await supabase
      .from('api_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('service_name', 'fitbit')
      .maybeSingle()

    if (configError || !config || !config.client_id || !config.redirect_url) {
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

    return new Response(
      JSON.stringify({ 
        authUrl: authUrl.toString(),
        message: 'Redirect to this URL to authorize Fitbit access'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in fitbit-oauth-start function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})