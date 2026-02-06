/**
 * Notification Service
 * Handle notification creation, distribution, and auto-cleanup
 *
 * ✅ FIX:
 * 1) NotificationType union syntax
 * 2) DB dedup for sensor_offline summary + sensor_alert (prevents spam, survives restart)
 * 3) json_extract uses $.sensorKey (camelCase) to match metadata from sensorMonitor.ts
 */

import { db } from '../db/connection.js';

// ============================================================
// Types
// ============================================================

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

export interface CreateNotificationData {
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  projectId?: number;
  greenhouseId?: number;
  userId?: number; // ถ้าระบุ = ส่งให้ user คนเดียว, ไม่ระบุ = ส่งให้ทุกคนที่มีสิทธิ์
  autoDismiss?: boolean;
  dismissAfterSeconds?: number;
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
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

// ============================================================
// Dedup helpers (DB)
// ============================================================

function hasRecentNotification(params: {
  userId: number;
  type: NotificationType;
  greenhouseId?: number;
  sensorKey?: string;      // for sensor_alert
  triggered?: 'low' | 'high'; // for sensor_alert
  windowMinutes: number;
}): boolean {
  const whereGh = params.greenhouseId ? `AND greenhouse_id = ?` : '';

  // sensor_alert specific filters
  const whereSensor =
    params.sensorKey ? `AND json_extract(metadata, '$.sensorKey') = ?` : '';
  const whereTriggered =
    params.triggered ? `AND json_extract(metadata, '$.triggered') = ?` : '';

  const q = `
    SELECT id FROM notifications
    WHERE user_id = ?
      AND type = ?
      ${whereGh}
      ${whereSensor}
      ${whereTriggered}
      AND created_at >= datetime('now', ?)
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const args: any[] = [params.userId, params.type];
  if (params.greenhouseId) args.push(params.greenhouseId);
  if (params.sensorKey) args.push(params.sensorKey);
  if (params.triggered) args.push(params.triggered);
  args.push(`-${params.windowMinutes} minutes`);

  const row = db.prepare(q).get(...args);
  return !!row;
}

/**
 * ✅ Used by sensorMonitor.ts to dedup BEFORE creating summary
 * (prevents creating the same offline summary again even after restart)
 */
export function canCreateSensorOfflineSummary(params: {
  projectId: number;
  greenhouseId: number;
  windowMinutes: number; // should be 30
}): boolean {
  try {
    const users = getTargetUsers(params.projectId);
    // ถ้ามีใครคนใดคนหนึ่งได้รับ summary ภายใน window แล้ว → ให้บล็อค (กันสร้างซ้ำ)
    for (const userId of users) {
      if (hasRecentNotification({
        userId,
        type: 'sensor_offline',
        greenhouseId: params.greenhouseId,
        windowMinutes: params.windowMinutes,
      })) {
        return false;
      }
    }
    return true;
  } catch (e) {
    console.error('❌ canCreateSensorOfflineSummary error:', e);
    // fail-open เพื่อไม่ทำให้ระบบเงียบสนิท
    return true;
  }
}

/**
 * ✅ Used by sensorMonitor.ts to dedup BEFORE creating sensor_alert
 */
export function canCreateSensorAlert(params: {
  projectId: number;
  greenhouseId: number;
  sensorKey: string;
  triggered: 'low' | 'high';
  windowMinutes: number;
}): boolean {
  try {
    const users = getTargetUsers(params.projectId);
    for (const userId of users) {
      if (hasRecentNotification({
        userId,
        type: 'sensor_alert',
        greenhouseId: params.greenhouseId,
        sensorKey: params.sensorKey,
        triggered: params.triggered,
        windowMinutes: params.windowMinutes,
      })) {
        return false;
      }
    }
    return true;
  } catch (e) {
    console.error('❌ canCreateSensorAlert error:', e);
    return true;
  }
}

// ============================================================
// Main Functions
// ============================================================

/**
 * Create and distribute notification
 * - applies user settings
 * - applies DB dedup for sensor_offline (summary) and sensor_alert
 */
export function createNotification(data: CreateNotificationData): void {
  try {
    const metadata = JSON.stringify(data.metadata || {});

    // ถ้าระบุ userId = สร้างให้ user คนนั้น
    if (data.userId) {
      const settings = getUserSettings(data.userId);
      if (!shouldSendNotification(settings, data)) {
        console.log(`📵 Notification skipped for user ${data.userId} (settings)`);
        return;
      }

      // ✅ DB dedup per user
      if (shouldDedup(data)) {
        const ok = canInsertForUser(data.userId, data);
        if (!ok) {
          console.log(`🛑 Dedup ${data.type}: user=${data.userId} gh=${data.greenhouseId}`);
          return;
        }
      }

      insertNotification({
        userId: data.userId,
        type: data.type,
        severity: data.severity,
        title: data.title,
        message: data.message,
        metadata,
        projectId: data.projectId,
        greenhouseId: data.greenhouseId,
        autoDismiss: data.autoDismiss !== false ? 1 : 0,
        dismissAfterSeconds: data.dismissAfterSeconds || 300,
      });

      console.log(`🔔 Notification created for user ${data.userId}: ${data.type}`);
      return;
    }

    // ไม่ระบุ userId = ส่งให้ทุกคนที่มีสิทธิ์เข้าถึง project
    const targetUsers = getTargetUsers(data.projectId);

    let sentCount = 0;
    for (const userId of targetUsers) {
      const settings = getUserSettings(userId);
      if (!shouldSendNotification(settings, data)) continue;

      // ✅ DB dedup per user
      if (shouldDedup(data)) {
        const ok = canInsertForUser(userId, data);
        if (!ok) {
          // ไม่ส่งให้ user นี้ แต่ user อื่นยังส่งได้ตาม settings/dedup
          continue;
        }
      }

      insertNotification({
        userId,
        type: data.type,
        severity: data.severity,
        title: data.title,
        message: data.message,
        metadata,
        projectId: data.projectId,
        greenhouseId: data.greenhouseId,
        autoDismiss: data.autoDismiss !== false ? 1 : 0,
        dismissAfterSeconds: data.dismissAfterSeconds || 300,
      });

      sentCount++;
    }

    console.log(`🔔 Notification sent to ${sentCount} users: ${data.type}`);
  } catch (error) {
    console.error('❌ Failed to create notification:', error);
  }
}

// ============================================================
// Dedup policy
// ============================================================

function shouldDedup(data: CreateNotificationData): boolean {
  return data.type === 'sensor_offline' || data.type === 'sensor_alert';
}

function canInsertForUser(userId: number, data: CreateNotificationData): boolean {
  // sensor_offline = summary per greenhouse every 30 minutes
  if (data.type === 'sensor_offline') {
    const windowMinutes = 30;
    return !hasRecentNotification({
      userId,
      type: 'sensor_offline',
      greenhouseId: data.greenhouseId,
      windowMinutes,
    });
  }

  // sensor_alert = per sensorKey + triggered every 10 minutes (default)
  if (data.type === 'sensor_alert') {
    const sensorKey = (data.metadata as any)?.sensorKey;
    const triggered = (data.metadata as any)?.triggered;

    // ถ้า metadata ไม่ครบ → ให้ส่งได้ (fail-open) แต่ควรแก้ให้ครบใน sensorMonitor.ts
    if (typeof sensorKey !== 'string' || (triggered !== 'low' && triggered !== 'high')) return true;

    const windowMinutes = 10;
    return !hasRecentNotification({
      userId,
      type: 'sensor_alert',
      greenhouseId: data.greenhouseId,
      sensorKey,
      triggered,
      windowMinutes,
    });
  }

  return true;
}

// ============================================================
// Target users + settings
// ============================================================

function getTargetUsers(projectId?: number): number[] {
  try {
    if (!projectId) {
      const users = db.prepare(`
        SELECT id FROM users 
        WHERE is_active = 1 AND role IN ('admin', 'superadmin', 'operator')
      `).all() as { id: number }[];
      return users.map(u => u.id);
    }

    const users = db.prepare(`
      SELECT DISTINCT u.id FROM users u
      LEFT JOIN user_project_access upa ON u.id = upa.user_id
      WHERE u.is_active = 1
        AND (u.role IN ('admin', 'superadmin') OR upa.project_id = ?)
    `).all(projectId) as { id: number }[];

    return users.map(u => u.id);
  } catch (error) {
    console.error('❌ Failed to get target users:', error);
    return [];
  }
}

export function getUserSettings(userId: number): NotificationSettings | null {
  try {
    const settings = db.prepare(`
      SELECT * FROM notification_settings WHERE user_id = ?
    `).get(userId) as any;

    if (!settings) {
      createDefaultSettings(userId);
      return getUserSettings(userId);
    }

    return {
      enabled: Boolean(settings.enabled),
      device_offline: Boolean(settings.device_offline),
      device_online: Boolean(settings.device_online),
      sensor_alert: Boolean(settings.sensor_alert),
      sensor_offline: Boolean(settings.sensor_offline),
      control_action: Boolean(settings.control_action),
      auto_mode_changed: Boolean(settings.auto_mode_changed),
      system_error: Boolean(settings.system_error),
      show_info: Boolean(settings.show_info),
      show_warning: Boolean(settings.show_warning),
      show_critical: Boolean(settings.show_critical),
      project_filter: JSON.parse(settings.project_filter || '[]'),
      greenhouse_filter: JSON.parse(settings.greenhouse_filter || '[]'),
      quiet_hours_enabled: Boolean(settings.quiet_hours_enabled),
      quiet_hours_start: settings.quiet_hours_start || '22:00',
      quiet_hours_end: settings.quiet_hours_end || '07:00',
    };
  } catch (error) {
    console.error('❌ Failed to get user settings:', error);
    return null;
  }
}

function createDefaultSettings(userId: number): void {
  try {
    db.prepare(`INSERT INTO notification_settings (user_id) VALUES (?)`).run(userId);
  } catch (error) {
    console.error('❌ Failed to create default settings:', error);
  }
}

function shouldSendNotification(settings: NotificationSettings | null, data: CreateNotificationData): boolean {
  if (!settings || !settings.enabled) return false;

  // type filter
  if (!settings[data.type as keyof NotificationSettings]) return false;

  // severity filter
  if (data.severity === 'info' && !settings.show_info) return false;
  if (data.severity === 'warning' && !settings.show_warning) return false;
  if (data.severity === 'critical' && !settings.show_critical) return false;

  // project filter
  if (settings.project_filter.length > 0 && data.projectId) {
    if (!settings.project_filter.includes(data.projectId.toString())) return false;
  }

  // greenhouse filter
  if (settings.greenhouse_filter.length > 0 && data.greenhouseId) {
    if (!settings.greenhouse_filter.includes(data.greenhouseId.toString())) return false;
  }

  // quiet hours
  if (settings.quiet_hours_enabled) {
    const now = new Date();
    const currentTime =
      `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const start = settings.quiet_hours_start;
    const end = settings.quiet_hours_end;

    if (start < end) {
      if (currentTime >= start && currentTime <= end) return false;
    } else {
      if (currentTime >= start || currentTime <= end) return false;
    }
  }

