import { LocalNotifications } from '@capacitor/local-notifications';
import { useEffect } from 'react';
import { useNotificationSound } from './useNotificationSound';

interface NotificationPermissions {
  display: 'granted' | 'denied' | 'prompt';
}

export const useNotifications = () => {
  const { selectedSound } = useNotificationSound();
  
  useEffect(() => {
    // Request notification permissions on app start
    const requestPermissions = async () => {
      try {
        const result = await LocalNotifications.requestPermissions();
        console.log('Notification permissions:', result);
      } catch (error) {
        console.error('Error requesting notification permissions:', error);
      }
    };

    requestPermissions();
  }, []);

  const scheduleNotification = async (
    id: number,
    title: string,
    body: string,
    scheduleAt: Date
  ) => {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id,
            schedule: { at: scheduleAt },
            sound: selectedSound.filename,
            attachments: undefined,
            actionTypeId: '',
            extra: null
          }
        ]
      });
      console.log(`Notification scheduled: ${title} at ${scheduleAt}`);
      return true;
    } catch (error) {
      console.error('Error scheduling notification:', error);
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

        const notificationId = parseInt(`${routine.id.replace(/-/g, '').substring(0, 8)}${hours}${minutes}`);
        
        await scheduleNotification(
          notificationId,
          routine.title,
          `Time for your ${routine.routine_type} reminder: ${routine.description || routine.title}`,
          scheduleDate
        );
      } catch (error) {
        console.error(`Error scheduling reminder for ${routine.title}:`, error);
      }
    }
  };

  const cancelNotification = async (id: number) => {
    try {
      await LocalNotifications.cancel({ notifications: [{ id }] });
      console.log(`Notification cancelled: ${id}`);
    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  };

  const cancelAllNotifications = async () => {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        const ids = pending.notifications.map(n => ({ id: n.id }));
        await LocalNotifications.cancel({ notifications: ids });
      }
      console.log('All notifications cancelled');
    } catch (error) {
      console.error('Error cancelling all notifications:', error);
    }
  };

  return {
    scheduleNotification,
    scheduleRoutineReminders,
    cancelNotification,
    cancelAllNotifications
  };
};