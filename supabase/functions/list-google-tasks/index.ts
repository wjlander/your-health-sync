import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== LIST GOOGLE TASKS ===')
  console.log('Method:', req.method)
  console.log('Auth header present:', !!req.headers.get('authorization'))
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get the auth header to identify the user
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create authenticated Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    console.log('Getting user from auth header...')
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    
    if (authError || !user) {
      console.log('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User found:', user.id)
    
    console.log('Fetching Google configuration...')
    const { data: googleConfig, error } = await supabase
      .from('api_configurations')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .eq('service_name', 'google')
      .single()

    if (error || !googleConfig) {
      console.log('No Google configuration found:', error)
      return new Response(
        JSON.stringify({ error: 'Google configuration not found. Please connect your Google account first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Google configuration found, fetching task lists...')

    let accessToken = googleConfig.access_token

    // Check if token needs refresh
    if (googleConfig.expires_at && new Date(googleConfig.expires_at) <= new Date()) {
      console.log('Access token expired, refreshing...')
      accessToken = await refreshGoogleToken(supabase, user.id, googleConfig.refresh_token)
      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: 'Failed to refresh Google access token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Fetch Google Task Lists
    const taskListsResponse = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!taskListsResponse.ok) {
      if (taskListsResponse.status === 401) {
        console.log('Token invalid, attempting refresh...')
        accessToken = await refreshGoogleToken(supabase, user.id, googleConfig.refresh_token)
        if (!accessToken) {
          return new Response(
            JSON.stringify({ error: 'Failed to refresh Google access token' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Retry with new token
        const retryResponse = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        })
        
        if (!retryResponse.ok) {
          const errorText = await retryResponse.text()
          console.log('Google Tasks API error after refresh:', errorText)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch task lists from Google' }),
            { status: retryResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const retryData = await retryResponse.json()
        console.log('Fetched', retryData.items?.length || 0, 'task lists')
        
        return new Response(
          JSON.stringify({ taskLists: retryData.items || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const errorText = await taskListsResponse.text()
      console.log('Google Tasks API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch task lists from Google' }),
        { status: taskListsResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const taskListsData = await taskListsResponse.json()
    console.log('Fetched', taskListsData.items?.length || 0, 'task lists')

    return new Response(
      JSON.stringify({ taskLists: taskListsData.items || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: `Server error: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function refreshGoogleToken(supabase: any, userId: string, refreshToken: string): Promise<string | null> {
  try {
    console.log('Refreshing Google access token...')
    
    if (!refreshToken) {
      console.log('No refresh token available')
      return null
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.log('Token refresh failed:', errorText)
      return null
    }

    const tokenData = await tokenResponse.json()
    const newAccessToken = tokenData.access_token
    const expiresIn = tokenData.expires_in || 3600
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // Update the database with new token
    const { error: updateError } = await supabase
      .from('api_configurations')
      .update({
        access_token: newAccessToken,
        expires_at: expiresAt,
      })
      .eq('user_id', userId)
      .eq('service_name', 'google')

    if (updateError) {
      console.log('Failed to update access token in database:', updateError)
      return null
    }

    console.log('Access token refreshed successfully')
    return newAccessToken
  } catch (error) {
    console.log('Error refreshing token:', error)
    return null
  }
}