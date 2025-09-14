import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Webhook, ExternalLink } from 'lucide-react';

export const N8NConfiguration = () => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadExistingConfig();
  }, []);

  const loadExistingConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('api_configurations')
        .select('api_key')
        .eq('user_id', user.id)
        .eq('service_name', 'n8n')
        .maybeSingle();

      if (data?.api_key) {
        setWebhookUrl(data.api_key);
      }
    } catch (error) {
      console.error('Error loading n8n config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveWebhookUrl = async () => {
    if (!webhookUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid webhook URL",
        variant: "destructive",
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(webhookUrl);
    } catch {
      toast({
        title: "Error", 
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('api_configurations')
        .upsert({
          user_id: user.id,
          service_name: 'n8n',
          api_key: webhookUrl.trim(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,service_name'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "n8n webhook URL saved successfully!",
      });
    } catch (error: any) {
      console.error('Error saving n8n webhook URL:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save webhook URL",
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
        description: "Please enter a webhook URL first",
        variant: "destructive",
      });
      return;
    }

    try {
      const testPayload = {
        title: "Test Notification",
        body: "This is a test from your app to verify n8n integration is working!",
        data: { test: true },
        timestamp: new Date().toISOString(),
        userId: 'test-user',
        source: 'lovable-push-notification'
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Test webhook sent successfully! Check your n8n workflow.",
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error('Webhook test failed:', error);
      toast({
        title: "Test Failed",
        description: error.message || "Could not send test webhook. Check the URL and try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          n8n Integration Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="n8n-webhook">n8n Webhook URL</Label>
          <Input
            id="n8n-webhook"
            type="url"
            placeholder="https://your-n8n-instance.com/webhook/notification"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={saveWebhookUrl} 
            disabled={isSaving}
            className="flex-1"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Webhook URL
          </Button>
          <Button 
            variant="outline" 
            onClick={testWebhook}
            disabled={!webhookUrl.trim()}
          >
            Test
          </Button>
        </div>

        <div className="bg-muted p-4 rounded-lg">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            Setup Instructions
            <ExternalLink className="h-4 w-4" />
          </h4>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>Deploy n8n on a free service like <a href="https://railway.app" target="_blank" rel="noopener noreferrer" className="text-primary underline">Railway</a> or <a href="https://render.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Render</a></li>
            <li>Create a new workflow in n8n</li>
            <li>Add a "Webhook" trigger node as the first step</li>
            <li>Copy the webhook URL from the trigger node</li>
            <li>Add nodes for Alexa actions (HTTP request to Alexa API or email notifications)</li>
            <li>Paste the webhook URL above and save</li>
          </ol>
          <p className="text-sm text-muted-foreground mt-3">
            Once configured, notifications will trigger your n8n workflow which can make Alexa announcements, send emails, or perform any automation you've set up.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};