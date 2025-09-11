import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Target } from 'lucide-react';
import { CustomTracker } from './CustomTracker';

interface TrackerConfig {
  id: string;
  title: string;
  data_type: string;
  unit: string;
  icon: string;
  increment_value: number;
  current_value: number;
}

const PRESET_TRACKERS = [
  { title: 'Times Outside', data_type: 'times_outside', unit: 'times', icon: '🌳', increment_value: 1 },
  { title: 'Glasses of Water', data_type: 'water_glasses', unit: 'glasses', icon: '💧', increment_value: 1 },
  { title: 'Hours of Sleep', data_type: 'sleep_hours', unit: 'hours', icon: '😴', increment_value: 0.5 },
  { title: 'Meditation Minutes', data_type: 'meditation_minutes', unit: 'minutes', icon: '🧘', increment_value: 5 },
  { title: 'Workout Sessions', data_type: 'workout_sessions', unit: 'sessions', icon: '💪', increment_value: 1 },
  { title: 'Books Read', data_type: 'books_read', unit: 'books', icon: '📚', increment_value: 1 },
  { title: 'Healthy Meals', data_type: 'healthy_meals', unit: 'meals', icon: '🥗', increment_value: 1 },
  { title: 'Social Interactions', data_type: 'social_interactions', unit: 'interactions', icon: '👥', increment_value: 1 }
];

export function CustomTrackers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [trackers, setTrackers] = useState<TrackerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  
  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newDataType, setNewDataType] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newIcon, setNewIcon] = useState('📊');
  const [newIncrement, setNewIncrement] = useState('1');
  const [selectedPreset, setSelectedPreset] = useState('');

  useEffect(() => {
    if (user) {
      fetchTrackers();
    }
  }, [user]);

  const fetchTrackers = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get tracker configurations from localStorage
      const savedTrackers = JSON.parse(localStorage.getItem(`custom_trackers_${user.id}`) || '[]');
      
      // Get today's values from health_data
      const today = new Date().toISOString().split('T')[0];
      const { data: healthData } = await supabase
        .from('health_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today);

      // Merge configurations with current values
      const trackersWithValues = savedTrackers.map((tracker: TrackerConfig) => {
        const todayData = healthData?.find(d => d.data_type === tracker.data_type);
        return {
          ...tracker,
          current_value: todayData?.value || 0
        };
      });

      setTrackers(trackersWithValues);
    } catch (error) {
      console.error('Error fetching trackers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load trackers',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const addTracker = async () => {
    if (!user) return;

    try {
      const newTracker: TrackerConfig = {
        id: Date.now().toString(),
        title: newTitle,
        data_type: newDataType,
        unit: newUnit,
        icon: newIcon,
        increment_value: parseFloat(newIncrement) || 1,
        current_value: 0
      };

      // Save to localStorage
      const currentTrackers = JSON.parse(localStorage.getItem(`custom_trackers_${user.id}`) || '[]');
      const updatedTrackers = [...currentTrackers, newTracker];
      localStorage.setItem(`custom_trackers_${user.id}`, JSON.stringify(updatedTrackers));

      // Reset form
      setNewTitle('');
      setNewDataType('');
      setNewUnit('');
      setNewIcon('📊');
      setNewIncrement('1');
      setSelectedPreset('');
      setShowAddDialog(false);

      toast({
        title: 'Tracker Added',
        description: `${newTracker.title} tracker has been created`
      });

      fetchTrackers();
    } catch (error) {
      console.error('Error adding tracker:', error);
      toast({
        title: 'Error',
        description: 'Failed to add tracker',
        variant: 'destructive'
      });
    }
  };

  const deleteTracker = async (trackerId: string) => {
    if (!user) return;

    try {
      const currentTrackers = JSON.parse(localStorage.getItem(`custom_trackers_${user.id}`) || '[]');
      const updatedTrackers = currentTrackers.filter((t: TrackerConfig) => t.id !== trackerId);
      localStorage.setItem(`custom_trackers_${user.id}`, JSON.stringify(updatedTrackers));

      toast({
        title: 'Tracker Deleted',
        description: 'Tracker has been removed'
      });

      fetchTrackers();
    } catch (error) {
      console.error('Error deleting tracker:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete tracker',
        variant: 'destructive'
      });
    }
  };

  const handlePresetSelect = (presetTitle: string) => {
    const preset = PRESET_TRACKERS.find(p => p.title === presetTitle);
    if (preset) {
      setNewTitle(preset.title);
      setNewDataType(preset.data_type);
      setNewUnit(preset.unit);
      setNewIcon(preset.icon);
      setNewIncrement(preset.increment_value.toString());
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading trackers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Custom Trackers</h2>
          <p className="text-muted-foreground">Track daily habits and activities with simple counters</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Tracker
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Tracker</DialogTitle>
              <DialogDescription>
                Add a custom counter for any daily habit or activity
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="preset">Quick Start (optional)</Label>
                <Select value={selectedPreset} onValueChange={(value) => {
                  setSelectedPreset(value);
                  handlePresetSelect(value);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a preset tracker..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_TRACKERS.map((preset) => (
                      <SelectItem key={preset.data_type} value={preset.title}>
                        {preset.icon} {preset.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Times Outside"
                />
              </div>
              
              <div>
                <Label htmlFor="data_type">Data Type (Internal ID) *</Label>
                <Input
                  id="data_type"
                  value={newDataType}
                  onChange={(e) => setNewDataType(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  placeholder="e.g., times_outside"
                />
              </div>
              
              <div>
                <Label htmlFor="unit">Unit *</Label>
                <Input
                  id="unit"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="e.g., times, glasses, hours"
                />
              </div>
              
              <div>
                <Label htmlFor="icon">Icon (Emoji)</Label>
                <Input
                  id="icon"
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  placeholder="🌳"
                />
              </div>
              
              <div>
                <Label htmlFor="increment">Increment Value</Label>
                <Input
                  id="increment"
                  type="number"
                  step="0.1"
                  value={newIncrement}
                  onChange={(e) => setNewIncrement(e.target.value)}
                />
              </div>
              
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={addTracker}
                  disabled={!newTitle || !newDataType || !newUnit}
                >
                  Create Tracker
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {trackers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Custom Trackers Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first custom tracker to start monitoring daily habits and activities.
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Tracker
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {trackers.map((tracker) => (
            <CustomTracker
              key={tracker.id}
              config={tracker}
              onUpdate={fetchTrackers}
              onDelete={deleteTracker}
            />
          ))}
        </div>
      )}
    </div>
  );
}