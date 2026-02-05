/**
 * useNotifications Hook
 * Real-time notification polling and management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationsApi } from '@/lib/notificationsApi';
import type { Notification } from '@/types/notifications';

interface UseNotificationsOptions {
  pollingInterval?: number; // milliseconds (default: 5000 = 5 seconds)
  autoMarkAsRead?: boolean; // auto mark as read when user clicks
  enabled?: boolean; // enable/disable polling
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    pollingInterval = 5000, // 5 วินาที ⚡ เร็ว!
    autoMarkAsRead = true,
    enabled = true,
  } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch recent notifications
   */
  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const response = await notificationsApi.getRecent();

      if (response.success && response.data) {
        setNotifications(response.data.notifications);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError('ไม่สามารถโหลดการแจ้งเตือนได้');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch unread count
   */
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await notificationsApi.getUnreadCount();

      if (response.success && response.data) {
        setUnreadCount(response.data.unread_count);
      }
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  }, []);

  /**
   * Mark notification as read
   */
  const markAsRead = useCallback(
    async (id: number) => {
      try {
        const response = await notificationsApi.markAsRead(id);

        if (response.success) {
          // Update local state
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (err) {
        console.error('Failed to mark as read:', err);
      }
    },
    []
  );

  /**
   * Mark all as read
   */
  const markAllAsRead = useCallback(async (projectId?: number) => {
    try {
      const response = await notificationsApi.markAllAsRead(projectId);

      if (response.success) {
        // Refresh notifications
        await fetchNotifications();
        await fetchUnreadCount();
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, [fetchNotifications, fetchUnreadCount]);

  /**
   * Delete notification
   */
  const deleteNotification = useCallback(
    async (id: number) => {
      try {
        const response = await notificationsApi.deleteNotification(id);

        if (response.success) {
          // Remove from local state
          setNotifications((prev) => prev.filter((n) => n.id !== id));

          // Update unread count if it was unread
          const notification = notifications.find((n) => n.id === id);
          if (notification && !notification.is_read) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        }
      } catch (err) {
        console.error('Failed to delete notification:', err);
      }
    },
    [notifications]
  );

  /**
   * Delete all read notifications
   */
  const deleteAllRead = useCallback(async () => {
    try {
      const response = await notificationsApi.deleteAllRead();

      if (response.success) {
        // Remove read notifications from local state
        setNotifications((prev) => prev.filter((n) => !n.is_read));
      }
    } catch (err) {
      console.error('Failed to delete all read:', err);
    }
  }, []);

  /**
   * Handle notification click
   */
  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      if (autoMarkAsRead && !notification.is_read) {
        markAsRead(notification.id);
      }
    },
    [autoMarkAsRead, markAsRead]
  );

  /**
   * Start polling
   */
  const startPolling = useCallback(() => {
    if (!enabled) return;

    // Initial fetch
    fetchNotifications();
    fetchUnreadCount();

    // Set up polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(() => {
      fetchNotifications();
      fetchUnreadCount();
    }, pollingInterval);
  }, [enabled, fetchNotifications, fetchUnreadCount, pollingInterval]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  /**
   * Refresh notifications manually
   */
  const refresh = useCallback(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  // Start/stop polling based on enabled option
  useEffect(() => {
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, startPolling, stopPolling]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
    handleNotificationClick,
    refresh,
    startPolling,
    stopPolling,
  };
}