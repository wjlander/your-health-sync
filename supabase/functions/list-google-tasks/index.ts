import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { makeGoogleApiCall } from '../_shared/token-refresh.ts'

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
    
    try {
      // Use the shared utility for automatic token refresh
      const tasksResponse = await makeGoogleApiCall(
        supabase,
        user.id,
        'https://tasks.googleapis.com/tasks/v1/users/@me/lists'
      )

      if (!tasksResponse.ok) {
        console.log('Google Tasks API error:', tasksResponse.status, await tasksResponse.text())
        
        if (tasksResponse.status === 401) {
          return new Response(
            JSON.stringify({ error: 'Google authorization expired. Please reconnect your Google account.' }),
            { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          )
        }
        
        return new Response(
          JSON.stringify({ error: 'Failed to fetch Google task lists' }),
          { status: tasksResponse.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        )
      }

      const tasksData = await tasksResponse.json()
      console.log('Task lists fetch successful')
      
      return new Response(
        JSON.stringify({
          taskLists: tasksData.items || [],
          message: 'Task lists fetched successfully'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
      
    } catch (error) {
      console.error('Error fetching task lists:', error)
      
      if (error.message.includes('refresh')) {
        return new Response(
          JSON.stringify({ error: 'Google authorization expired. Please reconnect your Google account.' }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Google task lists' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: `Server error: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})