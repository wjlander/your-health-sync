import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== GOOGLE OAUTH CALLBACK ===')
  console.log('Method:', req.method)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    console.log('Callback params - code:', !!code, 'state:', !!state, 'error:', error)

    if (error) {
      console.log('OAuth error:', error)
      return new Response(
        `<html><body><h1>Authorization Error</h1><p>Error: ${error}</p><script>window.close();</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    if (!code || !state) {
      console.log('Missing required parameters')
      return new Response(
        '<html><body><h1>Invalid Request</h1><p>Missing authorization code or state</p><script>window.close();</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Decode state to get user info
    let stateData
    try {
      stateData = JSON.parse(atob(state))
      console.log('Decoded state for user:', stateData.user_id)
    } catch (e) {
      console.log('Invalid state parameter')
      return new Response(
        '<html><body><h1>Invalid State</h1><p>Invalid state parameter</p><script>window.close();</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get API credentials from Jayne's configuration (shared credentials)
    const { data: willConfig, error: willConfigError } = await supabase
      .from('api_configurations')
      .select('client_id, client_secret, redirect_url')
      .eq('user_id', '595d5a28-e8dd-4da1-aeae-b6f2c5c478fd')
      .eq('service_name', 'google')
      .single()

    if (willConfigError || !willConfig) {
      console.log('Will\'s config not found:', willConfigError)
      return new Response(
        '<html><body><h1>Configuration Error</h1><p>System configuration not found</p><script>window.close();</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Check if user has their own configuration record, create if not exists
    let { data: userConfig, error: userConfigError } = await supabase
      .from('api_configurations')
      .select('*')
      .eq('user_id', stateData.user_id)
      .eq('service_name', 'google')
      .single()

    if (userConfigError || !userConfig) {
      console.log('Creating new user config record')
      // Create new configuration record for user
      const { data: newConfig, error: createError } = await supabase
        .from('api_configurations')
        .insert({
          user_id: stateData.user_id,
          service_name: 'google',
          client_id: willConfig.client_id,
          client_secret: willConfig.client_secret,
          redirect_url: willConfig.redirect_url,
          is_active: true
        })
        .select()
        .single()

      if (createError) {
        console.log('Failed to create user config:', createError)
        return new Response(
          '<html><body><h1>Configuration Error</h1><p>Failed to create user configuration</p><script>window.close();</script></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        )
      }
      userConfig = newConfig
    }

    // Exchange code for tokens
    console.log('Exchanging code for tokens...')
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: willConfig.client_id,
        client_secret: willConfig.client_secret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: willConfig.redirect_url
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.log('Token exchange failed:', tokenResponse.status, errorText)
      return new Response(
        `<html><body><h1>Token Exchange Failed</h1><p>Failed to exchange code for tokens</p><script>window.close();</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    const tokenData = await tokenResponse.json()
    console.log('Token exchange successful')

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()

    // Update configuration with tokens
    const { error: updateError } = await supabase
      .from('api_configurations')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', userConfig.id)

    if (updateError) {
      console.log('Failed to update configuration:', updateError)
      return new Response(
        '<html><body><h1>Database Error</h1><p>Failed to save tokens</p><script>window.close();</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    console.log('Google Calendar OAuth completed successfully for user:', stateData.user_id)

    return new Response(
      `<html>
        <body>
          <h1>Authorization Successful!</h1>
          <p>Google Calendar access has been granted. You can now close this window.</p>
          <script>
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )

  } catch (error) {
    console.error('=== CALLBACK ERROR ===')
    console.error('Error:', error)
    console.error('Stack:', error.stack)
    
    return new Response(
      `<html><body><h1>Server Error</h1><p>An error occurred: ${error.message}</p><script>window.close();</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }
})