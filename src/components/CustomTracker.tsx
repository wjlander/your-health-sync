import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Minus, Edit, Settings, Trash2 } from 'lucide-react';

interface TrackerConfig {
  id: string;
  title: string;
  data_type: string;
  unit: string;
  icon: string;
  increment_value: number;
  current_value: number;
}

interface CustomTrackerProps {
  config: TrackerConfig;
  onUpdate: () => void;
  onDelete: (id: string) => void;
}

export function CustomTracker({ config, onUpdate, onDelete }: CustomTrackerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState(config.title);
  const [editUnit, setEditUnit] = useState(config.unit);
  const [editIncrement, setEditIncrement] = useState(config.increment_value.toString());

  const updateValue = async (change: number) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const newValue = Math.max(0, config.current_value + change);
      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from('health_data')
        .upsert({
          user_id: user.id,
          date: today,
          data_type: config.data_type,
          value: newValue,
          unit: config.unit,
          metadata: { 
            source: 'custom_tracker',
            tracker_id: config.id 
          }
        }, {
          onConflict: 'user_id,date,data_type'
        });

      if (error) throw error;

      toast({
        title: 'Updated',
        description: `${config.title}: ${newValue} ${config.unit}`
      });

      onUpdate();
    } catch (error) {
      console.error('Error updating tracker:', error);
      toast({
        title: 'Error',
        description: 'Failed to update tracker value',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!user) return;

    try {
      const updatedConfig = {
        ...config,
        title: editTitle,
        unit: editUnit,
        increment_value: parseFloat(editIncrement) || 1
      };

      // Update the tracker config in localStorage
      const trackers = JSON.parse(localStorage.getItem(`custom_trackers_${user.id}`) || '[]');
      const updatedTrackers = trackers.map((t: TrackerConfig) => 
        t.id === config.id ? updatedConfig : t
      );
      localStorage.setItem(`custom_trackers_${user.id}`, JSON.stringify(updatedTrackers));

      setShowEdit(false);
      toast({
        title: 'Tracker Updated',
        description: 'Your tracker settings have been saved'
      });
      onUpdate();
    } catch (error) {
      console.error('Error updating tracker config:', error);
      toast({
        title: 'Error',
        description: 'Failed to update tracker configuration',
        variant: 'destructive'
      });
    }
  };

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <span>{config.icon}</span>
              {config.title}
            </CardTitle>
            <CardDescription className="text-sm">
              Current: {config.current_value} {config.unit}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Dialog open={showEdit} onOpenChange={setShowEdit}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Tracker</DialogTitle>
                  <DialogDescription>
                    Customize your tracker settings
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="unit">Unit</Label>
                    <Input
                      id="unit"
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                      placeholder="times, glasses, hours, etc."
                    />
                  </div>
                  <div>
                    <Label htmlFor="increment">Increment Value</Label>
                    <Input
                      id="increment"
                      type="number"
                      step="0.1"
                      value={editIncrement}
                      onChange={(e) => setEditIncrement(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setShowEdit(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleEdit}>Save Changes</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onDelete(config.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center gap-4 items-center">
          <Button
            variant="outline"
            size="lg"
            onClick={() => updateValue(-config.increment_value)}
            disabled={loading || config.current_value === 0}
            className="h-12 w-12 rounded-full"
          >
            <Minus className="h-5 w-5" />
          </Button>
          
          <div className="text-center min-w-[80px]">
            <div className="text-3xl font-bold text-primary">
              {config.current_value}
            </div>
            <div className="text-sm text-muted-foreground">
              {config.unit}
            </div>
          </div>

          <Button
            variant="outline"
            size="lg"
            onClick={() => updateValue(config.increment_value)}
            disabled={loading}
            className="h-12 w-12 rounded-full"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}