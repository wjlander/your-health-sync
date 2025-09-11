import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== ALEXA REMINDERS API ===')
  console.log('Method:', req.method)
  
  if (req.method === 'OPTIONS') {
    console.log('Returning CORS response')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Processing Alexa Reminders request...')
    
    // Parse request body
    const body = await req.json()
    const action = body.action || 'list'
    console.log('Action requested:', action)
    
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

    // Get Alexa configuration
    console.log('Fetching Alexa configuration...')
    const { data: config, error: configError } = await supabase
      .from('api_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('service_name', 'amazon')
      .single()

    if (configError || !config) {
      console.log('Config error:', configError)
      return new Response(
        JSON.stringify({ error: 'Alexa configuration not found' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!config.access_token) {
      console.log('No access token available')
      return new Response(
        JSON.stringify({ error: 'No access token available. Please authorize Alexa access first.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Found Alexa config with access token')

    // Handle different actions
    if (action === 'list') {
      console.log('Fetching reminders list...')
      const response = await fetch('https://api.amazonalexa.com/v1/alerts/reminders', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Alexa API error:', response.status, errorText)
        
        if (response.status === 401) {
          return new Response(
            JSON.stringify({ error: 'Access token expired. Please re-authorize Alexa access.' }),
            { 
              status: 401, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
        
        return new Response(
          JSON.stringify({ error: `Alexa API error: ${response.status}` }),
          { 
            status: response.status, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const result = await response.json()
      return new Response(JSON.stringify({ 
        success: true, 
        data: result 
      }), {
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      })

    } else if (action === 'create') {
      console.log('Creating reminder...')
      const { reminderText, triggerTime } = body
      
      if (!reminderText || !triggerTime) {
        return new Response(
          JSON.stringify({ error: 'Missing reminderText or triggerTime' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const reminderData = {
        requestTime: new Date().toISOString(),
        trigger: {
          type: 'SCHEDULED_ABSOLUTE',
          scheduledTime: triggerTime
        },
        alertInfo: {
          spokenInfo: {
            content: [{
              locale: 'en-US',
              text: reminderText
            }]
          }
        },
        pushNotification: {
          status: 'ENABLED'
        }
      }

      const response = await fetch('https://api.amazonalexa.com/v1/alerts/reminders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reminderData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Alexa API error:', response.status, errorText)
        
        if (response.status === 401) {
          return new Response(
            JSON.stringify({ error: 'Access token expired. Please re-authorize Alexa access.' }),
            { 
              status: 401, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
        
        return new Response(
          JSON.stringify({ error: `Alexa API error: ${response.status}` }),
          { 
            status: response.status, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      let result
      const responseText = await response.text()
      try {
        result = responseText ? JSON.parse(responseText) : {}
      } catch {
        result = { success: true, response: responseText }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        data: result 
      }), {
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      })

    } else {
      return new Response(
        JSON.stringify({ error: 'Unknown action' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

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