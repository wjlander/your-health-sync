import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Activity, Heart, Footprints, Utensils, Target } from 'lucide-react';
import { UnitsType, convertWeight, getWeightUnit } from './UnitsPreference';

interface HealthData {
  id: string;
  data_type: string;
  value: number;
  unit: string;
  date: string;
  metadata: any;
}

interface WeightGoal {
  target_weight: number;
  weekly_loss_target: number;
  daily_calorie_deficit: number;
}

const DashboardOverview = () => {
  const { user } = useAuth();
  const [healthData, setHealthData] = useState<HealthData[]>([]);
  const [weightGoal, setWeightGoal] = useState<WeightGoal | null>(null);
  const [userUnits, setUserUnits] = useState<UnitsType>('imperial');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch latest health data for each type
      const { data: healthDataResponse, error: healthError } = await supabase
        .from('health_data')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (healthError) throw healthError;

      // Get the latest record for each data type
      const latestData: HealthData[] = [];
      const seenTypes = new Set();
      
      healthDataResponse?.forEach(record => {
        if (!seenTypes.has(record.data_type)) {
          latestData.push(record);
          seenTypes.add(record.data_type);
        }
      });

      setHealthData(latestData);

      // Fetch user units preference
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('units_preference')
        .eq('user_id', user.id)
        .single();

      if (!profileError && profileData) {
        setUserUnits(profileData.units_preference as UnitsType || 'imperial');
      }

      // Fetch active weight goal
      const { data: goalData, error: goalError } = await supabase
        .from('weight_goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!goalError && goalData) {
        setWeightGoal(goalData);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLatestValue = (dataType: string) => {
    const record = healthData.find(d => d.data_type === dataType);
    return record ? record.value : 0;
  };

  const formatValue = (value: number, dataType: string, unit: string) => {
    if (dataType === 'weight' && unit === 'kg') {
      const convertedValue = convertWeight(value, 'metric', userUnits);
      const displayUnit = getWeightUnit(userUnits);
      return `${convertedValue.toFixed(1)} ${displayUnit}`;
    }
    
    if (dataType === 'steps') {
      return value.toLocaleString();
    }
    
    return `${Math.round(value)} ${unit}`;
  };

  // Calculate calories remaining based on goal and consumed
  const dailyCalorieGoal = weightGoal?.daily_calorie_deficit || 2000;
  const caloriesConsumed = getLatestValue('calories_in') || 0;
  const caloriesRemaining = Math.max(0, dailyCalorieGoal - caloriesConsumed);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      {/* Steps */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center space-y-0 space-x-2">
          <Footprints className="h-4 w-4 text-health-primary" />
          <CardTitle className="text-sm font-medium text-muted-foreground">Today's Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-health-primary">
            {formatValue(getLatestValue('steps'), 'steps', 'steps')}
          </div>
          <p className="text-xs text-muted-foreground">Goal: 10,000</p>
        </CardContent>
      </Card>

      {/* Heart Rate */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center space-y-0 space-x-2">
          <Heart className="h-4 w-4 text-health-error" />
          <CardTitle className="text-sm font-medium text-muted-foreground">Resting Heart Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-health-error">
            {formatValue(getLatestValue('resting_heart_rate'), 'resting_heart_rate', 'bpm')}
          </div>
          <p className="text-xs text-muted-foreground">Beats per minute</p>
        </CardContent>
      </Card>

      {/* Weight */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center space-y-0 space-x-2">
          <Activity className="h-4 w-4 text-health-secondary" />
          <CardTitle className="text-sm font-medium text-muted-foreground">Current Weight</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-health-secondary">
            {formatValue(getLatestValue('weight'), 'weight', 'kg')}
          </div>
          {weightGoal && (
            <p className="text-xs text-muted-foreground">
              Goal: {convertWeight(weightGoal.target_weight, 'metric', userUnits).toFixed(1)} {getWeightUnit(userUnits)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Calories Eaten */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center space-y-0 space-x-2">
          <Utensils className="h-4 w-4 text-health-accent" />
          <CardTitle className="text-sm font-medium text-muted-foreground">Calories Eaten</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-health-accent">
            {caloriesConsumed > 0 ? caloriesConsumed.toLocaleString() : 'No data'}
          </div>
          <p className="text-xs text-muted-foreground">
            {caloriesConsumed > 0 ? 'Today\'s intake' : 'From Fitbit'}
          </p>
        </CardContent>
      </Card>

      {/* Calories Remaining */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center space-y-0 space-x-2">
          <Target className="h-4 w-4 text-health-success" />
          <CardTitle className="text-sm font-medium text-muted-foreground">Calories Remaining</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-health-success">{caloriesRemaining.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Until daily goal</p>
        </CardContent>
      </Card>
      {/* Sleep */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center space-y-0 space-x-2">
          <Footprints className="h-4 w-4 text-health-primary" />
          <CardTitle className="text-sm font-medium text-muted-foreground">Today's Sleep</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-health-primary">
            {formatValue(getLatestValue('sleep'), 'sleep', 'sleep')}
          </div>
          <p className="text-xs text-muted-foreground">Goal: 10,000</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardOverview;