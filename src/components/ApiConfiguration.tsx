import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Save, Key, Calendar, Smartphone, Check, AlertCircle, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ApiConfig {
  id: string;
  service_name: string;
  client_id?: string;
  client_secret?: string;
  api_key?: string;
  access_token?: string;
  refresh_token?: string;
  redirect_url?: string;
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
    redirect_url: '',
  });

  const [googleConfig, setGoogleConfig] = useState({
    client_id: '',
    client_secret: '',
    api_key: '',
    redirect_url: '',
  });

  const [amazonConfig, setAmazonConfig] = useState({
    client_id: '',
    client_secret: '',
    skill_id: '',
    redirect_url: '',
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
      // Fetch will's API configurations to display credentials
      const { data: willConfigs, error: willError } = await supabase
        .from('api_configurations')
        .select('*')
        .eq('user_id', 'b7318f45-ae52-49f4-9db5-1662096679dd');

      if (willError) throw willError;

      // Fetch user's own configurations to check connection status
      const { data: userConfigs, error: userError } = await supabase
        .from('api_configurations')
        .select('*')
        .eq('user_id', user.id);

      if (userError && userError.code !== 'PGRST116') throw userError; // Ignore "no rows" error

      // Merge configs: use will's credentials but show user's connection status
      const mergedConfigs = willConfigs?.map(willConfig => {
        const userConfig = userConfigs?.find(uc => uc.service_name === willConfig.service_name);
        return {
          ...willConfig,
          id: userConfig?.id || willConfig.id,
          access_token: userConfig?.access_token || null,
          refresh_token: userConfig?.refresh_token || null,
          expires_at: userConfig?.expires_at || null,
          is_connected: !!userConfig?.access_token,
          user_id: user.id // Keep current user's ID for operations
        };
      }) || [];

      setConfigs(mergedConfigs);

      // Populate form states with will's credentials
      mergedConfigs?.forEach((config) => {
        switch (config.service_name) {
          case 'fitbit':
            setFitbitConfig({
              client_id: config.client_id || '',
              client_secret: config.client_secret || '',
              redirect_url: (config as any).redirect_url || '',
            });
            break;
          case 'google':
            setGoogleConfig({
              client_id: config.client_id || '',
              client_secret: config.client_secret || '',
              api_key: config.api_key || '',
              redirect_url: (config as any).redirect_url || '',
            });
            break;
          case 'alexa':
            setAmazonConfig({
              client_id: config.client_id || '',
              client_secret: config.client_secret || '',
              skill_id: config.api_key || '',
              redirect_url: (config as any).redirect_url || '',
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
    return config?.is_active && config?.access_token;
  };

  const startGoogleOAuth = async () => {
    try {
      setSaving('google');
      
      console.log('Starting Google OAuth...');
      console.log('User:', user?.id);
      console.log('Google config:', googleConfig);
      
      const result = await supabase.functions.invoke('google-oauth-start');
      
      console.log('Google OAuth result:', result);
      
      const { data, error } = result;
      
      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(`Function error: ${error.message || JSON.stringify(error)}`);
      }
      
      if (data?.error) {
        console.error('Function returned error:', data.error);
        throw new Error(data.error);
      }

      if (!data?.authUrl) {
        console.error('No authUrl in response:', data);
        throw new Error('No authorization URL received from server');
      }

      console.log('Opening Google OAuth popup with URL:', data.authUrl);

      // Open OAuth URL in popup
      const popup = window.open(
        data.authUrl,
        'google-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Failed to open popup window. Please check popup blocker settings.');
      }

      // Listen for OAuth completion
      const messageListener = (event: MessageEvent) => {
        console.log('Received message:', event);
        if (event.data.type === 'google_oauth_success') {
          popup?.close();
          window.removeEventListener('message', messageListener);
          
          toast({
            title: "Google Calendar Connected",
            description: "Successfully connected to Google Calendar! You can now test the connection.",
          });
          
          // Refresh configurations
          fetchConfigs();
          setSaving(null);
        }
      };

      window.addEventListener('message', messageListener);

      // Clean up if popup is closed manually
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          setSaving(null);
        }
      }, 1000);

    } catch (error) {
      console.error('Google OAuth error:', error);
      
      toast({
        title: "OAuth Failed",
        description: error.message || "Failed to start Google Calendar authorization",
        variant: "destructive",
      });
      setSaving(null);
    }
  };

  const startAlexaOAuth = async () => {
    try {
      setSaving('amazon');
      
      console.log('Starting Alexa OAuth...');
      console.log('User:', user?.id);
      console.log('Alexa config:', amazonConfig);
      
      const result = await supabase.functions.invoke('alexa-oauth-start');
      
      console.log('Alexa OAuth result:', result);
      
      const { data, error } = result;
      
      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(`Function error: ${error.message || JSON.stringify(error)}`);
      }
      
      if (data?.error) {
        console.error('Function returned error:', data.error);
        throw new Error(data.error);
      }

      if (!data?.authUrl) {
        console.error('No authUrl in response:', data);
        throw new Error('No authorization URL received from server');
      }

      console.log('Opening Alexa OAuth popup with URL:', data.authUrl);

      // Open OAuth URL in popup
      const popup = window.open(
        data.authUrl,
        'alexa-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Failed to open popup window. Please check popup blocker settings.');
      }

      // Listen for OAuth completion
      const messageListener = (event: MessageEvent) => {
        console.log('Received message:', event);
        if (event.data.type === 'alexa_oauth_success') {
          popup?.close();
          window.removeEventListener('message', messageListener);
          
          toast({
            title: "Alexa Connected",
            description: "Successfully connected to Alexa! You can now test the connection.",
          });
          
          // Refresh configurations
          fetchConfigs();
          setSaving(null);
        }
      };

      window.addEventListener('message', messageListener);

      // Clean up if popup is closed manually
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          setSaving(null);
        }
      }, 1000);

    } catch (error) {
      console.error('Alexa OAuth error:', error);
      
      toast({
        title: "OAuth Failed",
        description: error.message || "Failed to start Alexa authorization",
        variant: "destructive",
      });
      setSaving(null);
    }
  };

  const testConnection = async (serviceName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('test-api-connection', {
        body: { service: serviceName }
      });

      if (error) throw error;

      toast({
        title: "Connection Test",
        description: data.success ? data.message : data.message,
        variant: data.success ? "default" : "destructive",
      });
    } catch (error) {
      console.error('Error testing connection:', error);
      toast({
        title: "Test Failed",
        description: "Failed to test API connection",
        variant: "destructive",
      });
    }
  };

  const startFitbitOAuth = async () => {
    try {
      setSaving('fitbit');
      
      console.log('Starting Fitbit OAuth...');
      console.log('User:', user?.id);
      console.log('Fitbit config:', fitbitConfig);
      
      const result = await supabase.functions.invoke('fitbit-oauth-start');
      
      console.log('Full invoke result:', result);
      console.log('Result data:', result.data);
      console.log('Result error:', result.error);
      
      // Try to get more details from the response
      if (result.error && result.response) {
        try {
          const responseText = await result.response.text();
          console.log('Response body:', responseText);
        } catch (e) {
          console.log('Could not read response body:', e);
        }
      }
      
      const { data, error } = result;
      
      if (error) {
        console.error('Supabase function error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new Error(`Function error: ${error.message || JSON.stringify(error)}`);
      }
      
      if (data?.error) {
        console.error('Function returned error:', data.error);
        throw new Error(data.error);
      }

      if (!data?.authUrl) {
        console.error('No authUrl in response:', data);
        throw new Error('No authorization URL received from server');
      }

      console.log('Opening OAuth popup with URL:', data.authUrl);

      // Open OAuth URL in popup
      const popup = window.open(
        data.authUrl,
        'fitbit-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Failed to open popup window. Please check popup blocker settings.');
      }

      // Listen for OAuth completion
      const messageListener = (event: MessageEvent) => {
        console.log('Received message:', event);
        if (event.data.type === 'fitbit_oauth_success') {
          popup?.close();
          window.removeEventListener('message', messageListener);
          
          toast({
            title: "Fitbit Connected",
            description: "Successfully connected to Fitbit! You can now test the connection.",
          });
          
          // Refresh configurations
          fetchConfigs();
          setSaving(null);
        }
      };

      window.addEventListener('message', messageListener);

      // Clean up if popup is closed manually
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          setSaving(null);
        }
      }, 1000);

    } catch (error) {
      console.error('OAuth error details:', error);
      console.error('Error stack:', error.stack);
      
      toast({
        title: "OAuth Failed",
        description: error.message || "Failed to start Fitbit authorization",
        variant: "destructive",
      });
      setSaving(null);
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
            {getConfigStatus('alexa') && <Check className="h-3 w-3 text-health-success" />}
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
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                <div className="flex items-center space-x-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  <p className="text-sm text-blue-800">
                    <strong>Shared Credentials:</strong> API credentials are provided system-wide. 
                    Click "Connect to Fitbit" to link your personal Fitbit account.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fitbit-client-id">Client ID</Label>
                  <Input
                    id="fitbit-client-id"
                    type="text"
                    placeholder="Enter Fitbit Client ID"
                    value={fitbitConfig.client_id}
                    onChange={(e) => setFitbitConfig({ ...fitbitConfig, client_id: e.target.value })}
                    disabled
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
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fitbit-redirect-url">Redirect URL</Label>
                  <Input
                    id="fitbit-redirect-url"
                    type="url"
                    placeholder="https://mgpzuralipywzhmczqhf.supabase.co/functions/v1/fitbit-oauth-callback"
                    value={fitbitConfig.redirect_url}
                    onChange={(e) => setFitbitConfig({ ...fitbitConfig, redirect_url: e.target.value })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Use: <code className="bg-muted px-1 rounded">https://mgpzuralipywzhmczqhf.supabase.co/functions/v1/fitbit-oauth-callback</code><br/>
                    This URL must be configured in your Fitbit app settings.
                  </p>
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
                
                {getConfigStatus('fitbit') && fitbitConfig.client_id && fitbitConfig.redirect_url && (
                  <Button
                    variant="secondary"
                    onClick={startFitbitOAuth}
                    disabled={saving === 'fitbit'}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {saving === 'fitbit' ? (
                      <Key className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Key className="h-4 w-4 mr-2" />
                    )}
                    Connect to Fitbit
                  </Button>
                )}
                
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
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                <div className="flex items-center space-x-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  <p className="text-sm text-blue-800">
                    <strong>Shared Credentials:</strong> API credentials are provided system-wide. 
                    Click "Connect to Google" to link your personal Google account.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="google-client-id">Client ID</Label>
                  <Input
                    id="google-client-id"
                    type="text"
                    placeholder="Enter Google Client ID"
                    value={googleConfig.client_id}
                    onChange={(e) => setGoogleConfig({ ...googleConfig, client_id: e.target.value })}
                    disabled
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
                    disabled
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
                    disabled
                  />
                 </div>
                 <div className="space-y-2 md:col-span-2">
                   <Label htmlFor="google-redirect-url">Redirect URL</Label>
                   <Input
                     id="google-redirect-url"
                     type="url"
                     placeholder="https://mgpzuralipywzhmczqhf.supabase.co/functions/v1/google-oauth-callback"
                     value={googleConfig.redirect_url || ''}
                     onChange={(e) => setGoogleConfig({ ...googleConfig, redirect_url: e.target.value })}
                     disabled
                   />
                   <p className="text-sm text-muted-foreground">
                     Use: <code className="bg-muted px-1 rounded">https://mgpzuralipywzhmczqhf.supabase.co/functions/v1/google-oauth-callback</code><br/>
                     This URL must be configured in your Google Cloud Console OAuth settings.
                   </p>
                 </div>
               </div>
                <div className="flex space-x-2">
                  {/* Remove Save Config button since credentials are read-only */}
                  {getConfigStatus('google') && googleConfig.client_id && googleConfig.client_secret && (
                   <Button
                     variant="secondary"
                     onClick={startGoogleOAuth}
                     disabled={saving === 'google'}
                     className="bg-blue-600 hover:bg-blue-700 text-white"
                   >
                     {saving === 'google' ? (
                       <Key className="h-4 w-4 animate-spin mr-2" />
                     ) : (
                       <Key className="h-4 w-4 mr-2" />
                     )}
                     Connect to Google Calendar
                   </Button>
                 )}
                 
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
                    Configure Amazon Alexa Skill credentials for reminders API access
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
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                <div className="flex items-center space-x-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  <p className="text-sm text-blue-800">
                    <strong>Shared Credentials:</strong> API credentials are provided system-wide. 
                    Click "Connect to Alexa" to link your personal Amazon account.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amazon-client-id">Client ID</Label>
                  <Input
                    id="amazon-client-id"
                    type="text"
                    placeholder="Enter Alexa Skill Client ID"
                    value={amazonConfig.client_id}
                    onChange={(e) => setAmazonConfig({ ...amazonConfig, client_id: e.target.value })}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amazon-client-secret">Client Secret</Label>
                  <Input
                    id="amazon-client-secret"
                    type="password"
                    placeholder="Enter Alexa Skill Client Secret"
                    value={amazonConfig.client_secret}
                    onChange={(e) => setAmazonConfig({ ...amazonConfig, client_secret: e.target.value })}
                    disabled
                  />
                 </div>
                 <div className="space-y-2 md:col-span-2">
                   <Label htmlFor="amazon-skill-id">Skill ID</Label>
                   <Input
                     id="amazon-skill-id"
                     type="text"
                     placeholder="Enter Alexa Skill ID (amzn1.ask.skill.xxxx)"
                     value={amazonConfig.skill_id}
                     onChange={(e) => setAmazonConfig({ ...amazonConfig, skill_id: e.target.value })}
                     disabled
                   />
                 </div>
                 <div className="space-y-2 md:col-span-2">
                   <Label htmlFor="amazon-redirect-url">Redirect URL</Label>
                   <Input
                     id="amazon-redirect-url"
                     type="url"
                     placeholder="https://mgpzuralipywzhmczqhf.supabase.co/functions/v1/alexa-oauth-callback"
                     value={amazonConfig.redirect_url || ''}
                     onChange={(e) => setAmazonConfig({ ...amazonConfig, redirect_url: e.target.value })}
                     disabled
                   />
                    <p className="text-sm text-muted-foreground">
                      Use: <code className="bg-muted px-1 rounded">https://mgpzuralipywzhmczqhf.supabase.co/functions/v1/alexa-oauth-callback</code><br/>
                      This URL must be configured in your Alexa Skill's Account Linking settings.
                    </p>
                 </div>
               </div>
                <div className="flex space-x-2">
                  {/* Remove Save Config button since credentials are read-only */}
                   {getConfigStatus('alexa') && amazonConfig.client_id && amazonConfig.client_secret && amazonConfig.skill_id && (
                    <Button
                      variant="secondary"
                      onClick={startAlexaOAuth}
                      disabled={saving === 'amazon'}
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      {saving === 'amazon' ? (
                        <Key className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Key className="h-4 w-4 mr-2" />
                      )}
                      Connect to Alexa
                    </Button>
                  )}
                 
                 {getConfigStatus('alexa') && (
                   <Button
                     variant="outline"
                     onClick={() => testConnection('alexa')}
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