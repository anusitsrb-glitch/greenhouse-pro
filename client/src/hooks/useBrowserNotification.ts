/**
 * useBrowserNotification Hook
 * Handle browser notification permissions and display
 */

import { useState, useEffect, useCallback } from 'react';

type PermissionStatus = 'default' | 'granted' | 'denied';

export function useBrowserNotification() {
  const [permission, setPermission] = useState<PermissionStatus>('default');
  const [isSupported, setIsSupported] = useState(false);

  // Check if browser supports notifications
  useEffect(() => {
    const supported = 'Notification' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  /**
   * Request notification permission from user
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn('Browser notifications are not supported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }, [isSupported]);

  /**
   * Show a browser notification
   */
  const showNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!isSupported) {
        console.warn('Browser notifications are not supported');
        return null;
      }

      if (permission !== 'granted') {
        console.warn('Notification permission not granted');
        return null;
      }

      try {
        const notification = new Notification(title, {
          icon: '/favicon.ico', // Change to your app icon
          badge: '/favicon.ico',
          ...options,
        });

        return notification;
      } catch (error) {
        console.error('Failed to show notification:', error);
        return null;
      }
    },
    [isSupported, permission]
  );

  return {
    permission,
    isSupported,
    requestPermission,
    showNotification,
  };
}