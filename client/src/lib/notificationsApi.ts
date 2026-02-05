/**
 * Notifications API Client
 */

import { api } from './api';
import type { Notification, NotificationSettings, ControlHistory, ControlHistoryStats } from '@/types/notifications';

// ============================================================
// Notifications API
// ============================================================

export const notificationsApi = {
  /**
   * Get user notifications
   */
  getNotifications: (params?: {
    project_id?: string;
    greenhouse_id?: string;
    type?: string;
    severity?: 'info' | 'warning' | 'critical';
    is_read?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.project_id) queryParams.append('project_id', params.project_id);
    if (params?.greenhouse_id) queryParams.append('greenhouse_id', params.greenhouse_id);
    if (params?.type) queryParams.append('type', params.type);
    if (params?.severity) queryParams.append('severity', params.severity);
    if (params?.is_read !== undefined) queryParams.append('is_read', params.is_read.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    return api.get<{
      notifications: Notification[];
      unread_count: number;
      pagination: { total: number; limit: number; offset: number };
    }>(`/notifications?${queryParams}`);
  },

  /**
   * Get unread count (for badge)
   */
  getUnreadCount: () =>
    api.get<{ unread_count: number }>('/notifications/unread-count'),

  /**
   * Get recent notifications (last 10 unread)
   */
  getRecent: () =>
    api.get<{ notifications: Notification[] }>('/notifications/recent'),

  /**
   * Mark notification as read
   */
  markAsRead: (id: number) =>
    api.put<{ message: string }>(`/notifications/${id}/read`),

  /**
   * Mark all notifications as read
   */
  markAllAsRead: (projectId?: number) => {
    const params = projectId ? `?project_id=${projectId}` : '';
    return api.put<{ message: string; count: number }>(`/notifications/read-all${params}`);
  },

  /**
   * Delete notification
   */
  deleteNotification: (id: number) =>
    api.delete<{ message: string }>(`/notifications/${id}`),

  /**
   * Delete all read notifications
   */
  deleteAllRead: () =>
    api.delete<{ message: string; count: number }>('/notifications'),

  /**
   * Get notification settings
   */
  getSettings: () =>
    api.get<{ settings: NotificationSettings }>('/notifications/settings'),

  /**
   * Update notification settings
   */
  updateSettings: (settings: Partial<NotificationSettings>) =>
    api.put<{ message: string; settings: NotificationSettings }>('/notifications/settings', settings),
};

// ============================================================
// Control History API
// ============================================================

export const controlHistoryApi = {
  /**
   * Get control history
   */
  getHistory: (params?: {
    project_key?: string;
    gh_key?: string;
    source?: 'manual' | 'automation' | 'schedule' | 'scene' | 'external_api';
    user_id?: number;
    control_key?: string;
    success?: boolean;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.project_key) queryParams.append('project_key', params.project_key);
    if (params?.gh_key) queryParams.append('gh_key', params.gh_key);
    if (params?.source) queryParams.append('source', params.source);
    if (params?.user_id) queryParams.append('user_id', params.user_id.toString());
    if (params?.control_key) queryParams.append('control_key', params.control_key);
    if (params?.success !== undefined) queryParams.append('success', params.success.toString());
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    return api.get<{
      history: ControlHistory[];
      pagination: { total: number; limit: number; offset: number };
    }>(`/control-history?${queryParams}`);
  },

  /**
   * Get control history statistics
   */
  getStats: (params?: {
    project_key?: string;
    gh_key?: string;
    days?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.project_key) queryParams.append('project_key', params.project_key);
    if (params?.gh_key) queryParams.append('gh_key', params.gh_key);
    if (params?.days) queryParams.append('days', params.days.toString());

    return api.get<{ stats: ControlHistoryStats }>(`/control-history/stats?${queryParams}`);
  },

  /**
   * Get recent control history for a greenhouse
   */
  getRecent: (greenhouseId: number, limit: number = 20) =>
    api.get<{ history: ControlHistory[] }>(`/control-history/recent/${greenhouseId}?limit=${limit}`),
};