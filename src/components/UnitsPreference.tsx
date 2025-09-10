import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Settings, Check } from 'lucide-react';

export type UnitsType = 'metric' | 'imperial';

interface UnitsPreferenceProps {
  onUnitsChange?: (units: UnitsType) => void;
}

export function UnitsPreference({ onUnitsChange }: UnitsPreferenceProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [units, setUnits] = useState<UnitsType>('imperial');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUnitsPreference();
    }
  }, [user]);

  const fetchUnitsPreference = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('units_preference')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      const userUnits = (data?.units_preference as UnitsType) || 'imperial';
      setUnits(userUnits);
      onUnitsChange?.(userUnits);
    } catch (error) {
      console.error('Error fetching units preference:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnitsChange = async (newUnits: UnitsType) => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ units_preference: newUnits })
        .eq('user_id', user.id);

      if (error) throw error;

      setUnits(newUnits);
      onUnitsChange?.(newUnits);
      
      toast({
        title: 'Units Updated',
        description: `Switched to ${newUnits === 'metric' ? 'metric' : 'imperial'} units`,
      });
    } catch (error) {
      console.error('Error updating units preference:', error);
      toast({
        title: 'Error',
        description: 'Failed to update units preference',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-20 bg-muted rounded-lg"></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Units Preference
        </CardTitle>
        <CardDescription>
          Choose your preferred measurement units
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="units-select">Measurement System</Label>
          <Select 
            value={units} 
            onValueChange={(value) => handleUnitsChange(value as UnitsType)}
            disabled={saving}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select units" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="imperial" className="hover:bg-muted">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <div className="font-medium">Imperial</div>
                    <div className="text-sm text-muted-foreground">Pounds, inches, Fahrenheit</div>
                  </div>
                  {units === 'imperial' && <Check className="h-4 w-4 ml-2" />}
                </div>
              </SelectItem>
              <SelectItem value="metric" className="hover:bg-muted">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <div className="font-medium">Metric</div>
                    <div className="text-sm text-muted-foreground">Kilograms, centimeters, Celsius</div>
                  </div>
                  {units === 'metric' && <Check className="h-4 w-4 ml-2" />}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">Current Settings</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div>Weight: {units === 'metric' ? 'Kilograms (kg)' : 'Pounds (lbs)'}</div>
            <div>Height: {units === 'metric' ? 'Centimeters (cm)' : 'Inches (in)'}</div>
            <div>Temperature: {units === 'metric' ? 'Celsius (°C)' : 'Fahrenheit (°F)'}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Utility functions for unit conversion
export const convertWeight = (value: number, from: UnitsType, to: UnitsType): number => {
  if (from === to) return value;
  
  if (from === 'imperial' && to === 'metric') {
    return value * 0.453592; // lbs to kg
  } else if (from === 'metric' && to === 'imperial') {
    return value * 2.20462; // kg to lbs
  }
  
  return value;
};

export const convertHeight = (value: number, from: UnitsType, to: UnitsType): number => {
  if (from === to) return value;
  
  if (from === 'imperial' && to === 'metric') {
    return value * 2.54; // inches to cm
  } else if (from === 'metric' && to === 'imperial') {
    return value * 0.393701; // cm to inches
  }
  
  return value;
};

export const convertTemperature = (value: number, from: UnitsType, to: UnitsType): number => {
  if (from === to) return value;
  
  if (from === 'imperial' && to === 'metric') {
    return (value - 32) * 5/9; // F to C
  } else if (from === 'metric' && to === 'imperial') {
    return (value * 9/5) + 32; // C to F
  }
  
  return value;
};

export const getWeightUnit = (units: UnitsType): string => {
  return units === 'metric' ? 'kg' : 'lbs';
};

export const getHeightUnit = (units: UnitsType): string => {
  return units === 'metric' ? 'cm' : 'in';
};

export const getTemperatureUnit = (units: UnitsType): string => {
  return units === 'metric' ? '°C' : '°F';
};