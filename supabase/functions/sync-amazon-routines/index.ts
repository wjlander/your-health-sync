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
      // Create a new reminder using Alexa Reminders API
      const reminder = body.reminder
      console.log('Creating Alexa reminder:', reminder)
      
      const reminderPayload = {
        requestTime: new Date().toISOString(),
        trigger: {
          type: reminder.recurrence ? 'SCHEDULED_RECURRING' : 'SCHEDULED_ABSOLUTE',
          scheduledTime: reminder.scheduledTime || new Date(Date.now() + 60000).toISOString(),
          ...(reminder.recurrence && { recurrence: reminder.recurrence })
        },
        alertInfo: {
          spokenInfo: {
            content: [{
              locale: 'en-US',
              text: reminder.text || reminder.title
            }]
          }
        },
        pushNotification: {
          status: 'ENABLED'
        }
      }
      
      console.log('Reminder payload:', JSON.stringify(reminderPayload, null, 2))
      
      const alexaResponse = await fetch('https://api.amazonalexa.com/v1/alerts/reminders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reminderPayload)
      })
      
      console.log('Alexa API response status:', alexaResponse.status)
      
      if (alexaResponse.status === 401) {
        // Token might be expired, try to refresh if we have a refresh token
        if (config.refresh_token) {
          console.log('Access token expired, attempting to refresh...')
          
          const refreshResponse = await fetch('https://api.amazon.com/auth/o2/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: config.refresh_token,
              client_id: config.client_id || '',
              client_secret: config.client_secret || ''
            })
          })
          
          if (refreshResponse.ok) {
            const tokenData = await refreshResponse.json()
            console.log('Token refreshed successfully')
            
            // Update the stored tokens
            await supabase
              .from('api_configurations')
              .update({
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token || config.refresh_token,
                expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
              })
              .eq('id', config.id)
            
            // Retry the reminder creation with new token
            const retryResponse = await fetch('https://api.amazonalexa.com/v1/alerts/reminders', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(reminderPayload)
            })
            
            if (retryResponse.ok) {
              const reminderResult = await retryResponse.json()
              console.log('Reminder created successfully after token refresh:', reminderResult)
              
              return new Response(
                JSON.stringify({
                  success: true,
                  message: 'Alexa reminder created successfully',
                  data: { reminderId: reminderResult.alertToken }
                }),
                { 
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                }
              )
            } else {
              const retryError = await retryResponse.text()
              console.log('Retry failed:', retryError)
            }
          } else {
            console.log('Token refresh failed')
          }
        }
        
        return new Response(
          JSON.stringify({ 
            error: 'Alexa authentication expired. You need to reconnect your Amazon account with the correct permissions for Alexa reminders.',
            requiresReauth: true
          }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      if (!alexaResponse.ok) {
        const errorText = await alexaResponse.text()
        console.log('Alexa API error:', errorText)
        
        return new Response(
          JSON.stringify({ 
            error: `Failed to create Alexa reminder: ${errorText}` 
          }),
          { 
            status: alexaResponse.status, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      const reminderResult = await alexaResponse.json()
      console.log('Reminder created successfully:', reminderResult)
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Alexa reminder created successfully',
          data: { reminderId: reminderResult.alertToken }
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      // List existing reminders
      console.log('Fetching existing Alexa reminders...')
      
      const alexaResponse = await fetch('https://api.amazonalexa.com/v1/alerts/reminders', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (alexaResponse.status === 401 && config.refresh_token) {
        // Try to refresh token and retry
        console.log('Access token expired, attempting to refresh...')
        
        const refreshResponse = await fetch('https://api.amazon.com/auth/o2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: config.refresh_token,
            client_id: config.client_id || '',
            client_secret: config.client_secret || ''
          })
        })
        
        if (refreshResponse.ok) {
          const tokenData = await refreshResponse.json()
          
          // Update tokens
          await supabase
            .from('api_configurations')
            .update({
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token || config.refresh_token,
              token_expiry: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
            })
            .eq('id', config.id)
          
          // Retry with new token
          const retryResponse = await fetch('https://api.amazonalexa.com/v1/alerts/reminders', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (retryResponse.ok) {
            const reminders = await retryResponse.json()
            return new Response(
              JSON.stringify({
                success: true,
                message: 'Alexa reminders synced successfully',
                data: { reminders: reminders.alerts || [] }
              }),
              { 
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            )
          }
        }
      }
      
      if (!alexaResponse.ok) {
        const errorText = await alexaResponse.text()
        console.log('Alexa API error:', errorText)
        
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Failed to connect to Alexa. Please check your Amazon connection.',
            error: errorText
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      const reminders = await alexaResponse.json()
      console.log('Reminders fetched successfully:', reminders)
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Alexa reminders synced successfully',
          data: { reminders: reminders.alerts || [] }
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