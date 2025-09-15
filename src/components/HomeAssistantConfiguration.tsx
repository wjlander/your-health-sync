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
        description: "Please enter a webhook URL",
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
        description: "Your Home Assistant webhook URL has been saved successfully",
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
        description: "Please enter a webhook URL first",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const testPayload = {
        title: "Test Notification",
        message: "Test Notification. This is a test notification from Lovable",
        data: {
          entity_id: "all",
          type: "tts",
          method: "all"
        },
        timestamp: new Date().toISOString(),
        user_id: user?.id,
        source: 'lovable-test'
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload)
      });

      if (response.ok) {
        toast({
          title: "Test Successful",
          description: "Test webhook sent successfully! Check your Home Assistant for the notification.",
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error testing webhook:', error);
      toast({
        title: "Test Failed",
        description: `Failed to send test webhook: ${error.message}`,
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
          Configure Home Assistant webhook to trigger TTS announcements on Alexa devices
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="webhook-url">Webhook URL</Label>
          <Input
            id="webhook-url"
            type="url"
            placeholder="http://your-ha-url:8123/api/webhook/your-webhook-id"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Example: http://h.ringing.org.uk:8123/api/webhook/-Xi1hEA37wspyrZFjm9C_ruR1
          </p>
        </div>
        
        <div className="bg-muted/50 p-4 rounded-lg space-y-3">
          <h4 className="font-medium">Home Assistant Automation Setup:</h4>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>1. Create a new automation in Home Assistant with webhook trigger</p>
            <p>2. Add this action to call Alexa Media Player:</p>
            <div className="bg-background/50 p-2 rounded font-mono text-xs">
              <pre>{`service: notify.alexa_media
target:
  entity_id: media_player.your_echo_device
data:
  message: "{{ trigger.json.message | default('No message') }}"
  data:
    type: tts`}</pre>
            </div>
            <p>3. Alternative if the above doesn't work:</p>
            <div className="bg-background/50 p-2 rounded font-mono text-xs">
              <pre>{`service: notify.alexa_media
target:
  entity_id: media_player.your_echo_device
data:
  message: "{{ trigger.json['message'] | default('No message') }}"
  data:
    type: tts`}</pre>
            </div>
            <p>4. Replace "your_echo_device" with your actual Echo device entity</p>
            <p>5. Test the webhook below to verify the data structure</p>
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