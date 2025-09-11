import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== LIST GOOGLE TASK ITEMS ===')
  console.log('Method:', req.method)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get the auth header and task list ID
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { taskListId } = await req.json()
    if (!taskListId) {
      return new Response(
        JSON.stringify({ error: 'Task list ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Google configuration
    const { data: googleConfig, error } = await supabase
      .from('api_configurations')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .eq('service_name', 'google')
      .single()

    if (error || !googleConfig) {
      return new Response(
        JSON.stringify({ error: 'Google configuration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let accessToken = googleConfig.access_token

    // Check if token needs refresh
    if (googleConfig.expires_at && new Date(googleConfig.expires_at) <= new Date()) {
      accessToken = await refreshGoogleToken(supabase, user.id, googleConfig.refresh_token)
      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: 'Failed to refresh Google access token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Fetch tasks from the specified task list
    const tasksResponse = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!tasksResponse.ok) {
      if (tasksResponse.status === 401) {
        accessToken = await refreshGoogleToken(supabase, user.id, googleConfig.refresh_token)
        if (!accessToken) {
          return new Response(
            JSON.stringify({ error: 'Failed to refresh Google access token' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Retry with new token
        const retryResponse = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        })
        
        if (!retryResponse.ok) {
          const errorText = await retryResponse.text()
          console.log('Google Tasks API error after refresh:', errorText)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch tasks from Google' }),
            { status: retryResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const retryData = await retryResponse.json()
        return new Response(
          JSON.stringify({ tasks: retryData.items || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const errorText = await tasksResponse.text()
      console.log('Google Tasks API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tasks from Google' }),
        { status: tasksResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tasksData = await tasksResponse.json()
    console.log('Fetched', tasksData.items?.length || 0, 'tasks from list', taskListId)

    return new Response(
      JSON.stringify({ tasks: tasksData.items || [] }),
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
    if (!refreshToken) return null

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!tokenResponse.ok) return null

    const tokenData = await tokenResponse.json()
    const newAccessToken = tokenData.access_token
    const expiresIn = tokenData.expires_in || 3600
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    await supabase
      .from('api_configurations')
      .update({
        access_token: newAccessToken,
        expires_at: expiresAt,
      })
      .eq('user_id', userId)
      .eq('service_name', 'google')

    return newAccessToken
  } catch (error) {
    console.log('Error refreshing token:', error)
    return null
  }
}