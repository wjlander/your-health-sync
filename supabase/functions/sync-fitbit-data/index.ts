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

    // Get date range for last 14 days
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - 13) // 14 days including today
    
    const endDateStr = today.toISOString().split('T')[0]
    const startDateStr = startDate.toISOString().split('T')[0]
    
    console.log('Syncing data for date range:', startDateStr, 'to', endDateStr)

    const syncResults = []

    try {
      // Sync heart rate data (14-day range)
      console.log('Fetching heart rate data for 14 days...')
      const heartRateResponse = await fetch(
        `https://api.fitbit.com/1/user/-/activities/heart/date/${startDateStr}/${endDateStr}.json`,
        {
          headers: {
            'Authorization': `Bearer ${config.access_token}`,
          },
        }
      )

      if (heartRateResponse.ok) {
        const heartRateData = await heartRateResponse.json()
        console.log('Heart rate data received for', heartRateData['activities-heart']?.length, 'days')
        
        if (heartRateData['activities-heart']) {
          for (const dayData of heartRateData['activities-heart']) {
            if (dayData.value && dayData.value.restingHeartRate) {
              const { error: insertError } = await supabase
                .from('health_data')
                .upsert({
                  user_id: user.id,
                  date: dayData.dateTime,
                  data_type: 'resting_heart_rate',
                  value: dayData.value.restingHeartRate,
                  unit: 'bpm',
                  metadata: { source: 'fitbit' }
                }, {
                  onConflict: 'user_id,date,data_type'
                })
              
              if (!insertError) {
                syncResults.push({ 
                  type: 'resting_heart_rate', 
                  value: dayData.value.restingHeartRate, 
                  unit: 'bpm',
                  date: dayData.dateTime 
                })
              }
            }
          }
        }
      } else {
        console.log('Heart rate API error:', heartRateResponse.status, await heartRateResponse.text())
      }

      // Sync steps data (14-day range)
      console.log('Fetching steps data for 14 days...')
      const stepsResponse = await fetch(
        `https://api.fitbit.com/1/user/-/activities/steps/date/${startDateStr}/${endDateStr}.json`,
        {
          headers: {
            'Authorization': `Bearer ${config.access_token}`,
          },
        }
      )

      if (stepsResponse.ok) {
        const stepsData = await stepsResponse.json()
        console.log('Steps data received for', stepsData['activities-steps']?.length, 'days')
        
        if (stepsData['activities-steps']) {
          for (const daySteps of stepsData['activities-steps']) {
            if (daySteps.value) {
              const { error: insertError } = await supabase
                .from('health_data')
                .upsert({
                  user_id: user.id,
                  date: daySteps.dateTime,
                  data_type: 'steps',
                  value: parseInt(daySteps.value),
                  unit: 'steps',
                  metadata: { source: 'fitbit' }
                }, {
                  onConflict: 'user_id,date,data_type'
                })
              
              if (!insertError) {
                syncResults.push({ 
                  type: 'steps', 
                  value: parseInt(daySteps.value), 
                  unit: 'steps',
                  date: daySteps.dateTime 
                })
              }
            }
          }
        }
      } else {
        console.log('Steps API error:', stepsResponse.status, await stepsResponse.text())
      }

      // Sync weight data (need to fetch each day individually)
      console.log('Fetching weight data for 14 days...')
      for (let i = 0; i < 14; i++) {
        const currentDate = new Date(today)
        currentDate.setDate(today.getDate() - i)
        const dateStr = currentDate.toISOString().split('T')[0]
        
        const weightResponse = await fetch(
          `https://api.fitbit.com/1/user/-/body/log/weight/date/${dateStr}.json`,
          {
            headers: {
              'Authorization': `Bearer ${config.access_token}`,
            },
          }
        )

        if (weightResponse.ok) {
          const weightData = await weightResponse.json()
          
          if (weightData.weight && weightData.weight.length > 0) {
            const latestWeight = weightData.weight[0]
            if (latestWeight.weight) {
              const { error: insertError } = await supabase
                .from('health_data')
                .upsert({
                  user_id: user.id,
                  date: dateStr,
                  data_type: 'weight',
                  value: latestWeight.weight,
                  unit: 'kg',
                  metadata: { source: 'fitbit' }
                }, {
                  onConflict: 'user_id,date,data_type'
                })
              
              if (!insertError) {
                syncResults.push({ 
                  type: 'weight', 
                  value: latestWeight.weight, 
                  unit: 'kg',
                  date: dateStr 
                })
              }
            }
          }
        } else {
          console.log(`Weight API error for ${dateStr}:`, weightResponse.status)
        }
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