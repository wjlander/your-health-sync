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

    const { title, body, data, scheduleFor, immediate = false, includeIFTTT = false, iftttWebhookUrl, includeN8N = false, n8nWebhookUrl, includeHomeAssistant = false, homeAssistantWebhookUrl } = await req.json();
    console.log('Request body:', { title, body, data, scheduleFor, immediate, includeIFTTT, includeN8N, includeHomeAssistant });

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

      // Also trigger n8n webhook if requested
      let n8nResult = null;
      if (includeN8N) {
        console.log('Triggering n8n webhook...');
        n8nResult = await triggerN8NWebhook(user.id, title, body, data, n8nWebhookUrl, supabase);
      }

      // Also trigger Home Assistant webhook if requested
      let homeAssistantResult = null;
      if (includeHomeAssistant) {
        console.log('Triggering Home Assistant webhook...');
        homeAssistantResult = await triggerHomeAssistantWebhook(user.id, title, body, data, homeAssistantWebhookUrl, supabase);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Immediate notification sent',
        results: results,
        iftttResult,
        n8nResult,
        homeAssistantResult
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
          iftttWebhookUrl: includeIFTTT ? iftttWebhookUrl : undefined,
          includeN8N,
          n8nWebhookUrl: includeN8N ? n8nWebhookUrl : undefined,
          includeHomeAssistant,
          homeAssistantWebhookUrl: includeHomeAssistant ? homeAssistantWebhookUrl : undefined
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

// Function to trigger n8n webhook
async function triggerN8NWebhook(
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
      console.log('Looking up n8n webhook URL for user:', userId);
      const { data: n8nConfig } = await supabase
        .from('api_configurations')
        .select('api_key')
        .eq('user_id', userId)
        .eq('service_name', 'n8n')
        .single();
      
      if (n8nConfig?.api_key) {
        webhookUrl = n8nConfig.api_key; // Store webhook URL in api_key field
      }
    }

    if (!webhookUrl) {
      console.log('No n8n webhook URL configured for user');
      return { success: false, error: 'No n8n webhook URL configured' };
    }

    console.log('Triggering n8n webhook:', webhookUrl.substring(0, 50) + '...');

    const n8nPayload = {
      title: title,
      body: body,
      data: data || {},
      timestamp: new Date().toISOString(),
      userId: userId,
      source: 'lovable-push-notification'
    };

    const n8nResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(n8nPayload)
    });

    console.log('n8n Response status:', n8nResponse.status);

    if (n8nResponse.ok) {
      return { success: true, status: n8nResponse.status };
    } else {
      const errorText = await n8nResponse.text();
      console.error('n8n webhook failed:', errorText);
      return { success: false, error: errorText };
    }

  } catch (error) {
    console.error('Error triggering n8n webhook:', error);
    return { success: false, error: error.message };
  }
}

// Function to trigger Home Assistant webhook
async function triggerHomeAssistantWebhook(
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
      console.log('Looking up Home Assistant webhook URL for user:', userId);
      const { data: homeAssistantConfig } = await supabase
        .from('api_configurations')
        .select('api_key')
        .eq('user_id', userId)
        .eq('service_name', 'home_assistant')
        .single();
      
      if (homeAssistantConfig?.api_key) {
        webhookUrl = homeAssistantConfig.api_key; // Store webhook URL in api_key field
      }
    }

    if (!webhookUrl) {
      console.log('No Home Assistant webhook URL configured for user');
      return { success: false, error: 'No Home Assistant webhook URL configured' };
    }

    console.log('Triggering Home Assistant webhook:', webhookUrl.substring(0, 50) + '...');

    // Home Assistant webhook payload optimized for TTS
    const homeAssistantPayload = {
      title: title,
      message: body,
      data: data || {},
      timestamp: new Date().toISOString(),
      user_id: userId,
      tts_message: `${title}. ${body}`, // Combined message for text-to-speech
      source: 'lovable-routine-reminder'
    };

    const homeAssistantResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(homeAssistantPayload)
    });

    console.log('Home Assistant Response status:', homeAssistantResponse.status);

    if (homeAssistantResponse.ok) {
      return { success: true, status: homeAssistantResponse.status };
    } else {
      const errorText = await homeAssistantResponse.text();
      console.error('Home Assistant webhook failed:', errorText);
      return { success: false, error: errorText };
    }

  } catch (error) {
    console.error('Error triggering Home Assistant webhook:', error);
    return { success: false, error: error.message };
  }
}