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
import { Target, Clock, RefreshCw, Plus, Play, Pause, Trash2, Edit } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Routine {
  id: string;
  title: string;
  description?: string;
  routine_type: string;
  schedule_days?: number[];
  schedule_time?: string;
  is_active: boolean;
  amazon_routine_id?: string;
  created_at: string;
}

const RoutinesManager = () => {
  const { user } = useAuth();
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
      const { data, error } = await supabase.functions.invoke('sync-amazon-routines');
      
      if (error) throw error;
      
      toast({
        title: "Sync Complete",
        description: "Amazon routines have been synced successfully",
      });
      
      fetchRoutines();
    } catch (error) {
      console.error('Error syncing Amazon routines:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync Amazon routines. Please check your API configuration.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateRoutine = async () => {
    if (!user || !newRoutine.title) return;

    try {
      const { error } = await supabase
        .from('routines')
        .insert({
          user_id: user.id,
          title: newRoutine.title,
          description: newRoutine.description,
          routine_type: newRoutine.routine_type,
          schedule_days: newRoutine.schedule_days.length > 0 ? newRoutine.schedule_days : null,
          schedule_time: newRoutine.schedule_time || null,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: "Routine Created",
        description: "Your routine has been created successfully",
      });

      setNewRoutine({
        title: '',
        description: '',
        routine_type: 'amazon',
        schedule_days: [],
        schedule_time: '',
      });
      setDialogOpen(false);
      fetchRoutines();
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
    
    if (routine.schedule_time) {
      parts.push(`at ${routine.schedule_time}`);
    }
    
    return parts.join(' ') || 'No schedule set';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Routines & Reminders</h2>
          <p className="text-muted-foreground">Manage your Amazon Alexa routines and wellness reminders</p>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={syncAmazonRoutines}
            disabled={syncing}
            variant="outline"
          >
            {syncing ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {syncing ? 'Syncing...' : 'Sync Amazon'}
          </Button>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-health-primary hover:bg-health-secondary">
                <Plus className="h-4 w-4 mr-2" />
                Create Routine
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Routine</DialogTitle>
                <DialogDescription>
                  Set up a new routine or reminder for your wellness goals.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
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
                  <Label htmlFor="time">Time (Optional)</Label>
                  <Input
                    id="time"
                    type="time"
                    value={newRoutine.schedule_time}
                    onChange={(e) => setNewRoutine({ ...newRoutine, schedule_time: e.target.value })}
                  />
                </div>

                <div className="flex space-x-2 pt-4">
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