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
      .eq('service_name', 'alexa')
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

    if (!config || !config.access_token) {
      console.log('No Alexa configuration or access token found')
      return new Response(
        JSON.stringify({ 
          error: 'No Alexa access token found. Please connect your Alexa account first.',
          requiresAuth: true
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Alexa configuration found, performing action:', action)

    // Handle different actions
    if (action === 'list') {
      // List reminders using Alexa API
      const remindersResponse = await fetch('https://api.amazonalexa.com/v1/alerts/reminders', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!remindersResponse.ok) {
        const errorText = await remindersResponse.text()
        console.log('Alexa API error:', errorText)
        
        if (remindersResponse.status === 401) {
          return new Response(
            JSON.stringify({ 
              error: 'Alexa access token expired. Please reconnect your account.',
              requiresReauth: true 
            }),
            { 
              status: 401, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
        
        return new Response(
          JSON.stringify({ error: `Alexa API error: ${errorText}` }),
          { 
            status: remindersResponse.status, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const remindersData = await remindersResponse.json()
      console.log('Retrieved reminders:', remindersData)

      return new Response(
        JSON.stringify({
          success: true,
          message: `Found ${remindersData.totalCount || 0} reminders`,
          reminders: remindersData.alerts || []
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else if (action === 'create') {
      // Create a reminder using Alexa API
      const { reminderText, triggerTime } = body
      
      if (!reminderText || !triggerTime) {
        return new Response(
          JSON.stringify({ error: 'Missing reminderText or triggerTime in request' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const reminderPayload = {
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

      console.log('Creating reminder with payload:', JSON.stringify(reminderPayload, null, 2))

      const createResponse = await fetch('https://api.amazonalexa.com/v1/alerts/reminders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reminderPayload)
      })

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        console.log('Alexa reminder creation error:', errorText)
        
        if (createResponse.status === 401) {
          return new Response(
            JSON.stringify({ 
              error: 'Alexa access token expired. Please reconnect your account.',
              requiresReauth: true 
            }),
            { 
              status: 401, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
        
        return new Response(
          JSON.stringify({ error: `Failed to create reminder: ${errorText}` }),
          { 
            status: createResponse.status, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const createdReminder = await createResponse.json()
      console.log('Reminder created successfully:', createdReminder)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Reminder created successfully on Alexa device',
          reminder: createdReminder
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      return new Response(
        JSON.stringify({ error: `Unsupported action: ${action}` }),
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