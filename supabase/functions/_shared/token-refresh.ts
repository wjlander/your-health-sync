// Shared Google token refresh utility
export async function refreshGoogleToken(supabase: any, userId: string): Promise<string | null> {
  try {
    console.log('Refreshing Google token for user:', userId)
    
    // Get user's Google configuration
    const { data: config, error: configError } = await supabase
      .from('api_configurations')
      .select('*')
      .eq('user_id', userId)
      .eq('service_name', 'google')
      .single()
      
    if (configError || !config?.refresh_token) {
      console.log('No refresh token found:', configError)
      return null
    }

    // Get client credentials from environment
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const redirectUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-oauth-callback`
    
    if (!clientId || !clientSecret) {
      console.log('Missing Google OAuth configuration')
      return null
    }
    
    // Refresh the access token
    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: config.refresh_token,
        grant_type: 'refresh_token',
        redirect_uri: redirectUrl // Include redirect URI for consistency
      })
    })

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text()
      console.log('Token refresh failed:', refreshResponse.status, errorText)
      
      // If refresh token is invalid, mark as expired
      if (refreshResponse.status === 400) {
        await supabase
          .from('api_configurations')
          .update({
            access_token: null,
            expires_at: new Date().toISOString(), // Mark as expired
            updated_at: new Date().toISOString()
          })
          .eq('id', config.id)
      }
      return null
    }

    const tokenData = await refreshResponse.json()
    console.log('Token refresh successful')

    // Calculate new expiry time
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()

    // Update configuration with new token
    const { error: updateError } = await supabase
      .from('api_configurations')
      .update({
        access_token: tokenData.access_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', config.id)
      
    if (updateError) {
      console.log('Failed to update token:', updateError)
      return null
    }
    
    return tokenData.access_token

  } catch (error) {
    console.error('Error refreshing Google token:', error)
    return null
  }
}

// Helper to check if token needs refresh (with 5 minute buffer)
export function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true
  
  const expiry = new Date(expiresAt)
  const now = new Date()
  const buffer = 5 * 60 * 1000 // 5 minutes in milliseconds
  
  return expiry.getTime() - now.getTime() < buffer
}

// Helper to make authenticated Google API calls with automatic token refresh
export async function makeGoogleApiCall(
  supabase: any,
  userId: string,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get current token
  const { data: config } = await supabase
    .from('api_configurations')
    .select('access_token, expires_at')
    .eq('user_id', userId)
    .eq('service_name', 'google')
    .single()

  let accessToken = config?.access_token

  // Refresh token if expired
  if (!accessToken || isTokenExpired(config?.expires_at)) {
    console.log('Token expired, refreshing...')
    accessToken = await refreshGoogleToken(supabase, userId)
    
    if (!accessToken) {
      throw new Error('Failed to refresh Google access token')
    }
  }

  // Make the API call
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  // If unauthorized, try refreshing once more
  if (response.status === 401) {
    console.log('API call unauthorized, attempting token refresh...')
    accessToken = await refreshGoogleToken(supabase, userId)
    
    if (!accessToken) {
      throw new Error('Failed to refresh Google access token after 401')
    }

    // Retry the API call with new token
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })
  }

  return response
}