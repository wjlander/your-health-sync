import { LocalNotifications } from '@capacitor/local-notifications';
import { useEffect } from 'react';

interface NotificationPermissions {
  display: 'granted' | 'denied' | 'prompt';
}

export const useNotifications = () => {
  
  useEffect(() => {
    // Request notification permissions on app start
    const requestPermissions = async () => {
      try {
        const permissionStatus = await LocalNotifications.checkPermissions();
        console.log('Current notification permissions:', permissionStatus);
        
        if (permissionStatus.display !== 'granted') {
          const result = await LocalNotifications.requestPermissions();
          console.log('Requested notification permissions:', result);
          
          if (result.display === 'granted') {
            console.log('✅ Notification permissions granted');
          } else {
            console.warn('❌ Notification permissions denied');
          }
        } else {
          console.log('✅ Notification permissions already granted');
        }
      } catch (error) {
        console.error('❌ Error with notification permissions:', error);
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
      // Check permissions first
      const permissionStatus = await LocalNotifications.checkPermissions();
      if (permissionStatus.display !== 'granted') {
        console.error('❌ Notification permissions not granted');
        return false;
      }

      // Ensure the scheduled time is in the future
      const now = new Date();
      if (scheduleAt.getTime() <= now.getTime()) {
        console.warn('⚠️ Scheduled time is in the past, scheduling for tomorrow');
        scheduleAt.setDate(scheduleAt.getDate() + 1);
      }

      await LocalNotifications.schedule({
        notifications: [{
          id,
          title,
          body,
          schedule: { at: scheduleAt },
          sound: 'beep.wav',
          attachments: undefined,
          actionTypeId: '',
          extra: null
        }]
      });
      
      console.log(`✅ Notification scheduled: "${title}" at ${scheduleAt.toLocaleString()}`);
      console.log(`📱 Notification ID: ${id}`);
      
      // Verify the notification was scheduled
      const pending = await LocalNotifications.getPending();
      const scheduledNotification = pending.notifications.find(n => n.id === id);
      if (scheduledNotification) {
        console.log('✅ Notification confirmed in pending list');
      } else {
        console.warn('⚠️ Notification not found in pending list');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error scheduling notification:', error);
      console.error('Error details:', JSON.stringify(error));
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

        // Create a more reliable notification ID
        const routineIdHash = routine.id.replace(/-/g, '').substring(0, 6);
        const timeHash = `${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}`;
        const notificationId = parseInt(`${routineIdHash}${timeHash}`) % 2147483647; // Ensure it fits in int32
        
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