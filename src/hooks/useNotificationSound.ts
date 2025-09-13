import { useState, useEffect } from 'react';

export interface NotificationSound {
  id: string;
  name: string;
  filename: string;
}

export const NOTIFICATION_SOUNDS: NotificationSound[] = [
  { id: 'default', name: 'Default', filename: 'default' },
  { id: 'beep', name: 'Beep', filename: 'beep.wav' },
  { id: 'chime', name: 'Chime', filename: 'chime.wav' },
  { id: 'bell', name: 'Bell', filename: 'bell.wav' },
  { id: 'notification', name: 'Notification', filename: 'notification.wav' },
  { id: 'alert', name: 'Alert', filename: 'alert.wav' },
];

const STORAGE_KEY = 'notification-sound-preference';

export const useNotificationSound = () => {
  const [selectedSound, setSelectedSound] = useState<NotificationSound>(
    NOTIFICATION_SOUNDS[0] // Default to 'default'
  );

  // Load saved preference on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const soundId = JSON.parse(saved);
      const sound = NOTIFICATION_SOUNDS.find(s => s.id === soundId) || NOTIFICATION_SOUNDS[0];
      setSelectedSound(sound);
    }
  }, []);

  // Save preference when changed
  const updateSound = (sound: NotificationSound) => {
    setSelectedSound(sound);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sound.id));
  };

  return {
    selectedSound,
    updateSound,
    availableSounds: NOTIFICATION_SOUNDS,
  };
};