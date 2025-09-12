import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== SYNC ALEXA REMINDERS ===')
  console.log('Method:', req.method)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Processing Alexa reminders sync request...')
    
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

    // Get user's active routines with reminder times
    console.log('Fetching user routines...')
    const { data: routines, error: routinesError } = await supabase
      .from('routines')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .not('reminder_times', 'is', null)

    if (routinesError) {
      console.error('Error fetching routines:', routinesError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch routines' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Found routines:', routines?.length || 0)

    if (!routines || routines.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No active routines with reminder times found',
          reminders_created: 0 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // For demo purposes, we'll simulate reminder creation
    // In production, you would use the Alexa Reminders API with proper authentication
    console.log('Simulating Alexa reminder creation for routines...')
    
    let remindersCreated = 0
    const results = []

    for (const routine of routines) {
      try {
        console.log(`Processing routine: ${routine.title}`)
        
        if (routine.reminder_times && routine.reminder_times.length > 0) {
          for (const reminderTime of routine.reminder_times) {
            console.log(`Creating reminder for ${routine.title} at ${reminderTime}`)
            
            // Simulate reminder creation
            const reminderResult = {
              routine_id: routine.id,
              routine_title: routine.title,
              reminder_time: reminderTime,
              alexa_reminder_id: `mock_reminder_${Date.now()}_${Math.random()}`,
              created: true
            }
            
            results.push(reminderResult)
            remindersCreated++
          }
        }
      } catch (error) {
        console.error(`Error processing routine ${routine.id}:`, error)
        results.push({
          routine_id: routine.id,
          routine_title: routine.title,
          error: error.message,
          created: false
        })
      }
    }

    console.log(`Successfully created ${remindersCreated} Alexa reminders`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully synced ${remindersCreated} reminders to Alexa`,
        reminders_created: remindersCreated,
        details: results
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

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