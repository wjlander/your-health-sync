import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Clock, Settings, RefreshCw, Plus } from 'lucide-react';
import { AddEventForm } from './AddEventForm';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  event_id?: string;
  is_health_related: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

const CalendarEvents = () => {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [selectedCalendarId, setSelectedCalendarId] = useState('');
  const [calendars, setCalendars] = useState<any[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [selectedCalendarName, setSelectedCalendarName] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Check if current user is the calendar manager (will@w-j-lander.uk)
  const isCalendarManager = user?.id === 'b7318f45-ae52-49f4-9db5-1662096679dd';

  useEffect(() => {
    if (user) {
      fetchEvents();
      fetchSharedCalendarSettings();
    }
  }, [user]);

  const fetchSharedCalendarSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('shared_calendar_settings')
        .select('setting_value, updated_at')
        .eq('setting_key', 'selected_calendar_id')
        .single();

      if (error) {
        console.log('No shared calendar settings found:', error);
        return;
      }

      if (data?.setting_value) {
        // Handle both old string format and new object format
        let calendarId: string;
        let calendarName: string = '';
        
        if (typeof data.setting_value === 'string') {
          calendarId = data.setting_value.replace(/"/g, ''); // Clean up any extra quotes
        } else if (data.setting_value && typeof data.setting_value === 'object') {
          const settingObj = data.setting_value as { calendar_id?: string; calendar_name?: string };
          calendarId = (settingObj.calendar_id || '').replace(/"/g, ''); // Clean up any extra quotes
          calendarName = settingObj.calendar_name || '';
        } else {
          return;
        }
        
        setSelectedCalendarId(calendarId);
        setSelectedCalendarName(calendarName);
        setLastSyncTime(data.updated_at);
        console.log('Loaded shared calendar:', { calendarId, calendarName });
      }
    } catch (error) {
      console.error('Error fetching shared settings:', error);
    }
  };

  // Auto-sync every 15 minutes
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(() => {
      console.log('Auto-syncing calendar...');
      handleSync();
    }, 15 * 60 * 1000); // 15 minutes in milliseconds

    return () => clearInterval(interval);
  }, [user]);

  const handleAddEvent = async (eventData: any) => {
    try {
      const response = await supabase.functions.invoke('add-calendar-event', {
        body: eventData
      });

      if (response.error) throw response.error;

      toast({
        title: 'Event Added',
        description: 'Event has been added to the shared calendar.',
      });
      
      setShowAddEventDialog(false);
      fetchEvents(); // Refresh events
    } catch (error: any) {
      console.error('Error adding event:', error);
      toast({
        title: 'Error',
        description: 'Failed to add event to calendar.',
        variant: 'destructive',
      });
    }
  };

  const updateSharedCalendarSetting = async (calendarId: string) => {
    if (!isCalendarManager) {
      toast({
        title: "Access Denied",
        description: "Only the calendar administrator can change these settings.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSyncing(true);
      
      // First clear all existing calendar events for all users
      const { error: clearError } = await supabase
        .from('calendar_events')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all events
      
      if (clearError) {
        console.error('Error clearing events:', clearError);
      }

      // Find the calendar name for storage
      const selectedCalendar = calendars.find((cal: any) => cal.id === calendarId);
      const calendarName = selectedCalendar?.name || '';

      // Update the shared calendar setting with both ID and name
      const { error } = await supabase
        .from('shared_calendar_settings')
        .update({
          setting_value: {
            calendar_id: calendarId,
            calendar_name: calendarName
          },
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'selected_calendar_id');

      if (error) throw error;

      setSelectedCalendarId(calendarId);
      setSelectedCalendarName(calendarName);
      
      // Automatically sync the new calendar
      const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-google-calendar');
      
      if (syncError) throw syncError;
      
      if (syncData?.success) {
        toast({
          title: "Calendar Updated & Synced",
          description: `Calendar switched and synced ${syncData.data?.newEvents || 0} events from the new calendar.`,
        });
      } else {
        toast({
          title: "Calendar Updated",
          description: "Calendar selection updated. Manual sync may be needed.",
        });
      }
      
      // Refresh events display
      fetchEvents();
      
    } catch (error) {
      console.error('Error updating shared settings:', error);
      toast({
        title: "Error",
        description: "Failed to update calendar settings.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
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
        title: 'Error',
        description: 'Failed to fetch calendar events.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendars = async () => {
    if (!isCalendarManager) {
      toast({
        title: "Access Denied",
        description: "Only the calendar administrator can manage these settings.",
        variant: "destructive",
      });
      return;
    }

    console.log('fetchCalendars called, isCalendarManager:', isCalendarManager);
    console.log('Current user ID:', user?.id);
    console.log('Expected manager ID:', 'b7318f45-ae52-49f4-9db5-1662096679dd');

    setLoadingCalendars(true);
    try {
      console.log('Calling list-google-calendars function...');
      const { data, error } = await supabase.functions.invoke('list-google-calendars');
      
      console.log('Function response:', { data, error });
      
      if (error) throw error;
      
      if (data?.success && data?.data) {
        console.log('Available calendars:', data.data);
        setCalendars(data.data);
        
        // Set current selection if we don't have one
        if (!selectedCalendarId && data.data.length > 0) {
          const primaryCalendar = data.data.find((cal: any) => cal.primary);
          if (primaryCalendar) {
            console.log('Setting primary calendar as default:', primaryCalendar.id);
            setSelectedCalendarId(primaryCalendar.id);
          }
        }
        
        // Update calendar name for display
        if (selectedCalendarId) {
          const selectedCalendar = data.data.find((cal: any) => cal.id === selectedCalendarId);
          if (selectedCalendar) {
            console.log('Found selected calendar name:', selectedCalendar.name);
            setSelectedCalendarName(selectedCalendar.name);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching calendars:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch Google calendars. Make sure Google integration is connected.',
        variant: 'destructive',
      });
    } finally {
      setLoadingCalendars(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-calendar');
      
      if (error) throw error;
      
      if (data?.success) {
        setLastSyncTime(new Date().toISOString());
        toast({
          title: "Sync Complete",
          description: `Synced ${data.data?.newEvents || 0} new events and updated ${data.data?.updatedEvents || 0} events from shared calendar`,
        });
        
        fetchEvents();
      } else {
        throw new Error(data?.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Error syncing Google Calendar:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync shared Google Calendar. The administrator may need to reconnect the account.",
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
          <p className="text-muted-foreground">
            {isCalendarManager 
              ? "Manage shared Google Calendar integration for all users" 
              : "View events from the shared Google Calendar"}
          </p>
        </div>
        <div className="flex space-x-2">
          {isCalendarManager && (
            <Dialog open={calendarDialogOpen} onOpenChange={setCalendarDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={fetchCalendars}>
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Calendar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Manage Shared Calendar</DialogTitle>
                  <DialogDescription>
                    Choose which Google Calendar all users will sync events from. This affects all users in the system.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Available Calendars</Label>
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
                      onClick={async () => {
                        await updateSharedCalendarSetting(selectedCalendarId);
                        setCalendarDialogOpen(false);
                      }}
                      disabled={!selectedCalendarId || syncing}
                      className="flex-1"
                    >
                      {syncing ? 'Updating & Syncing...' : 'Update Shared Calendar'}
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
            onClick={handleSync}
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
          <Dialog open={showAddEventDialog} onOpenChange={setShowAddEventDialog}>
            <DialogTrigger asChild>
              <Button className="bg-health-primary hover:bg-health-secondary">
                <Plus className="h-4 w-4 mr-2" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Calendar Event</DialogTitle>
              </DialogHeader>
              <AddEventForm 
                onSave={handleAddEvent} 
                onCancel={() => setShowAddEventDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Calendar Status Section */}
      <Card className="bg-muted/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-health-primary" />
            <span>Calendar Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Connected Calendar:</span>
            <div className="flex items-center space-x-2">
              {selectedCalendarName ? (
                <span className="text-sm">{selectedCalendarName}</span>
              ) : selectedCalendarId ? (
                <span className="text-sm text-muted-foreground">{selectedCalendarId}</span>
              ) : (
                <span className="text-sm text-muted-foreground">No calendar selected</span>
              )}
              {selectedCalendarId && (
                <Badge variant="outline" className="text-xs">Connected</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Last Sync:</span>
            <span className="text-sm text-muted-foreground">
              {lastSyncTime ? (
                <>
                  {new Date(lastSyncTime).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </>
              ) : (
                'Never synced'
              )}
            </span>
          </div>
          {!isCalendarManager && !selectedCalendarId && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
              No calendar configured. Contact the administrator to set up calendar integration.
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-5 bg-muted rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
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
                  {!isCalendarManager && " The administrator needs to configure the Google Calendar connection first."}
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