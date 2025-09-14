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

    console.log('Processing scheduled notifications...');

    // Get all pending notifications that are due
    const now = new Date().toISOString();
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('scheduled_notifications')
      .select(`
        id,
        user_id,
        title,
        body,
        data,
        scheduled_for
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .limit(50); // Process max 50 at a time

    if (fetchError) {
      console.error('Error fetching pending notifications:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch pending notifications' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      console.log('No pending notifications found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No pending notifications to process',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${pendingNotifications.length} pending notifications`);

    const processedResults = [];

    for (const notification of pendingNotifications) {
      try {
        // Get FCM tokens for this user
        const { data: tokens, error: tokensError } = await supabase
          .from('fcm_tokens')
          .select('token')
          .eq('user_id', notification.user_id);

        if (tokensError || !tokens || tokens.length === 0) {
          console.error(`No FCM tokens found for user ${notification.user_id}`);
          
          // Mark as failed
          await supabase
            .from('scheduled_notifications')
            .update({ 
              status: 'failed', 
              error_message: 'No FCM tokens found',
              sent_at: new Date().toISOString()
            })
            .eq('id', notification.id);
          
          processedResults.push({
            id: notification.id,
            status: 'failed',
            error: 'No FCM tokens found'
          });
          continue;
        }

        // Send notification to all user tokens
        let successCount = 0;
        const errors = [];

        for (const tokenData of tokens) {
          try {
            const fcmPayload = {
              to: tokenData.token,
              notification: {
                title: notification.title,
                body: notification.body,
              },
              data: notification.data || {},
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
            
            if (fcmResult.success === 1) {
              successCount++;
              console.log(`✅ Sent notification ${notification.id} to token ${tokenData.token.substring(0, 10)}...`);
            } else {
              errors.push(fcmResult.results?.[0]?.error || 'Unknown FCM error');
              console.error(`❌ Failed to send notification ${notification.id}:`, fcmResult);
            }
          } catch (error) {
            errors.push(error.message);
            console.error('Error sending to FCM:', error);
          }
        }

        // Trigger webhooks if configured
        let webhookResults = {};
        if (notification.data?.includeIFTTT) {
          console.log('Triggering IFTTT webhook for scheduled notification...');
          webhookResults.ifttt = await triggerIFTTTWebhook(
            notification.user_id,
            notification.title,
            notification.body,
            notification.data,
            notification.data.iftttWebhookUrl,
            supabase
          );
        }
        
        if (notification.data?.includeN8N) {
          console.log('Triggering n8n webhook for scheduled notification...');
          webhookResults.n8n = await triggerN8NWebhook(
            notification.user_id,
            notification.title,
            notification.body,
            notification.data,
            notification.data.n8nWebhookUrl,
            supabase
          );
        }

        // Update notification status
        if (successCount > 0) {
          await supabase
            .from('scheduled_notifications')
            .update({ 
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', notification.id);
          
          processedResults.push({
            id: notification.id,
            status: 'sent',
            successCount: successCount,
            totalTokens: tokens.length,
            webhookResults
          });
        } else {
          await supabase
            .from('scheduled_notifications')
            .update({ 
              status: 'failed',
              error_message: errors.join(', '),
              sent_at: new Date().toISOString()
            })
            .eq('id', notification.id);
          
          processedResults.push({
            id: notification.id,
            status: 'failed',
            errors: errors,
            webhookResults
          });
        }

      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error);
        
        // Mark as failed
        await supabase
          .from('scheduled_notifications')
          .update({ 
            status: 'failed',
            error_message: error.message,
            sent_at: new Date().toISOString()
          })
          .eq('id', notification.id);
        
        processedResults.push({
          id: notification.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    const successfulCount = processedResults.filter(r => r.status === 'sent').length;
    const failedCount = processedResults.filter(r => r.status === 'failed').length;

    console.log(`✅ Processing complete: ${successfulCount} sent, ${failedCount} failed`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Scheduled notifications processed',
      processed: processedResults.length,
      successful: successfulCount,
      failed: failedCount,
      results: processedResults
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-scheduled-notifications function:', error);
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