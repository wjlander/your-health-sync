import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink, Zap } from 'lucide-react';

export const IFTTTConfiguration = () => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadExistingConfig();
  }, []);

  const loadExistingConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('api_configurations')
        .select('api_key')
        .eq('service_name', 'ifttt')
        .single();

      if (data?.api_key) {
        setWebhookUrl(data.api_key);
      }
    } catch (error) {
      console.log('No existing IFTTT configuration found');
    } finally {
      setIsLoading(false);
    }
  };

  const saveWebhookUrl = async () => {
    if (!webhookUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid IFTTT webhook URL",
        variant: "destructive",
      });
      return;
    }

    if (!webhookUrl.includes('maker.ifttt.com/trigger/')) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid IFTTT Maker webhook URL",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('api_configurations')
        .upsert({
          user_id: user.id,
          service_name: 'ifttt',
          api_key: webhookUrl.trim(),
          is_active: true
        }, {
          onConflict: 'user_id,service_name'
        });

      if (error) throw error;

      toast({
        title: "Configuration Saved",
        description: "IFTTT webhook URL has been saved successfully!",
      });
    } catch (error) {
      console.error('Error saving IFTTT configuration:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save IFTTT configuration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testWebhook = async () => {
    if (!webhookUrl.trim()) {
      toast({
        title: "Error",
        description: "Please save your webhook URL first",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const testPayload = {
        value1: "Test Notification",
        value2: "This is a test from your Health Sync app!",
        value3: JSON.stringify({ test: true }),
        timestamp: new Date().toISOString()
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
          description: "Test notification sent to IFTTT! Check your connected services.",
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Error testing webhook:', error);
      toast({
        title: "Test Failed",
        description: "Failed to send test notification. Please check your webhook URL.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          IFTTT Integration
        </CardTitle>
        <CardDescription>
          Connect your notifications to IFTTT to trigger Alexa announcements and other automations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="webhook-url">IFTTT Webhook URL</Label>
          <Input
            id="webhook-url"
            type="url"
            placeholder="https://maker.ifttt.com/trigger/your_event/with/key/your_key"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            disabled={isLoading}
          />
          <p className="text-sm text-muted-foreground">
            Get your webhook URL from the IFTTT Maker service. Your notifications will send data as value1 (title), value2 (body), and value3 (additional data).
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={saveWebhookUrl} 
            disabled={isSaving}
            className="flex-1"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
          <Button 
            variant="outline" 
            onClick={testWebhook}
            disabled={isLoading || !webhookUrl.trim()}
          >
            {isLoading ? 'Testing...' : 'Test'}
          </Button>
        </div>

        <div className="pt-4 border-t">
          <h4 className="font-medium mb-2">Setup Instructions:</h4>
          <ol className="text-sm text-muted-foreground space-y-1">
            <li>
              1. Go to{' '}
              <a 
                href="https://ifttt.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                IFTTT.com <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>2. Create a new applet with "Webhooks" as the trigger</li>
            <li>3. Set any event name (e.g., "health_notification")</li>
            <li>4. Add Alexa "Say a specific phrase" as the action</li>
            <li>
              5. Use ingredients like "value1: value2" in your phrase
            </li>
            <li>6. Copy your webhook URL and paste it above</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};