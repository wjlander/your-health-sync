import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== SYNC FITBIT DATA ===')
  console.log('Method:', req.method)
  
  if (req.method === 'OPTIONS') {
    console.log('Returning CORS response')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Processing Fitbit data sync request...')
    
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

    // Get Fitbit configuration
    console.log('Fetching Fitbit configuration...')
    const { data: config, error: configError } = await supabase
      .from('api_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('service_name', 'fitbit')
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
      console.log('No Fitbit access token found')
      return new Response(
        JSON.stringify({ 
          error: 'No Fitbit access token found. Please connect to Fitbit first.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Syncing Fitbit data for user:', user.id)

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0]
    console.log('Syncing data for date:', today)

    const syncResults = []

    try {
      // Sync heart rate data
      console.log('Fetching heart rate data...')
      const heartRateResponse = await fetch(
        `https://api.fitbit.com/1/user/-/activities/heart/date/${today}/1d.json`,
        {
          headers: {
            'Authorization': `Bearer ${config.access_token}`,
          },
        }
      )

      if (heartRateResponse.ok) {
        const heartRateData = await heartRateResponse.json()
        console.log('Heart rate data received:', heartRateData)
        
        if (heartRateData['activities-heart'] && heartRateData['activities-heart'][0]) {
          const dayData = heartRateData['activities-heart'][0]
          if (dayData.value && dayData.value.restingHeartRate) {
            // Store resting heart rate
            const { error: insertError } = await supabase
              .from('health_data')
              .upsert({
                user_id: user.id,
                date: today,
                data_type: 'resting_heart_rate',
                value: dayData.value.restingHeartRate,
                unit: 'bpm',
                metadata: { source: 'fitbit' }
              }, {
                onConflict: 'user_id,date,data_type'
              })
            
            if (!insertError) {
              syncResults.push({ type: 'resting_heart_rate', value: dayData.value.restingHeartRate, unit: 'bpm' })
            }
          }
        }
      } else {
        console.log('Heart rate API error:', heartRateResponse.status, await heartRateResponse.text())
      }

      // Sync steps data
      console.log('Fetching steps data...')
      const stepsResponse = await fetch(
        `https://api.fitbit.com/1/user/-/activities/steps/date/${today}/1d.json`,
        {
          headers: {
            'Authorization': `Bearer ${config.access_token}`,
          },
        }
      )

      if (stepsResponse.ok) {
        const stepsData = await stepsResponse.json()
        console.log('Steps data received:', stepsData)
        
        if (stepsData['activities-steps'] && stepsData['activities-steps'][0]) {
          const daySteps = stepsData['activities-steps'][0]
          if (daySteps.value) {
            // Store steps
            const { error: insertError } = await supabase
              .from('health_data')
              .upsert({
                user_id: user.id,
                date: today,
                data_type: 'steps',
                value: parseInt(daySteps.value),
                unit: 'steps',
                metadata: { source: 'fitbit' }
              }, {
                onConflict: 'user_id,date,data_type'
              })
            
            if (!insertError) {
              syncResults.push({ type: 'steps', value: parseInt(daySteps.value), unit: 'steps' })
            }
          }
        }
      } else {
        console.log('Steps API error:', stepsResponse.status, await stepsResponse.text())
      }

      // Sync weight data
      console.log('Fetching weight data...')
      const weightResponse = await fetch(
        `https://api.fitbit.com/1/user/-/body/log/weight/date/${today}.json`,
        {
          headers: {
            'Authorization': `Bearer ${config.access_token}`,
          },
        }
      )

      if (weightResponse.ok) {
        const weightData = await weightResponse.json()
        console.log('Weight data received:', weightData)
        
        if (weightData.weight && weightData.weight.length > 0) {
          const latestWeight = weightData.weight[0]
          if (latestWeight.weight) {
            // Store weight
            const { error: insertError } = await supabase
              .from('health_data')
              .upsert({
                user_id: user.id,
                date: today,
                data_type: 'weight',
                value: latestWeight.weight,
                unit: 'kg',
                metadata: { source: 'fitbit' }
              }, {
                onConflict: 'user_id,date,data_type'
              })
            
            if (!insertError) {
              syncResults.push({ type: 'weight', value: latestWeight.weight, unit: 'kg' })
            }
          }
        }
      } else {
        console.log('Weight API error:', weightResponse.status, await weightResponse.text())
      }

    } catch (apiError) {
      console.error('Fitbit API error:', apiError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch data from Fitbit API',
          details: apiError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Sync completed. Results:', syncResults)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully synced ${syncResults.length} data points`,
        data: syncResults
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