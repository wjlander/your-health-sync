import { useNotificationSound } from "@/hooks/useNotificationSound";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Volume2, Play } from "lucide-react";
import { LocalNotifications } from '@capacitor/local-notifications';
import { useToast } from "@/hooks/use-toast";

export const NotificationSoundSelector = () => {
  const { selectedSound, updateSound, availableSounds } = useNotificationSound();
  const { toast } = useToast();

  const testSound = async () => {
    try {
      // Schedule a test notification with the selected sound
      await LocalNotifications.schedule({
        notifications: [
          {
            title: "Test Notification",
            body: "This is how your notifications will sound",
            id: 99999, // Use a high ID for test notifications
            schedule: { at: new Date(Date.now() + 1000) }, // 1 second from now
            sound: selectedSound.filename,
            attachments: undefined,
            actionTypeId: '',
            extra: null
          }
        ]
      });
      
      toast({
        title: "Test notification scheduled",
        description: "You should hear the notification sound in 1 second",
      });
    } catch (error) {
      console.error('Error testing notification sound:', error);
      toast({
        title: "Error",
        description: "Failed to test notification sound",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          Notification Sound
        </CardTitle>
        <CardDescription>
          Choose your preferred notification sound for reminders and alerts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Sound Selection</label>
          <Select
            value={selectedSound.id}
            onValueChange={(value) => {
              const sound = availableSounds.find(s => s.id === value);
              if (sound) updateSound(sound);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select notification sound" />
            </SelectTrigger>
            <SelectContent>
              {availableSounds.map((sound) => (
                <SelectItem key={sound.id} value={sound.id}>
                  {sound.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Button 
          variant="outline" 
          onClick={testSound}
          className="w-full flex items-center gap-2"
        >
          <Play className="h-4 w-4" />
          Test Sound
        </Button>
        
        <p className="text-xs text-muted-foreground">
          The test notification will appear in 1 second after clicking "Test Sound"
        </p>
      </CardContent>
    </Card>
  );
};