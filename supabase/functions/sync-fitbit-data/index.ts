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
    
    // Check if this is a cron job or user request
    const authHeader = req.headers.get('authorization')
    const isCronJob = !authHeader || authHeader.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    
    if (isCronJob) {
      console.log('Running as cron job - syncing all users')
      return await syncAllUsers()
    } else {
      console.log('Running as user request')
      return await syncSingleUser(authHeader)
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

async function syncAllUsers() {
  // Create service role client for system operations
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Get all users with Fitbit configurations
  const { data: configs, error: configError } = await supabase
    .from('api_configurations')
    .select('user_id, access_token')
    .eq('service_name', 'fitbit')
    .eq('is_active', true)
    .not('access_token', 'is', null)

  if (configError) {
    console.error('Error fetching configs:', configError)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch user configurations' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log(`Found ${configs?.length || 0} users with Fitbit configs`)

  let totalSynced = 0
  const results = []

  for (const config of configs || []) {
    try {
      const syncResult = await syncUserData(supabase, config.user_id, config.access_token)
      totalSynced += syncResult.length
      results.push({ userId: config.user_id, synced: syncResult.length })
    } catch (error) {
      console.error(`Error syncing user ${config.user_id}:`, error)
      results.push({ userId: config.user_id, error: error.message })
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: `Cron sync completed. ${totalSynced} total data points synced for ${configs?.length || 0} users`,
      results
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function syncSingleUser(authHeader: string) {
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

  // Get Fitbit configuration (use will@w-j-lander.uk's settings for all users)
  console.log('Fetching Fitbit configuration...')
  const { data: config, error: configError } = await supabase
    .from('api_configurations')
    .select('*')
    .eq('user_id', 'b7318f45-ae52-49f4-9db5-1662096679dd')
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

  const syncResults = await syncUserData(supabase, user.id, config.access_token)

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
}

async function refreshFitbitToken(supabase: any, userId: string) {
  console.log('Refreshing Fitbit token for user:', userId)
  
  // Get current config with refresh token
  // Use will@w-j-lander.uk's Fitbit config for all users
  const { data: config, error: configError } = await supabase
    .from('api_configurations')
    .select('*')
    .eq('user_id', 'b7318f45-ae52-49f4-9db5-1662096679dd')
    .eq('service_name', 'fitbit')
    .single()
    
  if (configError || !config?.refresh_token) {
    console.log('No refresh token found:', configError)
    throw new Error('No refresh token available. Please re-authorize Fitbit.')
  }
  
  // Refresh the token
  const refreshResponse = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${config.client_id}:${config.client_secret}`)}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refresh_token
    })
  })
  
  if (!refreshResponse.ok) {
    const errorText = await refreshResponse.text()
    console.log('Token refresh failed:', refreshResponse.status, errorText)
    throw new Error('Failed to refresh Fitbit token. Please re-authorize.')
  }
  
  const tokenData = await refreshResponse.json()
  console.log('Token refresh successful')
  
  // Update the configuration with new tokens
  const { error: updateError } = await supabase
    .from('api_configurations')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', config.id)
    
  if (updateError) {
    console.log('Failed to update tokens:', updateError)
    throw new Error('Failed to save new tokens')
  }
  
  return tokenData.access_token
}

async function syncUserData(supabase: any, userId: string, accessToken: string) {
  console.log('Syncing Fitbit data for user:', userId)
  
  // Check if token is expired and refresh if needed
  const { data: config } = await supabase
    .from('api_configurations')
    .select('expires_at')
    .eq('user_id', userId)
    .eq('service_name', 'fitbit')
    .single()
    
  if (config?.expires_at && new Date(config.expires_at) <= new Date()) {
    console.log('Token expired, refreshing...')
    accessToken = await refreshFitbitToken(supabase, userId)
  }

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
          'Authorization': `Bearer ${accessToken}`,
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
                user_id: userId,
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
      } else if (heartRateResponse.status === 401) {
        console.log('Heart rate API 401 - token expired, attempting refresh...')
        accessToken = await refreshFitbitToken(supabase, userId)
        throw new Error('Token refreshed, please retry sync')
      } else {
        console.log('Heart rate API error:', heartRateResponse.status, await heartRateResponse.text())
      }

      // Sync steps data (14-day range)
      console.log('Fetching steps data for 14 days...')
      const stepsResponse = await fetch(
        `https://api.fitbit.com/1/user/-/activities/steps/date/${startDateStr}/${endDateStr}.json`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
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
                user_id: userId,
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
      } else if (stepsResponse.status === 401) {
        console.log('Steps API 401 - token expired, attempting refresh...')
        accessToken = await refreshFitbitToken(supabase, userId)
        throw new Error('Token refreshed, please retry sync')
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
              'Authorization': `Bearer ${accessToken}`,
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
                user_id: userId,
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
        } else if (weightResponse.status === 401) {
          console.log('Weight API 401 - token expired, attempting refresh...')
          accessToken = await refreshFitbitToken(supabase, userId)
          throw new Error('Token refreshed, please retry sync')
        } else {
          console.log(`Weight API error for ${dateStr}:`, weightResponse.status)
        }
      }

  } catch (apiError) {
    console.error('Fitbit API error for user', userId, ':', apiError)
    throw apiError
  }

  console.log('Sync completed for user', userId, '. Results:', syncResults.length)
  return syncResults
}