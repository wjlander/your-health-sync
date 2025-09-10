import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Activity, Heart, Moon, Footprints, Zap, RefreshCw, Scale } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { UnitsType, convertWeight, convertTemperature, getWeightUnit, getTemperatureUnit } from './UnitsPreference';

interface HealthData {
  id: string;
  data_type: string;
  value: number;
  unit: string;
  date: string;
  metadata: any;
}

const HealthMetrics = () => {
  const { user } = useAuth();
  const [healthData, setHealthData] = useState<HealthData[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [userUnits, setUserUnits] = useState<UnitsType>('imperial');

  useEffect(() => {
    if (user) {
      fetchHealthData();
      fetchUserUnits();
    }
  }, [user]);

  const fetchUserUnits = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('units_preference')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      const units = (data?.units_preference as UnitsType) || 'imperial';
      setUserUnits(units);
    } catch (error) {
      console.error('Error fetching units preference:', error);
    }
  };

  const fetchHealthData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('health_data')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setHealthData(data || []);
    } catch (error) {
      console.error('Error fetching health data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch health data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const syncFitbitData = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-fitbit-data');
      
      if (error) throw error;
      
      toast({
        title: "Sync Complete",
        description: "Fitbit data has been synced successfully",
      });
      
      fetchHealthData();
    } catch (error) {
      console.error('Error syncing Fitbit data:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync Fitbit data. Please check your API configuration.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const getMetricIcon = (dataType: string) => {
    switch (dataType) {
      case 'steps':
        return <Footprints className="h-5 w-5 text-health-primary" />;
      case 'calories-out':
      case 'calories-in':
        return <Zap className="h-5 w-5 text-health-accent" />;
      case 'heart-rate':
        return <Heart className="h-5 w-5 text-health-error" />;
      case 'sleep':
        return <Moon className="h-5 w-5 text-health-secondary" />;
      case 'weight':
        return <Scale className="h-5 w-5 text-health-primary" />;
      default:
        return <Activity className="h-5 w-5 text-health-primary" />;
    }
  };

  const getMetricColor = (dataType: string) => {
    switch (dataType) {
      case 'steps':
        return 'bg-health-primary/10';
      case 'calories-out':
      case 'calories-in':
        return 'bg-health-accent/10';
      case 'heart-rate':
        return 'bg-health-error/10';
      case 'sleep':
        return 'bg-health-secondary/10';
      case 'weight':
        return 'bg-health-primary/10';
      default:
        return 'bg-health-primary/10';
    }
  };

  const groupedData = healthData.reduce((acc, item) => {
    if (!acc[item.data_type]) {
      acc[item.data_type] = [];
    }
    acc[item.data_type].push(item);
    return acc;
  }, {} as Record<string, HealthData[]>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Health Metrics</h2>
          <p className="text-muted-foreground">Track your fitness and wellness data</p>
        </div>
        <Button
          onClick={syncFitbitData}
          disabled={syncing}
          className="bg-health-primary hover:bg-health-secondary"
        >
          {syncing ? (
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {syncing ? 'Syncing...' : 'Sync Fitbit'}
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-3 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(groupedData).map(([dataType, records]) => {
            const latestRecord = records[0];
            const previousRecord = records[1];
            
            let displayValue = latestRecord.value;
            let displayUnit = latestRecord.unit;
            
            // Convert values based on user preference
            if (dataType === 'weight' && displayUnit === 'lbs') {
              displayValue = convertWeight(displayValue, 'imperial', userUnits);
              displayUnit = getWeightUnit(userUnits);
            } else if (dataType.includes('temperature')) {
              // Assuming temperature data comes in Fahrenheit from Fitbit
              displayValue = convertTemperature(displayValue, 'imperial', userUnits);
              displayUnit = getTemperatureUnit(userUnits);
            }
            
            const percentageChange = previousRecord 
              ? ((latestRecord.value - previousRecord.value) / previousRecord.value * 100).toFixed(1)
              : null;

            return (
              <Card key={dataType} className="transition-all duration-200 hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${getMetricColor(dataType)}`}>
                        {getMetricIcon(dataType)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground capitalize">
                          {dataType.replace(/-/g, ' ')}
                        </p>
                        <p className="text-2xl font-bold">
                          {typeof displayValue === 'number' ? displayValue.toFixed(displayValue % 1 === 0 ? 0 : 1) : displayValue}
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            {displayUnit}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {new Date(latestRecord.date).toLocaleDateString()}
                      </p>
                      {percentageChange && (
                        <Badge 
                          variant={parseFloat(percentageChange) >= 0 ? "default" : "secondary"}
                          className="text-xs mt-1"
                        >
                          {parseFloat(percentageChange) >= 0 ? '+' : ''}{percentageChange}%
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && Object.keys(groupedData).length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle className="mb-2">No Health Data</CardTitle>
            <CardDescription>
              Click "Sync Fitbit" to import your health data, or configure your API settings first.
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HealthMetrics;