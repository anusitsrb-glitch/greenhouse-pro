/**
 * useBrowserNotification Hook
 * Handle browser notification permissions and display
 * ✅ Patch M1: ซ่อน Browser Notification บน Capacitor (ใช้ไม่ได้ใน WebView)
 */

import { useState, useEffect, useCallback } from 'react';
import { ENV } from '@/config/env';

type PermissionStatus = 'default' | 'granted' | 'denied';

export function useBrowserNotification() {
  const [permission, setPermission] = useState<PermissionStatus>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // ✅ บน Capacitor ให้ isSupported = false เสมอ
    // เพื่อซ่อน permission banner และไม่เรียก Browser Notification API
    if (ENV.IS_CAPACITOR) {
      setIsSupported(false);
      return;
    }

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
    if (!isSupported || ENV.IS_CAPACITOR) {
      console.warn('Browser notifications are not supported on this platform');
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
      if (!isSupported || ENV.IS_CAPACITOR) {
        console.warn('Browser notifications are not supported on this platform');
        return null;
      }

      if (permission !== 'granted') {
        console.warn('Notification permission not granted');
        return null;
      }

      try {
        const notification = new Notification(title, {
          icon: '/favicon.ico',
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