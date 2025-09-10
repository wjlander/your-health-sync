import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Activity, Heart, Moon, Footprints, Zap, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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

  useEffect(() => {
    if (user) {
      fetchHealthData();
    }
  }, [user]);

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
      case 'calories':
        return <Zap className="h-5 w-5 text-health-accent" />;
      case 'heart_rate':
        return <Heart className="h-5 w-5 text-health-error" />;
      case 'sleep':
        return <Moon className="h-5 w-5 text-health-secondary" />;
      default:
        return <Activity className="h-5 w-5 text-health-primary" />;
    }
  };

  const getMetricColor = (dataType: string) => {
    switch (dataType) {
      case 'steps':
        return 'bg-health-primary';
      case 'calories':
        return 'bg-health-accent';
      case 'heart_rate':
        return 'bg-health-error';
      case 'sleep':
        return 'bg-health-secondary';
      default:
        return 'bg-health-primary';
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
          {Object.entries(groupedData).map(([dataType, items]) => {
            const latestItem = items[0];
            const previousItem = items[1];
            const change = previousItem
              ? ((latestItem.value - previousItem.value) / previousItem.value) * 100
              : 0;

            return (
              <Card key={dataType} className="relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1 h-full ${getMetricColor(dataType)}`} />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium capitalize flex items-center space-x-2">
                      {getMetricIcon(dataType)}
                      <span>{dataType.replace('_', ' ')}</span>
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {latestItem.date}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {latestItem.value.toLocaleString()}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      {latestItem.unit}
                    </span>
                  </div>
                  {change !== 0 && (
                    <p className={`text-xs ${change > 0 ? 'text-health-success' : 'text-health-error'}`}>
                      {change > 0 ? '+' : ''}{change.toFixed(1)}% from previous
                    </p>
                  )}
                  <div className="mt-2 text-xs text-muted-foreground">
                    {items.length} record{items.length !== 1 ? 's' : ''} available
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