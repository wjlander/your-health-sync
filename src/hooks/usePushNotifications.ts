import { PushNotifications } from '@capacitor/push-notifications';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const usePushNotifications = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const initializePushNotifications = async () => {
      try {
        // Request permission to use push notifications
        const permResult = await PushNotifications.requestPermissions();
        
        if (permResult.receive === 'granted') {
          // Register with Apple / Google to receive push via APNS/FCM
          await PushNotifications.register();
          
          console.log('✅ Push notifications registered successfully');
          setIsInitialized(true);
        } else {
          console.warn('❌ Push notification permission denied');
          toast({
            title: "Notification Permission Required",
            description: "Please enable notifications to receive routine reminders.",
            variant: "destructive",
          });
        }

        // On success, we should be able to receive notifications
        PushNotifications.addListener('registration', (token) => {
          console.log('Push registration success, token: ' + token.value);
          setPushToken(token.value);
          registerTokenWithBackend(token.value);
        });

        // Some issue with our setup and push will not work
        PushNotifications.addListener('registrationError', (error) => {
          console.error('Error on registration: ' + JSON.stringify(error));
          toast({
            title: "Registration Error",
            description: "Failed to register for push notifications.",
            variant: "destructive",
          });
        });

        // Show us the notification payload if the app is open on our device
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received: ' + JSON.stringify(notification));
          toast({
            title: notification.title || "Notification",
            description: notification.body || "You have a new notification.",
          });
        });

        // Method called when tapping on a notification
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push action performed: ' + JSON.stringify(notification));
        });

      } catch (error) {
        console.error('Error initializing push notifications:', error);
        toast({
          title: "Notification Setup Error",
          description: "Failed to initialize push notifications.",
          variant: "destructive",
        });
      }
    };

    initializePushNotifications();
  }, [toast]);

  // Register FCM token with backend
  const registerTokenWithBackend = async (token: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('No session found, skipping token registration');
        return;
      }

      const deviceInfo = {
        platform: 'android', // Could detect platform dynamically
        timestamp: new Date().toISOString()
      };

      const { error } = await supabase.functions.invoke('register-fcm-token', {
        body: { token, deviceInfo }
      });

      if (error) {
        console.error('Error registering FCM token:', error);
        toast({
          title: "Token Registration Failed",
          description: "Failed to register device for notifications.",
          variant: "destructive",
        });
      } else {
        console.log('✅ FCM token registered successfully');
        toast({
          title: "Notifications Ready",
          description: "Device registered for push notifications.",
        });
      }
    } catch (error) {
      console.error('Error in registerTokenWithBackend:', error);
    }
  };

  const scheduleNotificationViaServer = async (
    title: string,
    body: string,
    scheduleAt: Date,
    data?: Record<string, any>,
    options?: {
      includeIFTTT?: boolean;
      iftttWebhookUrl?: string;
    }
  ) => {
    if (!isInitialized) {
      console.warn('Push notifications not initialized');
      toast({
        title: "Notifications Not Available",
        description: "Please enable push notifications first.",
        variant: "destructive",
      });
      return false;
    }

    try {
      console.log('Scheduling push notification:', { title, body, scheduleAt });
      
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          title,
          body,
          data,
          scheduleFor: scheduleAt.toISOString(),
          immediate: false,
          includeIFTTT: options?.includeIFTTT || false,
          iftttWebhookUrl: options?.iftttWebhookUrl
        }
      });

      if (error) {
        console.error('Error scheduling notification:', error);
        toast({
          title: "Scheduling Failed",
          description: "Failed to schedule notification.",
          variant: "destructive",
        });
        return false;
      } else {
        console.log('✅ Push notification scheduled successfully');
        toast({
          title: "Reminder Scheduled",
          description: `Notification scheduled for ${scheduleAt.toLocaleString()}`,
        });
        return true;
      }
    } catch (error) {
      console.error('❌ Error scheduling push notification:', error);
      toast({
        title: "Error",
        description: "An error occurred while scheduling the notification.",
        variant: "destructive",
      });
      return false;
    }
  };

  const scheduleRoutineReminders = async (routine: any) => {
    if (!routine.reminder_times || routine.reminder_times.length === 0) {
      return;
    }

    for (const reminderTime of routine.reminder_times) {
      try {
        // Parse the time (format: "HH:MM")
        const [hours, minutes] = reminderTime.split(':').map(Number);
        
        // Create notification for today at the specified time
        const scheduleDate = new Date();
        scheduleDate.setHours(hours, minutes, 0, 0);
        
        // If time has passed today, schedule for tomorrow
        if (scheduleDate.getTime() <= Date.now()) {
          scheduleDate.setDate(scheduleDate.getDate() + 1);
        }

        await scheduleNotificationViaServer(
          routine.title,
          `Time for your ${routine.routine_type} reminder: ${routine.description || routine.title}`,
          scheduleDate,
          { routineId: routine.id, reminderTime }
        );
      } catch (error) {
        console.error(`Error scheduling reminder for ${routine.title}:`, error);
      }
    }
  };

  const sendImmediateNotification = async (
    title: string,
    body: string,
    data?: Record<string, any>,
    options?: {
      includeIFTTT?: boolean;
      iftttWebhookUrl?: string;
    }
  ) => {
    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          title,
          body,
          data,
          immediate: true,
          includeIFTTT: options?.includeIFTTT || false,
          iftttWebhookUrl: options?.iftttWebhookUrl
        }
      });

      if (error) {
        console.error('Error sending immediate notification:', error);
        toast({
          title: "Notification Failed",
          description: "Failed to send notification.",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Notification Sent",
        description: "Notification sent successfully!",
      });
      return true;
    } catch (error) {
      console.error('Error sending immediate notification:', error);
      return false;
    }
  };

  return {
    isInitialized,
    scheduleNotificationViaServer,
    sendImmediateNotification,
    scheduleRoutineReminders
  };
};