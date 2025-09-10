import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Clock, MapPin, RefreshCw, Plus } from 'lucide-react';
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

const CalendarEvents = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchEvents();
    }
  }, [user]);

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

  const syncGoogleCalendar = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-calendar');
      
      if (error) throw error;
      
      toast({
        title: "Sync Complete",
        description: "Google Calendar events have been synced successfully",
      });
      
      fetchEvents();
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
                  Click "Sync Calendar" to import your Google Calendar events, or configure your Google API settings first.
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