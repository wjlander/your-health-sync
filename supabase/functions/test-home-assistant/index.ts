import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create Supabase client with the user's token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the user from the token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get Home Assistant configuration for the user
    const { data: config, error: configError } = await supabase
      .from('api_configurations')
      .select('api_key')
      .eq('user_id', user.id)
      .eq('service_name', 'home_assistant')
      .single();

    if (configError || !config?.api_key) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Home Assistant configuration not found. Please set up your Home Assistant base URL first.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const baseUrl = config.api_key;
    let webhookUrl;
    
    // Handle both base URL and full webhook URL formats
    if (baseUrl.includes('/api/webhook/')) {
      // If it's already a full webhook URL, use it as-is but replace the webhook ID
      const urlBase = baseUrl.split('/api/webhook/')[0];
      webhookUrl = `${urlBase}/api/webhook/lovable_alexa_announce`;
    } else {
      // If it's a base URL, append the webhook path
      const cleanUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
      webhookUrl = `${cleanUrl}/api/webhook/lovable_alexa_announce`;
    }

    // Test the webhook
    const testPayload = {
      message: "Test announcement from Lovable. This is a test notification from your routine reminder app."
    };

    console.log(`Testing webhook URL: ${webhookUrl}`);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    console.log(`Webhook response status: ${response.status}`);

    if (response.ok) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Test announcement sent successfully! Check your Alexa devices.',
          status: response.status
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } else {
      const errorText = await response.text();
      console.log(`Webhook error response: ${errorText}`);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Home Assistant returned status ${response.status}. Make sure your automation is set up correctly and Home Assistant is accessible.`,
          details: errorText
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('Error testing Home Assistant webhook:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Failed to connect to Home Assistant: ${error.message}. Check your URL and network connectivity.`
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});