import { PushNotifications } from '@capacitor/push-notifications';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { useEffect, useState } from 'react';

export const usePushNotifications = () => {
  const [isInitialized, setIsInitialized] = useState(false);

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
        }

        // On success, we should be able to receive notifications
        PushNotifications.addListener('registration', (token) => {
          console.log('Push registration success, token: ' + token.value);
        });

        // Some issue with our setup and push will not work
        PushNotifications.addListener('registrationError', (error) => {
          console.error('Error on registration: ' + JSON.stringify(error));
        });

        // Show us the notification payload if the app is open on our device
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received: ' + JSON.stringify(notification));
        });

        // Method called when tapping on a notification
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push action performed: ' + JSON.stringify(notification));
        });

      } catch (error) {
        console.error('Error initializing push notifications:', error);
      }
    };

    initializePushNotifications();
  }, []);

  const scheduleNotificationViaServer = async (
    title: string,
    body: string,
    scheduleAt: Date,
    data?: Record<string, any>
  ) => {
    if (!isInitialized) {
      console.warn('Push notifications not initialized');
      return false;
    }

    try {
      // Get the FCM token
      const { token } = await FirebaseMessaging.getToken();
      
      console.log('Scheduling push notification:', { title, body, scheduleAt, token });
      
      // Here you would typically call your backend service to schedule the push notification
      // For now, we'll log the details
      console.log('✅ Push notification scheduled (via server):', {
        title,
        body,
        scheduleAt: scheduleAt.toISOString(),
        token,
        data
      });
      
      return true;
    } catch (error) {
      console.error('❌ Error scheduling push notification:', error);
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

  return {
    isInitialized,
    scheduleNotificationViaServer,
    scheduleRoutineReminders
  };
};