  return true;
}

// ============================================================
// DB operations
// ============================================================

function insertNotification(data: {
  userId: number;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  metadata: string;
  projectId?: number;
  greenhouseId?: number;
  autoDismiss: number;
  dismissAfterSeconds: number;
}): void {
  db.prepare(`
    INSERT INTO notifications (
      user_id, type, severity, title, message, metadata,
      project_id, greenhouse_id, auto_dismiss, dismiss_after_seconds
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.userId,
    data.type,
    data.severity,
    data.title,
    data.message,
    data.metadata,
    data.projectId || null,
    data.greenhouseId || null,
    data.autoDismiss,
    data.dismissAfterSeconds
  );
}

// ============================================================
// Read / cleanup / device status change (ของเดิม)
// ============================================================

export function markAsRead(notificationId: number, userId: number): boolean {
  try {
    const result = db.prepare(`
      UPDATE notifications 
      SET is_read = 1, read_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(notificationId, userId);

    return result.changes > 0;
  } catch (error) {
    console.error('❌ Failed to mark notification as read:', error);
    return false;
  }
}

export function markAllAsRead(userId: number, projectId?: number): number {
  try {
    let query = `
      UPDATE notifications 
      SET is_read = 1, read_at = datetime('now')
      WHERE user_id = ? AND is_read = 0
    `;
    const params: any[] = [userId];

    if (projectId) {
      query += ` AND project_id = ?`;
      params.push(projectId);
    }

    const result = db.prepare(query).run(...params);
    return result.changes;
  } catch (error) {
    console.error('❌ Failed to mark all as read:', error);
    return 0;
  }
}

