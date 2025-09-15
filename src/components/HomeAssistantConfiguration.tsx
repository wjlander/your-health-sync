import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Home, Save, TestTube } from 'lucide-react';

const HomeAssistantConfiguration = () => {
  const { user } = useAuth();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchConfiguration();
    }
  }, [user]);

  const fetchConfiguration = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('api_configurations')
        .select('api_key')
        .eq('user_id', user.id)
        .eq('service_name', 'home_assistant')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.api_key) {
        setWebhookUrl(data.api_key);
      }
    } catch (error) {
      console.error('Error fetching Home Assistant configuration:', error);
    }
  };

  const saveConfiguration = async () => {
    if (!user || !webhookUrl) {
      toast({
        title: "Error",
        description: "Please enter a Home Assistant URL",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('api_configurations')
        .upsert({
          user_id: user.id,
          service_name: 'home_assistant',
          api_key: webhookUrl,
          is_active: true
        }, {
          onConflict: 'user_id,service_name'
        });

      if (error) throw error;

      toast({
        title: "Configuration Saved",
        description: "Your Home Assistant base URL has been saved successfully",
      });
    } catch (error) {
      console.error('Error saving Home Assistant configuration:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save Home Assistant configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testWebhook = async () => {
    if (!webhookUrl) {
      toast({
        title: "Error",
        description: "Please enter a Home Assistant URL first",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const testPayload = {
        message: "Test announcement from Lovable. This is a test notification.",
      };

      const webhookTestUrl = `${webhookUrl}/api/webhook/lovable_alexa_announce`;
      
      const response = await fetch(webhookTestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload)
      });

      if (response.ok) {
        toast({
          title: "Test Successful",
          description: "Test announcement sent successfully! Check your Alexa devices.",
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error testing webhook:', error);
      toast({
        title: "Test Failed",
        description: `Failed to send test announcement: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Home className="h-5 w-5" />
          <span>Home Assistant Integration</span>
        </CardTitle>
        <CardDescription>
          Configure Home Assistant Alexa Devices integration for TTS announcements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="webhook-url">Home Assistant Base URL</Label>
          <Input
            id="webhook-url"
            type="url"
            placeholder="http://your-ha-url:8123"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Example: http://h.ringing.org.uk:8123
          </p>
        </div>
        
        <div className="bg-muted/50 p-4 rounded-lg space-y-3">
          <h4 className="font-medium">Official Alexa Devices Integration Setup:</h4>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>1. Install the official <strong>Alexa Devices</strong> integration in Home Assistant</p>
            <p>2. Configure your Amazon account (requires MFA enabled)</p>
            <p>3. Your Echo devices will appear as notification entities</p>
            <p>4. Create an automation with webhook trigger to receive messages:</p>
            <div className="bg-background/50 p-2 rounded font-mono text-xs">
              <pre>{`automation:
  - alias: "Lovable Alexa Announcements"
    trigger:
      - platform: webhook
        webhook_id: lovable_alexa_announce
    action:
      - action: notify.send_message
        data:
          message: "{{ trigger.json.message }}"
        target:
          entity_id: notify.your_echo_device_speak`}</pre>
            </div>
            <p>5. Replace "your_echo_device" with your actual device name from the integration</p>
            <p>6. Save your Home Assistant base URL above and test below</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={saveConfiguration} 
            disabled={loading || !webhookUrl}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Configuration'}
          </Button>
          <Button 
            variant="outline"
            onClick={testWebhook} 
            disabled={testing || !webhookUrl}
          >
            <TestTube className="h-4 w-4 mr-2" />
            {testing ? 'Testing...' : 'Test'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default HomeAssistantConfiguration;