import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== GOOGLE OAUTH START ===')
  console.log('Method:', req.method)
  
  if (req.method === 'OPTIONS') {
    console.log('Returning CORS response')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Processing Google OAuth start request...')
    
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

    // Get Google configuration
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

    if (!config || !config.client_id || !config.client_secret) {
      console.log('No complete Google configuration found')
      return new Response(
        JSON.stringify({ 
          error: 'No Google configuration found. Please save your Google Client ID and Client Secret first.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Set redirect URL if not set
    let redirectUrl = config.redirect_url
    if (!redirectUrl) {
      redirectUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-oauth-callback`
      
      // Update the configuration with the redirect URL
      await supabase
        .from('api_configurations')
        .update({ redirect_url: redirectUrl })
        .eq('id', config.id)
    }

    // Generate OAuth state with user info
    const state = btoa(JSON.stringify({
      user_id: user.id,
      timestamp: Date.now()
    }))

    // Build Google OAuth URL
    const scope = 'openid email profile https://www.googleapis.com/auth/calendar'
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${config.client_id}&` +
      `redirect_uri=${encodeURIComponent(redirectUrl)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${state}`

    console.log('Generated Google auth URL')

    return new Response(
      JSON.stringify({
        authUrl: authUrl,
        message: 'Redirect to this URL to authorize Google Calendar access'
      }),
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