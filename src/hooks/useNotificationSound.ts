import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface NotificationSound {
  id: string;
  name: string;
  filename: string;
  isCustom?: boolean;
  url?: string;
}

export const NOTIFICATION_SOUNDS: NotificationSound[] = [
  { id: 'default', name: 'Default', filename: 'default' },
  { id: 'beep', name: 'Beep', filename: 'beep', url: '/sounds/beep.wav' },
  { id: 'chime', name: 'Chime', filename: 'chime', url: '/sounds/chime.wav' },
  { id: 'bell', name: 'Bell', filename: 'bell', url: '/sounds/bell.wav' },
  { id: 'notification', name: 'Notification', filename: 'notification', url: '/sounds/notification.wav' },
  { id: 'alert', name: 'Alert', filename: 'alert', url: '/sounds/alert.wav' },
];

const STORAGE_KEY = 'notification-sound-preference';

export const useNotificationSound = () => {
  const { user } = useAuth();
  const [selectedSound, setSelectedSound] = useState<NotificationSound>(
    NOTIFICATION_SOUNDS[0] // Default to 'default'
  );
  const [customSounds, setCustomSounds] = useState<NotificationSound[]>([]);

  // Load saved preference and custom sounds on mount
  useEffect(() => {
    const loadInitialData = async () => {
      await loadCustomSounds();
      
      // Load saved preference after custom sounds are loaded
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const soundId = JSON.parse(saved);
          const allSounds = [...NOTIFICATION_SOUNDS, ...customSounds];
          const sound = allSounds.find(s => s.id === soundId) || NOTIFICATION_SOUNDS[0];
          setSelectedSound(sound);
          console.log('Loaded saved sound preference:', sound);
        } catch (error) {
          console.error('Error loading sound preference:', error);
          setSelectedSound(NOTIFICATION_SOUNDS[0]);
        }
      }
    };

    if (user) {
      loadInitialData();
    }
  }, [user]);

  // Update selected sound when custom sounds change and there's a saved preference
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && customSounds.length > 0) {
      try {
        const soundId = JSON.parse(saved);
        const allSounds = [...NOTIFICATION_SOUNDS, ...customSounds];
        const sound = allSounds.find(s => s.id === soundId);
        if (sound && sound.id !== selectedSound.id) {
          setSelectedSound(sound);
          console.log('Updated sound after custom sounds loaded:', sound);
        }
      } catch (error) {
        console.error('Error updating sound preference:', error);
      }
    }
  }, [customSounds]);

  const loadCustomSounds = async () => {
    if (!user) return;

    try {
      const { data: files, error } = await supabase.storage
        .from('notification-sounds')
        .list(user.id);

      if (error) {
        console.error('Error loading custom sounds:', error);
        return;
      }

      const customSoundsList: NotificationSound[] = await Promise.all(
        files.map(async (file) => {
          const { data } = supabase.storage
            .from('notification-sounds')
            .getPublicUrl(`${user.id}/${file.name}`);

          return {
            id: `custom-${file.name}`,
            name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
            filename: file.name,
            isCustom: true,
            url: data.publicUrl,
          };
        })
      );

      setCustomSounds(customSoundsList);
    } catch (error) {
      console.error('Error loading custom sounds:', error);
    }
  };

  const uploadCustomSound = async (file: File): Promise<boolean> => {
    if (!user) return false;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('notification-sounds')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return false;
      }

      // Reload custom sounds
      await loadCustomSounds();
      return true;
    } catch (error) {
      console.error('Error uploading sound:', error);
      return false;
    }
  };

  const deleteCustomSound = async (soundId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const sound = customSounds.find(s => s.id === soundId);
      if (!sound) return false;

      const { error } = await supabase.storage
        .from('notification-sounds')
        .remove([`${user.id}/${sound.filename}`]);

      if (error) {
        console.error('Delete error:', error);
        return false;
      }

      // If deleted sound was selected, switch to default
      if (selectedSound.id === soundId) {
        updateSound(NOTIFICATION_SOUNDS[0]);
      }

      // Reload custom sounds
      await loadCustomSounds();
      return true;
    } catch (error) {
      console.error('Error deleting sound:', error);
      return false;
    }
  };

  // Save preference when changed
  const updateSound = (sound: NotificationSound) => {
    console.log('Updating notification sound to:', sound);
    setSelectedSound(sound);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sound.id));
    
    // Force a re-render to ensure the change is picked up immediately
    window.dispatchEvent(new CustomEvent('notification-sound-changed', { detail: sound }));
  };

  return {
    selectedSound,
    updateSound,
    availableSounds: [...NOTIFICATION_SOUNDS, ...customSounds],
    uploadCustomSound,
    deleteCustomSound,
    loadCustomSounds,
  };
};