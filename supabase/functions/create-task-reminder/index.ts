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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('=== CREATE TASK REMINDER ===');
    console.log('User ID:', user.id);

    const { task_id, title, description, due_date, assigned_to } = await req.json();

    console.log('Creating calendar reminder for task:', task_id);

    // Get Google API configuration for the user (either creator or assignee)
    let googleConfig = null;
    
    // First try to get config for assigned user if different from creator
    if (assigned_to && assigned_to !== user.id) {
      const { data: assigneeConfig } = await supabase
        .from('api_configurations')
        .select('*')
        .eq('user_id', assigned_to)
        .eq('service_name', 'google')
        .eq('is_active', true)
        .single();
      
      if (assigneeConfig) {
        googleConfig = assigneeConfig;
        console.log('Using assignee Google config');
      }
    }
    
    // Fall back to creator's config if no assignee config
    if (!googleConfig) {
      const { data: creatorConfig } = await supabase
        .from('api_configurations')
        .select('*')
        .eq('user_id', user.id)
        .eq('service_name', 'google')
        .eq('is_active', true)
        .single();
      
      googleConfig = creatorConfig;
      console.log('Using creator Google config');
    }

    if (!googleConfig) {
      return new Response(
        JSON.stringify({ error: 'Google Calendar not connected. Please connect to Google Calendar first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token needs refresh
    let accessToken = googleConfig.access_token;
    const expiresAt = new Date(googleConfig.expires_at);
    const now = new Date();

    if (expiresAt <= now) {
      console.log('Access token expired, refreshing...');
      
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: googleConfig.refresh_token,
          client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
        }),
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        console.error('Token refresh failed:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to refresh Google token. Please reconnect to Google Calendar.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenData = await refreshResponse.json();
      accessToken = tokenData.access_token;

      // Update the token in database
      const newExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
      
      await supabase
        .from('api_configurations')
        .update({
          access_token: accessToken,
          expires_at: newExpiresAt.toISOString(),
        })
        .eq('id', googleConfig.id);

      console.log('Token refreshed successfully');
    }

    // Create Google Calendar event
    const dueDateTime = new Date(due_date);
    const eventStartTime = new Date(dueDateTime.getTime() - 30 * 60 * 1000); // 30 minutes before due date
    
    const calendarEvent = {
      summary: `Task Reminder: ${title}`,
      description: description || `Task reminder for: ${title}`,
      start: {
        dateTime: eventStartTime.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: dueDateTime.toISOString(),
        timeZone: 'UTC',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 30 },
          { method: 'popup', minutes: 15 },
        ],
      },
    };

    console.log('Creating calendar event:', calendarEvent);

    const calendarResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(calendarEvent),
    });

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text();
      console.error('Calendar API error:', errorText);
      
      // Try with refreshed token if we get 401
      if (calendarResponse.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Google Calendar authorization expired. Please reconnect to Google Calendar.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to create calendar event: ' + errorText }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const eventData = await calendarResponse.json();
    console.log('Calendar event created:', eventData.id);

    // Update task with calendar event ID
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ 
        calendar_event_id: eventData.id,
        reminder_sent: true 
      })
      .eq('id', task_id);

    if (updateError) {
      console.error('Failed to update task:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        calendar_event_id: eventData.id,
        event_link: eventData.htmlLink
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-task-reminder function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});