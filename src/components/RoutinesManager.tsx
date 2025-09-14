import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Target, Clock, RefreshCw, Plus, Play, Pause, Trash2, Edit, Bell } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Routine {
  id: string;
  title: string;
  description?: string;
  routine_type: string;
  schedule_days?: number[];
  schedule_time?: string;
  reminder_times?: string[];
  duration_days?: number;
  start_date?: string;
  is_active: boolean;
  amazon_routine_id?: string;
  created_at: string;
}

const RoutinesManager = () => {
  const { user } = useAuth();
  const { isInitialized, scheduleRoutineReminders } = usePushNotifications();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  
  const [newRoutine, setNewRoutine] = useState({
    title: '',
    description: '',
    routine_type: 'amazon',
    schedule_days: [] as number[],
    schedule_time: '',
    reminder_times: [] as string[],
    duration_days: 7,
    start_date: new Date().toISOString().split('T')[0],
  });

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    if (user) {
      fetchRoutines();
    }
  }, [user]);

  const fetchRoutines = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRoutines(data || []);
    } catch (error) {
      console.error('Error fetching routines:', error);
      toast({
        title: "Error",
        description: "Failed to fetch routines",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const syncAmazonRoutines = async () => {
    setSyncing(true);
    try {
      console.log('Syncing Alexa reminders...');
      const { data, error } = await supabase.functions.invoke('sync-alexa-reminders', {
        body: { action: 'list' }
      });

      if (error) {
        console.error('Function invocation error:', error);
        toast({
          title: "Sync Failed",
          description: `Failed to sync Alexa reminders: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      if (data.error) {
        console.error('Alexa API error:', data.error);
        toast({
          title: "Alexa Connection Issue",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      console.log('Alexa sync result:', data);
      toast({
        title: "Alexa Sync Complete",
        description: data.message || "Successfully synced with Alexa reminders",
      });

    } catch (error) {
      console.error('Unexpected error during Alexa sync:', error);
      toast({
        title: "Sync Error",
        description: "An unexpected error occurred while syncing Alexa reminders",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateRoutine = async () => {
    if (!user || !newRoutine.title) return;

    try {
      let amazonReminderId = null;
      
      // If this is an Amazon routine, try to create it via Alexa API
      if (newRoutine.routine_type === 'amazon') {
        try {
          const reminderTimes = newRoutine.reminder_times.length > 0 
            ? newRoutine.reminder_times 
            : (newRoutine.schedule_time ? [newRoutine.schedule_time] : ['09:00']);
          
          // Create reminders for each scheduled time
          for (const time of reminderTimes) {
            const [hours, minutes] = time.split(':');
            const scheduledDate = new Date(newRoutine.start_date);
            scheduledDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            
            // If the time has already passed today, schedule for tomorrow
            if (scheduledDate < new Date()) {
              scheduledDate.setDate(scheduledDate.getDate() + 1);
            }
            
            const reminderData = {
              action: 'create',
              reminder: {
                title: newRoutine.title,
                text: `${newRoutine.title}${newRoutine.description ? ': ' + newRoutine.description : ''}`,
                scheduledTime: scheduledDate.toISOString(),
                ...(newRoutine.schedule_days.length > 0 && {
                  recurrence: {
                    freq: 'DAILY',
                    byDay: newRoutine.schedule_days.map(day => ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][day])
                  }
                })
              }
            };
            
            const { data: alexaResult, error: alexaError } = await supabase.functions.invoke('sync-alexa-reminders', {
              body: reminderData
            });
            
            if (alexaError) throw alexaError;
            
            if (alexaResult?.success) {
              amazonReminderId = alexaResult.data?.reminderId;
              toast({
                title: "Alexa Reminder Created",
                description: `Successfully created reminder "${newRoutine.title}" on your Alexa device`,
              });
            } else {
              throw new Error(alexaResult?.error || 'Failed to create Alexa reminder');
            }
          }
      } catch (alexaError) {
        console.error('Error creating Alexa reminder:', alexaError);
        
        // Check if this is a permissions/auth error that requires reconnection
        if (alexaError.message?.includes('requiresReauth') || alexaError.message?.includes('UNAUTHORIZED')) {
          toast({
            title: "Alexa Reconnection Required", 
            description: "Your Alexa connection expired or lacks reminders permission. Please reconnect your Amazon account.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Alexa Reminder Failed", 
            description: `Could not create Alexa reminder: ${alexaError.message}. Creating local reminder instead.`,
            variant: "destructive",
          });
        }
      }
      }

      // Always create the local routine record
      const { error } = await supabase
        .from('routines')
        .insert({
          user_id: user.id,
          title: newRoutine.title,
          description: newRoutine.description,
          routine_type: newRoutine.routine_type,
          schedule_days: newRoutine.schedule_days.length > 0 ? newRoutine.schedule_days : null,
          schedule_time: newRoutine.schedule_time || null,
          reminder_times: newRoutine.reminder_times.length > 0 ? newRoutine.reminder_times : null,
          duration_days: newRoutine.duration_days,
          start_date: newRoutine.start_date,
          is_active: true,
          amazon_routine_id: amazonReminderId,
        });

      if (error) throw error;

      toast({
        title: "Routine Created",
        description: amazonReminderId 
          ? "Your Alexa reminder and local routine have been created successfully"
          : "Your local routine has been created successfully",
      });

      setNewRoutine({
        title: '',
        description: '',
        routine_type: 'amazon',
        schedule_days: [],
        schedule_time: '',
        reminder_times: [],
        duration_days: 7,
        start_date: new Date().toISOString().split('T')[0],
      });
      setDialogOpen(false);
      fetchRoutines();

      // Schedule mobile notifications for the new routine if it has reminder times
      if (newRoutine.reminder_times && newRoutine.reminder_times.length > 0) {
        try {
          const routineForNotification = {
            id: `temp-${Date.now()}`, // Temporary ID for notification scheduling
            title: newRoutine.title,
            description: newRoutine.description,
            routine_type: newRoutine.routine_type,
            reminder_times: newRoutine.reminder_times
          };
          await scheduleRoutineReminders(routineForNotification);
          toast({
            title: "Mobile Notifications Scheduled",
            description: "Local reminders have been scheduled on your device!",
          });
        } catch (error) {
          console.error('Error scheduling mobile notifications:', error);
        }
      }
    } catch (error) {
      console.error('Error creating routine:', error);
      toast({
        title: "Create Failed",
        description: "Failed to create routine",
        variant: "destructive",
      });
    }
  };

  const toggleRoutine = async (routine: Routine) => {
    try {
      const { error } = await supabase
        .from('routines')
        .update({ is_active: !routine.is_active })
        .eq('id', routine.id);

      if (error) throw error;

      toast({
        title: routine.is_active ? "Routine Paused" : "Routine Activated",
        description: `${routine.title} has been ${routine.is_active ? 'paused' : 'activated'}`,
      });

      fetchRoutines();
    } catch (error) {
      console.error('Error toggling routine:', error);
      toast({
        title: "Toggle Failed",
        description: "Failed to toggle routine status",
        variant: "destructive",
      });
    }
  };

  const deleteRoutine = async (routine: Routine) => {
    if (!confirm(`Are you sure you want to delete "${routine.title}"?`)) return;

    try {
      const { error } = await supabase
        .from('routines')
        .delete()
        .eq('id', routine.id);

      if (error) throw error;

      toast({
        title: "Routine Deleted",
        description: "The routine has been deleted successfully",
      });

      fetchRoutines();
    } catch (error) {
      console.error('Error deleting routine:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete routine",
        variant: "destructive",
      });
    }
  };

  const handleDayToggle = (day: string) => {
    const dayIndex = daysOfWeek.indexOf(day);
    if (newRoutine.schedule_days.includes(dayIndex)) {
      setNewRoutine({
        ...newRoutine,
        schedule_days: newRoutine.schedule_days.filter(d => d !== dayIndex)
      });
    } else {
      setNewRoutine({
        ...newRoutine,
        schedule_days: [...newRoutine.schedule_days, dayIndex]
      });
    }
  };

  const formatSchedule = (routine: Routine) => {
    const parts = [];
    
    if (routine.schedule_days && routine.schedule_days.length > 0) {
      if (routine.schedule_days.length === 7) {
        parts.push('Daily');
      } else {
        parts.push(routine.schedule_days.join(', '));
      }
    }
    
    if (routine.reminder_times && routine.reminder_times.length > 0) {
      parts.push(`at ${routine.reminder_times.join(', ')}`);
    } else if (routine.schedule_time) {
      parts.push(`at ${routine.schedule_time}`);
    }

    if (routine.duration_days) {
      parts.push(`for ${routine.duration_days} days`);
    }
    
    return parts.join(' ') || 'No schedule set';
  };

  const addReminderTime = () => {
    setNewRoutine({
      ...newRoutine,
      reminder_times: [...newRoutine.reminder_times, '09:00']
    });
  };

  const updateReminderTime = (index: number, time: string) => {
    const updatedTimes = [...newRoutine.reminder_times];
    updatedTimes[index] = time;
    setNewRoutine({
      ...newRoutine,
      reminder_times: updatedTimes
    });
  };

  const removeReminderTime = (index: number) => {
    setNewRoutine({
      ...newRoutine,
      reminder_times: newRoutine.reminder_times.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="space-y-6 min-h-0 flex-1 overflow-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Routines & Reminders</h2>
          <p className="text-muted-foreground">Manage your wellness reminders</p>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={async () => {
              try {
                // Schedule notifications for all active routines
                for (const routine of routines.filter(r => r.is_active)) {
                  await scheduleRoutineReminders(routine);
                }
                toast({
                  title: "Mobile Notifications Scheduled",
                  description: "All routine reminders have been scheduled on your device!",
                });
              } catch (error) {
                toast({
                  title: "Error",
                  description: "Failed to schedule mobile notifications",
                  variant: "destructive",
                });
              }
            }}
            variant="outline"
          >
            <Bell className="h-4 w-4 mr-2" />
            Setup Mobile Alerts
          </Button>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-health-primary hover:bg-health-secondary">
                <Plus className="h-4 w-4 mr-2" />
                Create Routine
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Create New Routine</DialogTitle>
                <DialogDescription>
                  Set up a new routine or reminder for your wellness goals.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Routine Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Morning Workout Reminder"
                    value={newRoutine.title}
                    onChange={(e) => setNewRoutine({ ...newRoutine, title: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your routine..."
                    value={newRoutine.description}
                    onChange={(e) => setNewRoutine({ ...newRoutine, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Routine Type</Label>
                  <Select
                    value={newRoutine.routine_type}
                    onValueChange={(value) => setNewRoutine({ ...newRoutine, routine_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select routine type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amazon">Amazon Alexa</SelectItem>
                      <SelectItem value="wellness">Wellness Reminder</SelectItem>
                      <SelectItem value="medication">Medication Reminder</SelectItem>
                      <SelectItem value="exercise">Exercise Routine</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Schedule Days</Label>
                  <div className="flex flex-wrap gap-2">
                    {daysOfWeek.map((day) => (
                      <Button
                        key={day}
                        variant={newRoutine.schedule_days.includes(daysOfWeek.indexOf(day)) ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleDayToggle(day)}
                        className={newRoutine.schedule_days.includes(daysOfWeek.indexOf(day)) 
                          ? "bg-health-primary hover:bg-health-secondary" 
                          : ""
                        }
                      >
                        {day.slice(0, 3)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Single Time (Optional)</Label>
                  <Input
                    id="time"
                    type="time"
                    value={newRoutine.schedule_time}
                    onChange={(e) => setNewRoutine({ ...newRoutine, schedule_time: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Multiple Daily Reminders (Optional)</Label>
                  <div className="space-y-2">
                    {newRoutine.reminder_times.map((time, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          type="time"
                          value={time}
                          onChange={(e) => updateReminderTime(index, e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeReminderTime(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addReminderTime}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Reminder Time
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (Days)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="1"
                      max="365"
                      value={newRoutine.duration_days}
                      onChange={(e) => setNewRoutine({ ...newRoutine, duration_days: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={newRoutine.start_date}
                      onChange={(e) => setNewRoutine({ ...newRoutine, start_date: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="flex space-x-2 pt-4 flex-shrink-0 border-t">
                  <Button
                    onClick={handleCreateRoutine}
                    disabled={!newRoutine.title}
                    className="flex-1 bg-health-primary hover:bg-health-secondary"
                  >
                    Create Routine
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-2/3"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-muted rounded w-full mb-2"></div>
                <div className="h-3 bg-muted rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {routines.map((routine) => (
            <Card key={routine.id} className={`${routine.is_active ? 'border-l-4 border-l-health-primary' : 'opacity-75'}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Target className={`h-4 w-4 ${routine.is_active ? 'text-health-primary' : 'text-muted-foreground'}`} />
                      <span>{routine.title}</span>
                    </CardTitle>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge variant="outline" className="capitalize">
                        {routine.routine_type.replace('_', ' ')}
                      </Badge>
                      {routine.is_active ? (
                        <Badge className="bg-health-success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Paused</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleRoutine(routine)}
                    >
                      {routine.is_active ? (
                        <Pause className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteRoutine(routine)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {routine.description && (
                  <p className="text-sm text-muted-foreground mb-3">{routine.description}</p>
                )}
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>{formatSchedule(routine)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && routines.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle className="mb-2">No Routines</CardTitle>
            <CardDescription>
              Create your first routine or sync from Amazon Alexa to get started.
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RoutinesManager;