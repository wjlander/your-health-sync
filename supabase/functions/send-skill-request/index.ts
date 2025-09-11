import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json()
    console.log('Skill request action:', action, 'data:', data)

    // Get user from JWT
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Authentication failed')
    }

    console.log('Authenticated user:', user.id)

    // Get user's Alexa configuration
    const { data: config, error: configError } = await supabase
      .from('api_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('service_name', 'amazon')
      .single()

    if (configError || !config) {
      throw new Error('Alexa configuration not found')
    }

    if (!config.access_token) {
      throw new Error('No access token available')
    }

    console.log('Found Alexa config for skill:', config.skill_id)

    // Send request to Alexa skill endpoint
    const skillEndpoint = `https://api.amazonalexa.com/v1/skills/${config.skill_id}/stages/development/interactionModel/locales/en-US/intents`
    
    let response
    if (action === 'create_reminder') {
      // Send reminder creation request to skill
      const skillRequest = {
        type: 'web_request',
        action: 'create_reminder',
        data: {
          reminderText: data.reminderText,
          triggerTime: data.triggerTime,
          userId: user.id
        }
      }

      response = await fetch(skillEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(skillRequest)
      })
    } else if (action === 'list_reminders') {
      // Request reminders list from skill
      const skillRequest = {
        type: 'web_request',
        action: 'list_reminders',
        data: {
          userId: user.id
        }
      }

      response = await fetch(skillEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(skillRequest)
      })
    } else {
      throw new Error('Unknown action')
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Skill API error:', response.status, errorText)
      
      if (response.status === 401) {
        throw new Error('Access token expired or invalid')
      }
      throw new Error(`Skill API error: ${response.status}`)
    }

    const result = await response.json()
    console.log('Skill response:', result)

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

  } catch (error) {
    console.error('Error in send-skill-request:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      }
    })
  }
})