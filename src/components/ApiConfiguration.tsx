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
    console.log('=== FETCHCONFIGS START ===');
    console.log('Current user:', user.id);
    console.log('Shared credentials user ID:', '595d5a28-e8dd-4da1-aeae-b6f2c5c478fd');
    
    try {
      // Fetch will's API configurations to display credentials
      console.log('Fetching Will configs...');
      const { data: willConfigs, error: willError } = await supabase
        .from('api_configurations')
        .select('*')
        .eq('user_id', '595d5a28-e8dd-4da1-aeae-b6f2c5c478fd'); // Changed to Jayne's ID where the configs actually are

      if (willError) {
        console.error('Will configs error:', willError);
        throw willError;
      }

      console.log('Will configs result:', willConfigs);

      // Fetch user's own configurations to check connection status
      console.log('Fetching user configs...');
      const { data: userConfigs, error: userError } = await supabase
        .from('api_configurations')
        .select('*')
        .eq('user_id', user.id);

      if (userError && userError.code !== 'PGRST116') {
        console.error('User configs error:', userError);
        throw userError; // Ignore "no rows" error
      }

      console.log('User configs result:', userConfigs);

      // Define all available services
      const defaultServices = ['fitbit', 'google', 'alexa'];
      
      console.log('Will configs fetched:', willConfigs);
      console.log('User configs fetched:', userConfigs);
      
      // Merge configs: use will's credentials but show user's connection status
      const mergedConfigs = defaultServices.map(serviceName => {
        const willConfig = willConfigs?.find(wc => wc.service_name === serviceName);
        const userConfig = userConfigs?.find(uc => uc.service_name === serviceName);
        
        const merged = {
          id: userConfig?.id || willConfig?.id || `temp-${serviceName}`,
          user_id: user.id,
          service_name: serviceName,
          client_id: willConfig?.client_id || '',
          client_secret: willConfig?.client_secret || '',
          api_key: willConfig?.api_key || '',
          redirect_url: willConfig?.redirect_url || '',
          access_token: userConfig?.access_token || null,
          refresh_token: userConfig?.refresh_token || null,
          expires_at: userConfig?.expires_at || null,
          is_connected: !!userConfig?.access_token,
          is_active: userConfig?.is_active ?? willConfig?.is_active ?? true,
          created_at: userConfig?.created_at || willConfig?.created_at || new Date().toISOString(),
          updated_at: userConfig?.updated_at || willConfig?.updated_at || new Date().toISOString()
        };
        
        console.log(`Merged config for ${serviceName}:`, merged);
        return merged;
      });

      console.log('Final merged configs being set:', mergedConfigs);
      setConfigs(mergedConfigs);

      // Populate form states with will's credentials
      console.log('Final merged configs:', mergedConfigs);
      
      mergedConfigs?.forEach((config) => {
        switch (config.service_name) {
          case 'fitbit':
            const fitbitConf = {
              client_id: config.client_id || '',
              client_secret: config.client_secret || '',
              redirect_url: (config as any).redirect_url || '',
            };
            console.log('Setting fitbit config:', fitbitConf);
            setFitbitConfig(fitbitConf);
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
              client_id: 'Managed by Secrets',
              client_secret: 'Managed by Secrets',
              skill_id: 'Managed by Secrets',
              redirect_url: 'https://mgpzuralipywzhmczqhf.supabase.co/functions/v1/alexa-oauth-callback',
            });
            break;
        }
      });
    } catch (error) {
      console.error('=== FETCHCONFIGS ERROR ===');
      console.error('Error fetching configs:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      toast({
        title: "Error",
        description: "Failed to fetch API configurations",
        variant: "destructive",
      });
    } finally {
      console.log('=== FETCHCONFIGS END ===');
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

    // For Alexa, save to shared user ID so all users benefit from updated credentials
    const targetUserId = serviceName === 'alexa' ? '595d5a28-e8dd-4da1-aeae-b6f2c5c478fd' : user.id;
    
    console.log('Saving config for user:', targetUserId, 'service:', serviceName);
    setSaving(serviceName);
    try {
      // For Alexa, look for existing config in the shared user account
      let existingConfig;
      if (serviceName === 'alexa') {
        const { data: sharedConfigs } = await supabase
          .from('api_configurations')
          .select('*')
          .eq('user_id', '595d5a28-e8dd-4da1-aeae-b6f2c5c478fd')
          .eq('service_name', 'alexa');
        existingConfig = sharedConfigs?.[0];
      } else {
        existingConfig = configs.find(c => c.service_name === serviceName);
      }

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
            user_id: targetUserId,
            service_name: serviceName,
            ...configData,
            is_active: true,
          });

        if (error) throw error;
      }

      console.log(`${serviceName} configuration saved successfully`);
      toast({
        title: "Configuration Saved",
        description: `${serviceName} API configuration has been saved successfully${serviceName === 'alexa' ? ' for all users' : ''}`,
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
    if (!config?.is_active || !config?.access_token) {
      return false;
    }
    
    // Check if token is expired
    if (config.expires_at) {
      const expiryDate = new Date(config.expires_at);
      const now = new Date();
      if (expiryDate <= now) {
        return false; // Token is expired, show connect button
      }
    }
    
    return true;
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
          clearTimeout(timeoutId);
          
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

      // Set a timeout to clean up if no response in 5 minutes
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', messageListener);
        setSaving(null);
        toast({
          title: "OAuth Timeout", 
          description: "The authorization process took too long. Please try again.",
          variant: "destructive",
        });
      }, 300000); // 5 minutes

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

  const connectAlexa = async () => {
    if (!user) return;
    
    try {
      setSaving('amazon');
      console.log('Connecting to Alexa directly...');
      
      // Check if record exists and update or insert accordingly
      const { data: existingConfig } = await supabase
        .from('api_configurations')
        .select('id')
        .eq('user_id', user.id)
        .eq('service_name', 'alexa')
        .single();

      let error;
      if (existingConfig) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('api_configurations')
          .update({
            client_id: 'system-managed',
            client_secret: 'system-managed',
            access_token: 'system-managed',
            refresh_token: 'system-managed',
            is_active: true,
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            redirect_url: `${window.location.origin}/dashboard`,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingConfig.id);
        error = updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('api_configurations')
          .insert({
            user_id: user.id,
            service_name: 'alexa',
            client_id: 'system-managed',
            client_secret: 'system-managed',
            access_token: 'system-managed',
            refresh_token: 'system-managed',
            is_active: true,
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            redirect_url: `${window.location.origin}/dashboard`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        error = insertError;
      }

      if (error) {
        console.error('Error connecting Alexa:', error);
        toast({
          title: "Connection Error",
          description: `Failed to connect to Alexa: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Connected to Alexa successfully! You can now manage your routines.",
      });
      
      fetchConfigs(); // Refresh configurations
    } catch (error) {
      console.error('Error connecting to Alexa:', error);
      toast({
        title: "Error",
        description: "Failed to connect to Alexa",
        variant: "destructive",
      });
    } finally {
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
          clearTimeout(timeoutId);
          
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

      // Set a timeout to clean up if no response in 5 minutes  
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', messageListener);
        setSaving(null);
        toast({
          title: "OAuth Timeout",
          description: "The authorization process took too long. Please try again.", 
          variant: "destructive",
        });
      }, 300000); // 5 minutes

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
                
                {!getConfigStatus('fitbit') && (
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
                   {/* Always show connect/reconnect button to allow reauthentication for new permissions */}
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
                     {getConfigStatus('google') ? 'Reconnect to Google' : 'Connect to Google Calendar'}
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
                    <strong>Managed Credentials:</strong> Alexa credentials are now managed through Supabase secrets for enhanced security. 
                    Contact your administrator to update Client ID, Client Secret, or Skill ID.
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
                   {/* Since credentials are now in Supabase secrets, always show connect button for Alexa */}
                   <Button
                     variant="secondary"
                     onClick={connectAlexa}
                     disabled={saving === 'amazon'}
                     className="bg-orange-600 hover:bg-orange-700 text-white"
                   >
                     {saving === 'amazon' ? (
                       <Key className="h-4 w-4 animate-spin mr-2" />
                     ) : (
                       <Key className="h-4 w-4 mr-2" />
                     )}
                     {getConfigStatus('alexa') ? 'Reconnect to Alexa' : 'Connect to Alexa'}
                   </Button>
                   
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