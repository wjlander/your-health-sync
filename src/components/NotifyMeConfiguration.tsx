import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink } from "lucide-react";

export const NotifyMeConfiguration = () => {
  const [accessCode, setAccessCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchConfiguration();
    }
  }, [user]);

  const fetchConfiguration = async () => {
    try {
      const { data, error } = await supabase
        .from("api_configurations")
        .select("api_key")
        .eq("user_id", user?.id)
        .eq("service_name", "notify_me")
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching configuration:", error);
        return;
      }

      if (data) {
        setAccessCode(data.api_key || "");
      }
    } catch (error) {
      console.error("Error fetching configuration:", error);
    }
  };

  const saveConfiguration = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("api_configurations")
        .upsert({
          user_id: user.id,
          service_name: "notify_me",
          api_key: accessCode,
          is_active: true,
        });

      if (error) throw error;

      toast.success("Notify Me configuration saved successfully!");
    } catch (error) {
      console.error("Error saving configuration:", error);
      toast.error("Failed to save configuration");
    } finally {
      setIsLoading(false);
    }
  };

  const testNotification = async () => {
    if (!accessCode) {
      toast.error("Please enter your access code first");
      return;
    }

    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('notify-me-alexa', {
        body: {
          notification: "Test notification from Lovable app",
          title: "Test Message",
          accessCode: accessCode
        }
      });

      if (error) throw error;

      toast.success("Test notification sent! Check your Alexa device.");
    } catch (error) {
      console.error("Error testing notification:", error);
      toast.error("Failed to send test notification");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Notify Me Alexa Integration
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open("https://www.thomptronics.com/about/notify-me", "_blank")}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </CardTitle>
        <CardDescription>
          Configure the Notify Me skill to send notifications directly to your Alexa devices.
          <br />
          First, enable the "Notify Me" skill on your Alexa device and get your access code.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="accessCode">Access Code</Label>
          <Input
            id="accessCode"
            type="text"
            placeholder="nmac.YOUR_ACCESS_CODE_HERE"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Get your access code by enabling the "Notify Me" skill and following the setup instructions.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={saveConfiguration}
            disabled={isLoading || !accessCode}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>
          
          <Button
            variant="outline"
            onClick={testNotification}
            disabled={isTesting || !accessCode}
          >
            {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test Notification
          </Button>
        </div>

        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">Setup Instructions:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>Enable the "Notify Me" skill on your Alexa device</li>
            <li>Follow the skill's setup process to get your access code</li>
            <li>Enter your access code above and save the configuration</li>
            <li>Test the integration using the "Test Notification" button</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};