export function cleanupOldNotifications(daysToKeep: number = 30): number {
  try {
    const result = db.prepare(`
      DELETE FROM notifications 
      WHERE is_read = 1 
        AND read_at < datetime('now', '-${daysToKeep} days')
    `).run();

    if (result.changes > 0) {
      console.log(`🧹 Cleaned up ${result.changes} old notifications`);
    }
    return result.changes;
  } catch (error) {
    console.error('❌ Failed to cleanup notifications:', error);
    return 0;
  }
}

export function logDeviceStatusChange(data: {
  greenhouseId: number;
  previousStatus: 'online' | 'offline' | 'unknown';
  newStatus: 'online' | 'offline' | 'unknown';
  reason?: string;
  signalStrength?: number;
  wifiSsid?: string;
  ipAddress?: string;
  firmwareVersion?: string;
  offlineDuration?: number;
}): void {
  try {
    db.prepare(`
      INSERT INTO device_status_logs (
        greenhouse_id, previous_status, new_status, reason,
        signal_strength, wifi_ssid, ip_address, firmware_version,
        offline_duration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.greenhouseId,
      data.previousStatus,
      data.newStatus,
      data.reason || null,
      data.signalStrength || null,
      data.wifiSsid || null,
      data.ipAddress || null,
      data.firmwareVersion || null,
      data.offlineDuration || null
    );

    const greenhouse = db.prepare(`
      SELECT g.name_th, p.id as project_id, p.name_th as project_name
      FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE g.id = ?
    `).get(data.greenhouseId) as any;

    if (!greenhouse) return;

    if (data.newStatus === 'offline') {
      createNotification({
        type: 'device_offline',
        severity: 'critical',
        title: `${greenhouse.name_th} ออฟไลน์`,
        message: `${greenhouse.name_th} (${greenhouse.project_name}) ไม่สามารถเชื่อมต่อได้`,
        metadata: { greenhouseName: greenhouse.name_th, projectName: greenhouse.project_name, reason: data.reason },
        projectId: greenhouse.project_id,
        greenhouseId: data.greenhouseId,
        autoDismiss: false,
      });
    } else if (data.newStatus === 'online' && data.previousStatus === 'offline') {
      createNotification({
        type: 'device_online',
        severity: 'info',
        title: `${greenhouse.name_th} กลับมาออนไลน์`,
        message: `${greenhouse.name_th} เชื่อมต่อได้แล้ว${
          data.offlineDuration ? ` (ออฟไลน์ ${Math.floor(data.offlineDuration / 60)} นาที)` : ''
        }`,
        metadata: { greenhouseName: greenhouse.name_th, projectName: greenhouse.project_name, offlineDuration: data.offlineDuration },
        projectId: greenhouse.project_id,
        greenhouseId: data.greenhouseId,
        autoDismiss: true,
        dismissAfterSeconds: 10,
      });
    }

    console.log(`📊 Device status logged: ${greenhouse.name_th} ${data.previousStatus} → ${data.newStatus}`);
  } catch (error) {
    console.error('❌ Failed to log device status change:', error);
  }
}

// ============================================================
// Exports
// ============================================================

export const notificationService = {
  create: createNotification,
  markAsRead,
  markAllAsRead,
  cleanup: cleanupOldNotifications,
  getUserSettings,
  logDeviceStatusChange,

  // ✅ expose helpers for sensorMonitor (optional but used)
  canCreateSensorOfflineSummary,
  canCreateSensorAlert,
};
