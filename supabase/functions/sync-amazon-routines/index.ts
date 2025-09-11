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
    return new Response(null, { headers: corsHeaders })
  }

  try {
    let body = null;
    let action = 'list'; // default action
    
    // Safely parse JSON body for POST requests
    if (req.method === 'POST') {
      const text = await req.text();
      if (text && text.trim()) {
        try {
          body = JSON.parse(text);
          action = body?.action || 'list';
        } catch (parseError) {
          console.log('Failed to parse JSON body:', text);
          return new Response(
            JSON.stringify({ error: 'Invalid JSON in request body' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
      }
    }
    
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

    // Get Amazon/Alexa configuration
    console.log('Fetching Amazon configuration...')
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
      console.log('No Amazon configuration found or no access token')
      return new Response(
        JSON.stringify({ 
          error: 'No Amazon configuration found or not connected. Please complete the Login with Amazon OAuth flow first.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Amazon configuration found, performing action: ${action}`)
    
    // Handle different actions
    if (action === 'create' && body?.reminder) {
      // Create a new reminder - but Login with Amazon doesn't have access to Alexa device APIs
      const reminder = body.reminder
      console.log('Attempting to create Alexa reminder but Login with Amazon lacks device permissions:', reminder)
      
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Cannot create Alexa reminders with Login with Amazon OAuth. This requires Alexa Skills Kit or Alexa Voice Service integration.',
          limitation: 'Login with Amazon OAuth only provides profile access, not device control.',
          suggestion: 'Create local reminders instead or implement an Alexa Skill.'
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      // List existing reminders - but Login with Amazon doesn't have access to Alexa device APIs
      console.log('Login with Amazon OAuth does not provide access to Alexa device APIs')
      
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Amazon profile connected successfully, but Alexa device features (reminders/routines) require Alexa Skills Kit or Alexa Voice Service integration.',
          limitation: 'Login with Amazon OAuth only provides profile access, not device control.',
          data: { reminders: [] }
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    console.error('=== SYNC ERROR ===')
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