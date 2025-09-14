import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== UPDATE CALENDAR EVENT ===');
  console.log('Method:', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    console.log('Getting user from auth header...');
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized');
    }

    console.log('User found:', user.id);

    const { eventId, title, description, startTime, endTime } = await req.json();
    
    if (!eventId || !title || !startTime || !endTime) {
      throw new Error('Missing required fields: eventId, title, startTime, endTime');
    }

    // Get shared Google configuration
    console.log('Fetching shared Google configuration...');
    const { data: sharedConfig, error: configError } = await supabase
      .from('master_google_config')
      .select('*')
      .eq('service_name', 'google')
      .single();

    if (configError || !sharedConfig) {
      console.error('No shared Google configuration found:', configError);
      throw new Error('Google Calendar not configured. Administrator needs to set up Google integration.');
    }

    const { access_token, refresh_token } = sharedConfig;

    if (!access_token) {
      throw new Error('No access token available. Please reconnect Google account.');
    }

    console.log('Shared Google configuration found, updating calendar event...');

    // Update the event in Google Calendar
    const updateResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: title,
        description: description || '',
        start: {
          dateTime: new Date(startTime).toISOString(),
          timeZone: 'UTC'
        },
        end: {
          dateTime: new Date(endTime).toISOString(),
          timeZone: 'UTC'
        }
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('Google Calendar API error:', errorText);
      
      if (updateResponse.status === 401) {
        throw new Error('Google authorization expired. Administrator needs to reconnect Google account.');
      }
      
      throw new Error(`Failed to update calendar event: ${updateResponse.statusText}`);
    }

    const updatedEvent = await updateResponse.json();
    console.log('Calendar event updated successfully');

    // Update the local database record
    const { error: dbError } = await supabase
      .from('calendar_events')
      .update({
        title,
        description: description || null,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('event_id', eventId)
      .eq('user_id', user.id);

    if (dbError) {
      console.error('Database update error:', dbError);
      throw new Error('Failed to update local calendar event record');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Calendar event updated successfully',
        event: updatedEvent
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error updating calendar event:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to update calendar event'
      }),
      { 
        status: 400, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});