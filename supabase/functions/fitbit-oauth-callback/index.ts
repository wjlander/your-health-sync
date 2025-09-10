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
    console.log('Fitbit OAuth callback function called')
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    if (error) {
      console.log('OAuth error:', error)
      return new Response(
        `<html><body><h1>Authorization Failed</h1><p>Error: ${error}</p><script>window.close();</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    if (!code || !state) {
      return new Response(
        '<html><body><h1>Invalid Request</h1><p>Missing code or state parameter</p><script>window.close();</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Decode and validate state
    let stateData
    try {
      stateData = JSON.parse(atob(state))
    } catch (e) {
      console.log('Invalid state parameter')
      return new Response(
        '<html><body><h1>Invalid State</h1><p>State parameter is invalid</p><script>window.close();</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    const userId = stateData.user_id
    if (!userId) {
      return new Response(
        '<html><body><h1>Invalid State</h1><p>User ID not found in state</p><script>window.close();</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Get user's Fitbit configuration
    const { data: config, error: configError } = await supabaseAdmin
      .from('api_configurations')
      .select('*')
      .eq('user_id', userId)
      .eq('service_name', 'fitbit')
      .single()

    if (configError || !config) {
      console.log('Config not found:', configError)
      return new Response(
        '<html><body><h1>Configuration Error</h1><p>Fitbit configuration not found</p><script>window.close();</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Exchange code for tokens
    console.log('Exchanging code for tokens...')
    const tokenResponse = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${config.client_id}:${config.client_secret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.redirect_url
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.log('Token exchange failed:', tokenResponse.status, errorText)
      return new Response(
        `<html><body><h1>Token Exchange Failed</h1><p>Status: ${tokenResponse.status}</p><p>${errorText}</p><script>window.close();</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    const tokenData = await tokenResponse.json()
    console.log('Token exchange successful')

    // Update the configuration with the new tokens
    const { error: updateError } = await supabaseAdmin
      .from('api_configurations')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', config.id)

    if (updateError) {
      console.log('Database update failed:', updateError)
      return new Response(
        `<html><body><h1>Database Update Failed</h1><p>${updateError.message}</p><script>window.close();</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    console.log('Fitbit OAuth flow completed successfully')

    // Return success page that closes the popup
    return new Response(
      `<html>
        <body>
          <h1>✅ Fitbit Connected Successfully!</h1>
          <p>Your Fitbit account has been connected. You can now close this window.</p>
          <script>
            // Try to close the popup
            if (window.opener) {
              window.opener.postMessage({ type: 'fitbit_oauth_success' }, '*');
              window.close();
            } else {
              // If not in popup, redirect back to app
              setTimeout(() => {
                window.location.href = '${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 'https://health.ringing.org.uk'}';
              }, 2000);
            }
          </script>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )

  } catch (error) {
    console.error('Error in fitbit-oauth-callback function:', error)
    return new Response(
      `<html><body><h1>Server Error</h1><p>${error.message}</p><script>window.close();</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }
})