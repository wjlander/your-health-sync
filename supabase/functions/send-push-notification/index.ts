import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const firebaseServerKey = Deno.env.get('FIREBASE_SERVER_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !firebaseServerKey) {
      throw new Error('Missing configuration - ensure FIREBASE_SERVER_KEY is set');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user from JWT token
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { title, body, data, scheduleFor, immediate = false, includeIFTTT = false, iftttWebhookUrl } = await req.json();
    console.log('Request body:', { title, body, data, scheduleFor, immediate, includeIFTTT });

    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'Title and body are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing notification request:', { title, body, scheduleFor, immediate, userId: user.id });

    if (immediate) {
      // Send notification immediately
      const { data: tokens, error: tokensError } = await supabase
        .from('fcm_tokens')
        .select('token')
        .eq('user_id', user.id);

      if (tokensError) {
        console.error('Error fetching FCM tokens:', tokensError);
        return new Response(JSON.stringify({ error: 'Failed to fetch FCM tokens' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!tokens || tokens.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'No FCM tokens found for user',
          message: 'Please ensure the app is registered for push notifications'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Send to Firebase Cloud Messaging
      const results = [];
      for (const tokenData of tokens) {
        try {
          const fcmPayload = {
            to: tokenData.token,
            notification: {
              title: title,
              body: body,
            },
            data: data || {},
          };

          const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
              'Authorization': `key=${firebaseServerKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(fcmPayload),
          });

          const fcmResult = await fcmResponse.json();
          results.push({ token: tokenData.token, result: fcmResult });
          
          console.log('FCM Response:', fcmResult);
        } catch (error) {
          console.error('Error sending to FCM:', error);
          results.push({ token: tokenData.token, error: error.message });
        }
      }

      // Also trigger IFTTT webhook if requested
      let iftttResult = null;
      if (includeIFTTT) {
        console.log('Triggering IFTTT webhook...');
        iftttResult = await triggerIFTTTWebhook(user.id, title, body, data, iftttWebhookUrl, supabase);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Immediate notification sent',
        results: results,
        iftttResult
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Schedule notification for later
      if (!scheduleFor) {
        return new Response(JSON.stringify({ error: 'scheduleFor is required when not sending immediately' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const notificationData = {
        user_id: user.id,
        title: title,
        body: body,
        data: {
          ...(data || {}),
          includeIFTTT,
          iftttWebhookUrl: includeIFTTT ? iftttWebhookUrl : undefined
        },
        scheduled_for: scheduleFor,
      };

      const { data: scheduledData, error: scheduleError } = await supabase
        .from('scheduled_notifications')
        .insert(notificationData)
        .select()
        .single();

      if (scheduleError) {
        console.error('Error scheduling notification:', scheduleError);
        return new Response(JSON.stringify({ error: 'Failed to schedule notification' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('✅ Notification scheduled successfully:', scheduledData);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Notification scheduled successfully',
        notificationId: scheduledData.id,
        scheduledFor: scheduledData.scheduled_for
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in send-push-notification function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Function to trigger IFTTT webhook
async function triggerIFTTTWebhook(
  userId: string, 
  title: string, 
  body: string, 
  data: any, 
  customWebhookUrl?: string,
  supabase?: any
) {
  try {
    let webhookUrl = customWebhookUrl;
    
    // If no custom webhook URL provided, try to get it from user's API configurations
    if (!webhookUrl && supabase) {
      console.log('Looking up IFTTT webhook URL for user:', userId);
      const { data: iftttConfig } = await supabase
        .from('api_configurations')
        .select('api_key')
        .eq('user_id', userId)
        .eq('service_name', 'ifttt')
        .single();
      
      if (iftttConfig?.api_key) {
        webhookUrl = iftttConfig.api_key; // Store webhook URL in api_key field
      }
    }

    if (!webhookUrl) {
      console.log('No IFTTT webhook URL configured for user');
      return { success: false, error: 'No IFTTT webhook URL configured' };
    }

    console.log('Triggering IFTTT webhook:', webhookUrl.substring(0, 50) + '...');

    const iftttPayload = {
      value1: title,
      value2: body,
      value3: JSON.stringify(data || {}),
      timestamp: new Date().toISOString(),
      user_id: userId
    };

    const iftttResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(iftttPayload)
    });

    console.log('IFTTT Response status:', iftttResponse.status);

    if (iftttResponse.ok) {
      return { success: true, status: iftttResponse.status };
    } else {
      const errorText = await iftttResponse.text();
      console.error('IFTTT webhook failed:', errorText);
      return { success: false, error: errorText };
    }

  } catch (error) {
    console.error('Error triggering IFTTT webhook:', error);
    return { success: false, error: error.message };
  }
}