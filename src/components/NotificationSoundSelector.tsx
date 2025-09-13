import { useNotificationSound } from "@/hooks/useNotificationSound";
import { useNotifications } from "@/hooks/useNotifications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Volume2, Play, Upload, Trash2 } from "lucide-react";
import { LocalNotifications } from '@capacitor/local-notifications';
import { useToast } from "@/hooks/use-toast";
import { useRef, useState } from "react";

export const NotificationSoundSelector = () => {
  const { selectedSound, updateSound, availableSounds, uploadCustomSound, deleteCustomSound } = useNotificationSound();
  const { scheduleNotification } = useNotifications();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const testSound = async () => {
    try {
      // Schedule a test notification 2 seconds from now
      const testDate = new Date();
      testDate.setSeconds(testDate.getSeconds() + 2);
      
      const success = await scheduleNotification(
        99999, // Unique test ID
        'Test Notification',
        `Testing sound: ${selectedSound.name}`,
        testDate
      );
      
      if (success) {
        toast({
          title: "Test Scheduled",
          description: `Test notification with ${selectedSound.name} sound will play in 2 seconds`,
        });
      } else {
        throw new Error('Failed to schedule test notification');
      }
    } catch (error) {
      console.error('Error testing sound:', error);
      toast({
        title: "Test Failed",
        description: "Could not schedule test notification. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/mp4'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please select a WAV, MP3, OGG, or M4A file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const success = await uploadCustomSound(file);
      if (success) {
        toast({
          title: "Sound uploaded",
          description: "Your custom notification sound has been uploaded successfully",
        });
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload the sound file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteSound = async (soundId: string) => {
    try {
      const success = await deleteCustomSound(soundId);
      if (success) {
        toast({
          title: "Sound deleted",
          description: "Custom notification sound has been deleted",
        });
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Failed to delete the sound file. Please try again.",
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
                  <div className="flex items-center justify-between w-full">
                    <span>{sound.name}</span>
                    {sound.isCustom && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteSound(sound.id);
                        }}
                        className="ml-2 p-1 h-6 w-6"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-4">
          <Button 
            variant="outline" 
            onClick={testSound}
            className="w-full flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Test Sound
          </Button>

          <div className="space-y-2">
            <Label htmlFor="sound-upload" className="text-sm font-medium">
              Upload Custom Sound
            </Label>
            <div className="flex gap-2">
              <Input
                id="sound-upload"
                type="file"
                ref={fileInputRef}
                accept="audio/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload WAV, MP3, OGG, or M4A files (max 5MB)
            </p>
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground">
          The test notification will appear in 1 second after clicking "Test Sound"
        </p>
      </CardContent>
    </Card>
  );
};