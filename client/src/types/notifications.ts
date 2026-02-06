/**
 * Notification System Types
 */

export type NotificationType =
  | 'device_offline'
  | 'device_online'
  | 'sensor_alert'
  | 'sensor_offline'
  | 'control_action'
  | 'auto_mode_changed'
  | 'system_error'
  | 'info';

export type NotificationSeverity = 'info' | 'warning' | 'critical';

export interface Notification {
  id: number;
  user_id: number;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  metadata: Record<string, any>;
  project_id: number | null;
  greenhouse_id: number | null;
  project_name: string | null;
  greenhouse_name: string | null;
  is_read: boolean;
  read_at: string | null;
  auto_dismiss: boolean;
  dismiss_after_seconds: number;
  created_at: string;
}

export interface NotificationSettings {
  enabled: boolean;
  device_offline: boolean;
  device_online: boolean;
  sensor_alert: boolean;
  sensor_offline: boolean; 
  control_action: boolean;
  auto_mode_changed: boolean;
  system_error: boolean;
  show_info: boolean;
  show_warning: boolean;
  show_critical: boolean;
  project_filter: string[];
  greenhouse_filter: string[];
  in_app: boolean;
  email: boolean;
  line_notify: boolean;
  push: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

export interface ControlHistory {
  id: number;
  greenhouse_id: number;
  greenhouse_name: string;
  gh_key: string;
  project_key: string;
  project_name: string;
  control_key: string;
  control_name: string | null;
  action: string;
  value: string | null;
  source: 'manual' | 'automation' | 'schedule' | 'scene' | 'external_api';
  source_id: number | null;
  user_id: number | null;
  user_name: string | null;
  user_full_name: string | null;
  api_key_prefix: string | null;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export interface ControlHistoryStats {
  bySource: Record<string, number>;
  successCount: number;
  failureCount: number;
  topUsers: Array<{
    username: string;
    full_name: string | null;
    count: number;
  }>;
  dailyTrend: Array<{
    date: string;
    count: number;
    success_count: number;
  }>;
  topDevices: Array<{
    control_key: string;
    control_name: string | null;
    greenhouse_name: string;
    count: number;
  }>;
}

export interface DeviceStatusLog {
  id: number;
  greenhouse_id: number;
  previous_status: 'online' | 'offline' | 'unknown';
  new_status: 'online' | 'offline' | 'unknown';
  reason: string | null;
  signal_strength: number | null;
  wifi_ssid: string | null;
  ip_address: string | null;
  firmware_version: string | null;
  offline_duration: number | null;
  created_at: string;
}