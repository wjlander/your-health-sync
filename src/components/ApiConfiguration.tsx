import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Save, Key, Calendar, Smartphone, Check, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ApiConfig {
  id: string;
  service_name: string;
  client_id?: string;
  client_secret?: string;
  api_key?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  is_active: boolean;
}

const ApiConfiguration = () => {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // Form states for each service
  const [fitbitConfig, setFitbitConfig] = useState({
    client_id: '',
    client_secret: '',
    access_token: '',
    refresh_token: '',
  });

  const [googleConfig, setGoogleConfig] = useState({
    client_id: '',
    client_secret: '',
    api_key: '',
  });

  const [amazonConfig, setAmazonConfig] = useState({
    client_id: '',
    client_secret: '',
    api_key: '',
  });

  useEffect(() => {
    if (user) {
      fetchConfigs();
    }
  }, [user]);

  const fetchConfigs = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('api_configurations')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      setConfigs(data || []);

      // Populate form states
      data?.forEach((config) => {
        switch (config.service_name) {
          case 'fitbit':
            setFitbitConfig({
              client_id: config.client_id || '',
              client_secret: config.client_secret || '',
              access_token: config.access_token || '',
              refresh_token: config.refresh_token || '',
            });
            break;
          case 'google':
            setGoogleConfig({
              client_id: config.client_id || '',
              client_secret: config.client_secret || '',
              api_key: config.api_key || '',
            });
            break;
          case 'amazon':
            setAmazonConfig({
              client_id: config.client_id || '',
              client_secret: config.client_secret || '',
              api_key: config.api_key || '',
            });
            break;
        }
      });
    } catch (error) {
      console.error('Error fetching configs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch API configurations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (serviceName: string, configData: any) => {
    if (!user) {
      console.log('No user found, cannot save API config');
      toast({
        title: "Authentication Required",
        description: "Please log in to save API configurations",
        variant: "destructive",
      });
      return;
    }

    console.log('Saving config for user:', user.id, 'service:', serviceName);
    setSaving(serviceName);
    try {
      const existingConfig = configs.find(c => c.service_name === serviceName);

      if (existingConfig) {
        const { error } = await supabase
          .from('api_configurations')
          .update({
            ...configData,
            updated_at: new Date().toISOString(),
            is_active: true,
          })
          .eq('id', existingConfig.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('api_configurations')
          .insert({
            user_id: user.id,
            service_name: serviceName,
            ...configData,
            is_active: true,
          });

        if (error) throw error;
      }

      console.log(`${serviceName} configuration saved successfully`);
      toast({
        title: "Configuration Saved",
        description: `${serviceName} API configuration has been saved successfully`,
      });

      fetchConfigs();
    } catch (error) {
      console.error('Error saving config:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      toast({
        title: "Save Failed",
        description: `Failed to save ${serviceName} configuration: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const getConfigStatus = (serviceName: string) => {
    const config = configs.find(c => c.service_name === serviceName);
    return config?.is_active;
  };

  const testConnection = async (serviceName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('test-api-connection', {
        body: { service: serviceName }
      });

      if (error) throw error;

      toast({
        title: "Connection Test",
        description: data.success ? "Connection successful!" : "Connection failed",
        variant: data.success ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Failed to test API connection",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">API Configuration</h2>
        <p className="text-muted-foreground">
          Configure your API credentials for Fitbit, Google Calendar, and Amazon services
        </p>
      </div>

      <Tabs defaultValue="fitbit" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="fitbit" className="flex items-center space-x-2">
            <Smartphone className="h-4 w-4" />
            <span>Fitbit</span>
            {getConfigStatus('fitbit') && <Check className="h-3 w-3 text-health-success" />}
          </TabsTrigger>
          <TabsTrigger value="google" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Google</span>
            {getConfigStatus('google') && <Check className="h-3 w-3 text-health-success" />}
          </TabsTrigger>
          <TabsTrigger value="amazon" className="flex items-center space-x-2">
            <Key className="h-4 w-4" />
            <span>Amazon</span>
            {getConfigStatus('amazon') && <Check className="h-3 w-3 text-health-success" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fitbit">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Smartphone className="h-5 w-5" />
                    <span>Fitbit Configuration</span>
                  </CardTitle>
                  <CardDescription>
                    Configure your Fitbit API credentials for health data syncing
                  </CardDescription>
                </div>
                {getConfigStatus('fitbit') ? (
                  <Badge className="bg-health-success">Connected</Badge>
                ) : (
                  <Badge variant="outline" className="text-health-warning">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Not Connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fitbit-client-id">Client ID</Label>
                  <Input
                    id="fitbit-client-id"
                    type="text"
                    placeholder="Enter Fitbit Client ID"
                    value={fitbitConfig.client_id}
                    onChange={(e) => setFitbitConfig({ ...fitbitConfig, client_id: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fitbit-client-secret">Client Secret</Label>
                  <Input
                    id="fitbit-client-secret"
                    type="password"
                    placeholder="Enter Fitbit Client Secret"
                    value={fitbitConfig.client_secret}
                    onChange={(e) => setFitbitConfig({ ...fitbitConfig, client_secret: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fitbit-access-token">Access Token (Optional)</Label>
                  <Input
                    id="fitbit-access-token"
                    type="password"
                    placeholder="Enter Access Token if available"
                    value={fitbitConfig.access_token}
                    onChange={(e) => setFitbitConfig({ ...fitbitConfig, access_token: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fitbit-refresh-token">Refresh Token (Optional)</Label>
                  <Input
                    id="fitbit-refresh-token"
                    type="password"
                    placeholder="Enter Refresh Token if available"
                    value={fitbitConfig.refresh_token}
                    onChange={(e) => setFitbitConfig({ ...fitbitConfig, refresh_token: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={() => saveConfig('fitbit', fitbitConfig)}
                  disabled={saving === 'fitbit'}
                  className="bg-health-primary hover:bg-health-secondary"
                >
                  {saving === 'fitbit' ? (
                    <Key className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saving === 'fitbit' ? 'Saving...' : 'Save Configuration'}
                </Button>
                {getConfigStatus('fitbit') && (
                  <Button
                    variant="outline"
                    onClick={() => testConnection('fitbit')}
                  >
                    Test Connection
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="google">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5" />
                    <span>Google Configuration</span>
                  </CardTitle>
                  <CardDescription>
                    Configure Google Calendar API credentials for calendar integration
                  </CardDescription>
                </div>
                {getConfigStatus('google') ? (
                  <Badge className="bg-health-success">Connected</Badge>
                ) : (
                  <Badge variant="outline" className="text-health-warning">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Not Connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="google-client-id">Client ID</Label>
                  <Input
                    id="google-client-id"
                    type="text"
                    placeholder="Enter Google Client ID"
                    value={googleConfig.client_id}
                    onChange={(e) => setGoogleConfig({ ...googleConfig, client_id: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="google-client-secret">Client Secret</Label>
                  <Input
                    id="google-client-secret"
                    type="password"
                    placeholder="Enter Google Client Secret"
                    value={googleConfig.client_secret}
                    onChange={(e) => setGoogleConfig({ ...googleConfig, client_secret: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="google-api-key">API Key</Label>
                  <Input
                    id="google-api-key"
                    type="password"
                    placeholder="Enter Google Calendar API Key"
                    value={googleConfig.api_key}
                    onChange={(e) => setGoogleConfig({ ...googleConfig, api_key: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={() => saveConfig('google', googleConfig)}
                  disabled={saving === 'google'}
                  className="bg-health-primary hover:bg-health-secondary"
                >
                  {saving === 'google' ? (
                    <Key className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saving === 'google' ? 'Saving...' : 'Save Configuration'}
                </Button>
                {getConfigStatus('google') && (
                  <Button
                    variant="outline"
                    onClick={() => testConnection('google')}
                  >
                    Test Connection
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="amazon">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Key className="h-5 w-5" />
                    <span>Amazon Configuration</span>
                  </CardTitle>
                  <CardDescription>
                    Configure Amazon Alexa API credentials for routines and reminders
                  </CardDescription>
                </div>
                {getConfigStatus('amazon') ? (
                  <Badge className="bg-health-success">Connected</Badge>
                ) : (
                  <Badge variant="outline" className="text-health-warning">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Not Connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amazon-client-id">Client ID</Label>
                  <Input
                    id="amazon-client-id"
                    type="text"
                    placeholder="Enter Amazon Client ID"
                    value={amazonConfig.client_id}
                    onChange={(e) => setAmazonConfig({ ...amazonConfig, client_id: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amazon-client-secret">Client Secret</Label>
                  <Input
                    id="amazon-client-secret"
                    type="password"
                    placeholder="Enter Amazon Client Secret"
                    value={amazonConfig.client_secret}
                    onChange={(e) => setAmazonConfig({ ...amazonConfig, client_secret: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="amazon-api-key">API Key</Label>
                  <Input
                    id="amazon-api-key"
                    type="password"
                    placeholder="Enter Amazon API Key"
                    value={amazonConfig.api_key}
                    onChange={(e) => setAmazonConfig({ ...amazonConfig, api_key: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={() => saveConfig('amazon', amazonConfig)}
                  disabled={saving === 'amazon'}
                  className="bg-health-primary hover:bg-health-secondary"
                >
                  {saving === 'amazon' ? (
                    <Key className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saving === 'amazon' ? 'Saving...' : 'Save Configuration'}
                </Button>
                {getConfigStatus('amazon') && (
                  <Button
                    variant="outline"
                    onClick={() => testConnection('amazon')}
                  >
                    Test Connection
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApiConfiguration;