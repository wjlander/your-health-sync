import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { makeGoogleApiCall } from '../_shared/token-refresh.ts'

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

    // Fetch tasks using the shared utility for automatic token refresh
    try {
      const tasksResponse = await makeGoogleApiCall(
        supabase,
        user.id,
        `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`
      )

      if (!tasksResponse.ok) {
        const errorText = await tasksResponse.text()
        console.log('Google Tasks API error:', errorText)
        
        if (tasksResponse.status === 401) {
          return new Response(
            JSON.stringify({ error: 'Google authorization expired. Please reconnect your Google account.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
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
      console.error('Error fetching tasks:', error)
      
      if (error.message.includes('refresh')) {
        return new Response(
          JSON.stringify({ error: 'Google authorization expired. Please reconnect your Google account.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tasks from Google' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
