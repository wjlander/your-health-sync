import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { makeGoogleApiCall } from '../_shared/token-refresh.ts';

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
    console.log('=== ADD CALENDAR EVENT ===');
    
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

    console.log('User found:', user.id);

    const { title, description, start_datetime, end_datetime, all_day } = await req.json();

    if (!title?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Event title is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Adding event to shared calendar:', title);

    // Get the shared calendar ID from settings
    const { data: calendarSettings } = await supabase
      .from('shared_calendar_settings')
      .select('setting_value')
      .eq('setting_key', 'selected_calendar_id')
      .single();
    
    const calendarId = calendarSettings?.setting_value || 'primary';
    console.log('Using calendar ID:', calendarId);

    // Create Google Calendar event
    const eventData: any = {
      summary: title,
      description: description || '',
    };

    if (all_day) {
      // For all-day events, use date format
      eventData.start = { date: start_datetime.split('T')[0] };
      eventData.end = { date: end_datetime.split('T')[0] };
    } else {
      // For timed events, use dateTime format with proper ISO string
      const startDate = new Date(start_datetime);
      const endDate = new Date(end_datetime);
      
      eventData.start = { 
        dateTime: startDate.toISOString(),
        timeZone: 'UTC'
      };
      eventData.end = { 
        dateTime: endDate.toISOString(),
        timeZone: 'UTC'
      };
    }

    console.log('Creating calendar event:', eventData);

    // Use the shared Google configuration to add the event
    const userId = 'b7318f45-ae52-49f4-9db5-1662096679dd'; // will@w-j-lander.uk
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    
    const response = await makeGoogleApiCall(supabase, userId, url, {
      method: 'POST',
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Calendar API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to create calendar event: ' + errorText }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const createdEvent = await response.json();
    console.log('Calendar event created:', createdEvent.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        event_id: createdEvent.id,
        event_link: createdEvent.htmlLink
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in add-calendar-event function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});