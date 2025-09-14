import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== DELETE CALENDAR EVENT ===');
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

    const { eventId } = await req.json();
    
    if (!eventId) {
      throw new Error('Missing required field: eventId');
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

    console.log('Shared Google configuration found, deleting calendar event...');

    // Delete the event from Google Calendar
    const deleteResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${access_token}`,
      }
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error('Google Calendar API error:', errorText);
      
      if (deleteResponse.status === 401) {
        throw new Error('Google authorization expired. Administrator needs to reconnect Google account.');
      }
      
      // If event doesn't exist, that's ok - continue with local deletion
      if (deleteResponse.status !== 404 && deleteResponse.status !== 410) {
        throw new Error(`Failed to delete calendar event: ${deleteResponse.statusText}`);
      }
    }

    console.log('Calendar event deleted from Google Calendar');

    // Delete the local database record
    const { error: dbError } = await supabase
      .from('calendar_events')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', user.id);

    if (dbError) {
      console.error('Database delete error:', dbError);
      throw new Error('Failed to delete local calendar event record');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Calendar event deleted successfully'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to delete calendar event'
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