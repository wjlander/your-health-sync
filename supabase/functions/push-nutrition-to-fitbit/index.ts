import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== PUSH NUTRITION TO FITBIT ===')
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

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

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const { mealData, date } = await req.json()
    
    if (!mealData || !date) {
      return new Response(
        JSON.stringify({ error: 'Missing meal data or date' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Fitbit access token
    const { data: config, error: configError } = await supabase
      .from('api_configurations')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .eq('service_name', 'fitbit')
      .maybeSingle()

    if (configError || !config?.access_token) {
      return new Response(
        JSON.stringify({ error: 'No Fitbit access token found. Please connect to Fitbit first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let accessToken = config.access_token

    // Check if token is expired and refresh if needed
    if (config.expires_at && new Date(config.expires_at) <= new Date()) {
      console.log('Token expired, refreshing...')
      accessToken = await refreshFitbitToken(supabase, user.id, config.refresh_token)
    }

    // Push nutrition data to Fitbit using Food Log API
    const results = []
    
    for (const item of mealData) {
      try {
        // First, try to find the food in Fitbit's database
        const searchResponse = await fetch(
          `https://api.fitbit.com/1/foods/search.json?query=${encodeURIComponent(item.foodName)}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        )

        if (!searchResponse.ok) {
          throw new Error(`Food search failed: ${searchResponse.status}`)
        }

        const searchData = await searchResponse.json()
        let foodId = null
        
        // Try to find exact match
        const exactMatch = searchData.foods?.find(food => 
          food.name.toLowerCase() === item.foodName.toLowerCase()
        )
        
        if (exactMatch) {
          foodId = exactMatch.foodId
        } else if (searchData.foods?.length > 0) {
          // Use first result if no exact match
          foodId = searchData.foods[0].foodId
        } else {
          // Create custom food if not found in Fitbit database
          const createFoodResponse = await fetch(
            'https://api.fitbit.com/1/foods.json',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                name: item.foodName,
                defaultFoodMeasurementUnitId: '147', // grams
                defaultServingSize: '100',
                calories: Math.round(item.calories || 0).toString(),
                formType: 'GENERIC',
              })
            }
          )
          
          if (createFoodResponse.ok) {
            const createFoodData = await createFoodResponse.json()
            foodId = createFoodData.food.foodId
          } else {
            throw new Error('Failed to create custom food in Fitbit')
          }
        }

        // Log the food to Fitbit
        if (foodId) {
          const logResponse = await fetch(
            'https://api.fitbit.com/1/user/-/foods/log.json',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                foodId: foodId.toString(),
                mealTypeId: getMealTypeId(item.mealType),
                unitId: '147', // grams
                amount: (item.quantity || 100).toString(),
                date: date,
              })
            }
          )

          if (logResponse.ok) {
            const logData = await logResponse.json()
            results.push({
              item: item.foodName,
              status: 'success',
              message: 'Successfully logged to Fitbit',
              fitbitLogId: logData.foodLog.logId
            })
          } else {
            throw new Error(`Failed to log food: ${logResponse.status}`)
          }
        }
        
      } catch (error) {
        console.error('Error pushing item to Fitbit:', error)
        results.push({
          item: item.foodName,
          status: 'error',
          message: error.message
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Pushed ${results.filter(r => r.status === 'success').length}/${results.length} items to Fitbit`,
        results: results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function getMealTypeId(mealType: string): string {
  const mealTypes = {
    'breakfast': '1',
    'lunch': '2', 
    'dinner': '3',
    'snack': '4'
  }
  return mealTypes[mealType.toLowerCase()] || '4' // default to snack
}

async function refreshFitbitToken(supabase: any, userId: string, refreshToken: string) {
  const clientId = Deno.env.get('FITBIT_CLIENT_ID')
  const clientSecret = Deno.env.get('FITBIT_CLIENT_SECRET')
  
  if (!clientId || !clientSecret) {
    throw new Error('Fitbit OAuth configuration not found')
  }
  
  const refreshResponse = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  })
  
  if (!refreshResponse.ok) {
    throw new Error('Failed to refresh Fitbit token')
  }
  
  const tokenData = await refreshResponse.json()
  
  // Update tokens in database
  await supabase
    .from('api_configurations')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
    })
    .eq('user_id', userId)
    
  return tokenData.access_token
}