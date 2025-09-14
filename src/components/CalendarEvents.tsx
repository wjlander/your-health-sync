import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Clock, MapPin, RefreshCw, Plus, Settings } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CalendarEvent {
  id: string;
  event_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  is_health_related: boolean;
}

interface GoogleCalendar {
  id: string;
  name: string;
  description?: string;
  primary: boolean;
  accessRole: string;
  backgroundColor?: string;
}

const CalendarEvents = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('primary');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [isCalendarManager, setIsCalendarManager] = useState(false);

  useEffect(() => {
    if (user) {
      checkUserRole();
      fetchEvents();
      fetchCalendars();
      fetchSharedCalendarSettings();
    }
  }, [user]);

  const checkUserRole = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', user.id)
        .single();

      setIsCalendarManager(profile?.email === 'will@w-j-lander.uk');
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  };

  const fetchEvents = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: "Error",
        description: "Failed to fetch calendar events",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSharedCalendarSettings = async () => {
    try {
      const { data } = await supabase
        .from('shared_calendar_settings')
        .select('setting_value')
        .eq('setting_key', 'selected_calendar_id')
        .single();

      if (data?.setting_value) {
        const calendarId = JSON.parse(data.setting_value as string);
        if (typeof calendarId === 'string') {
          setSelectedCalendarId(calendarId);
        }
      }
    } catch (error) {
      console.error('Error fetching shared calendar settings:', error);
    }
  };

  const fetchCalendars = async () => {
    if (!user) return;

    setLoadingCalendars(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-google-calendars');
      
      if (error) throw error;
      
      if (data?.success && data?.data) {
        setCalendars(data.data);
      } else {
        throw new Error(data?.error || 'Failed to fetch calendars');
      }
    } catch (error) {
      console.error('Error fetching calendars:', error);
      toast({
        title: "Error",
        description: "Failed to fetch Google Calendars. Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setLoadingCalendars(false);
    }
  };

  const syncGoogleCalendar = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-calendar');
      
      if (error) throw error;
      
      if (data?.success) {
        toast({
          title: "Sync Complete",
          description: `Synced ${data.data?.newEvents || 0} new events and updated ${data.data?.updatedEvents || 0} events`,
        });
        
        fetchEvents();
      } else {
        throw new Error(data?.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Error syncing Google Calendar:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync Google Calendar. Please check your API configuration.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const updateSharedCalendarSettings = async (calendarId: string) => {
    if (!isCalendarManager) {
      toast({
        title: "Access Denied",
        description: "Only will@w-j-lander.uk can change calendar settings.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('shared_calendar_settings')
        .update({ 
          setting_value: JSON.stringify(calendarId),
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'selected_calendar_id');

      if (error) throw error;

      setSelectedCalendarId(calendarId);
      toast({
        title: "Calendar Updated",
        description: "Shared calendar settings updated for all users.",
      });
    } catch (error) {
      console.error('Error updating shared calendar settings:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update calendar settings.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const isUpcoming = (startTime: string) => {
    return new Date(startTime) > new Date();
  };

  const upcomingEvents = events.filter(event => isUpcoming(event.start_time));
  const pastEvents = events.filter(event => !isUpcoming(event.start_time));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Calendar Events</h2>
          <p className="text-muted-foreground">Manage your Google Calendar integration</p>
        </div>
        <div className="flex space-x-2">
          {isCalendarManager && (
            <Dialog open={calendarDialogOpen} onOpenChange={setCalendarDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={fetchCalendars}>
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Shared Calendar
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manage Shared Calendar</DialogTitle>
                <DialogDescription>
                  Choose which Google Calendar all users will sync events from. This setting affects all users.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Available Calendars (Shared for All Users)</Label>
                  {loadingCalendars ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <Select value={selectedCalendarId} onValueChange={setSelectedCalendarId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a calendar" />
                      </SelectTrigger>
                      <SelectContent>
                        {calendars.map((calendar) => (
                          <SelectItem key={calendar.id} value={calendar.id}>
                            <div className="flex items-center space-x-2">
                              <span>{calendar.name}</span>
                              {calendar.primary && (
                                <Badge variant="outline" className="text-xs">Primary</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={() => {
                      updateSharedCalendarSettings(selectedCalendarId);
                      setCalendarDialogOpen(false);
                    }}
                    disabled={!selectedCalendarId}
                    className="flex-1"
                  >
                    Update Shared Calendar
                  </Button>
                  <Button variant="outline" onClick={() => setCalendarDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          )}
          <Button
            onClick={syncGoogleCalendar}
            disabled={syncing}
            variant="outline"
          >
            {syncing ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {syncing ? 'Syncing...' : 'Sync Calendar'}
          </Button>
          <Button className="bg-health-primary hover:bg-health-secondary">
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-muted rounded w-full mb-2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-health-primary">Upcoming Events</h3>
              <div className="space-y-4">
                {upcomingEvents.map((event) => (
                  <Card key={event.id} className="border-l-4 border-l-health-primary">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-health-primary" />
                            <span>{event.title}</span>
                          </CardTitle>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatDate(event.start_time)} at {formatTime(event.start_time)}</span>
                            </span>
                            {event.end_time !== event.start_time && (
                              <span>- {formatTime(event.end_time)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          {event.is_health_related && (
                            <Badge className="bg-health-success">Health Related</Badge>
                          )}
                          <Badge variant="outline">Upcoming</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    {event.description && (
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Recent Past Events</h3>
              <div className="space-y-4">
                {pastEvents.slice(0, 5).map((event) => (
                  <Card key={event.id} className="opacity-75">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>{event.title}</span>
                          </CardTitle>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatDate(event.start_time)} at {formatTime(event.start_time)}</span>
                            </span>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          {event.is_health_related && (
                            <Badge variant="outline" className="text-health-success">Health Related</Badge>
                          )}
                          <Badge variant="secondary">Past</Badge>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {events.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <CardTitle className="mb-2">No Calendar Events</CardTitle>
                <CardDescription>
                  Click "Sync Calendar" to import events from the shared Google Calendar.
                  {!isCalendarManager && " Calendar settings are managed by will@w-j-lander.uk."}
                  {isCalendarManager && calendars.length === 0 && " Configure your Google API settings first."}
                </CardDescription>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarEvents;