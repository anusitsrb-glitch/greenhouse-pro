import { query } from '../db/connection.js';

export type NotificationType =
  | 'device_offline' | 'device_online' | 'sensor_alert' | 'sensor_offline'
  | 'control_action' | 'auto_mode_changed' | 'system_error' | 'info';

export type NotificationSeverity = 'info' | 'warning' | 'critical';

export interface CreateNotificationData {
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  projectId?: number;
  greenhouseId?: number;
  userId?: number;
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
// Dedup helpers
// ============================================================

async function hasRecentNotification(params: {
  userId: number;
  type: NotificationType;
  greenhouseId?: number;
  sensorKey?: string;
  triggered?: 'low' | 'high';
  windowMinutes: number;
}): Promise<boolean> {
  let sql = `
    SELECT id FROM notifications
    WHERE user_id = $1 AND type = $2
  `;
  const args: any[] = [params.userId, params.type];
  let idx = 3;

  if (params.greenhouseId) { sql += ` AND greenhouse_id = $${idx++}`; args.push(params.greenhouseId); }
  if (params.sensorKey) { sql += ` AND metadata::json->>'sensorKey' = $${idx++}`; args.push(params.sensorKey); }
  if (params.triggered) { sql += ` AND metadata::json->>'triggered' = $${idx++}`; args.push(params.triggered); }
  sql += ` AND created_at::timestamp >= NOW() - INTERVAL '${params.windowMinutes} minutes' LIMIT 1`;

  const result = await query(sql, args);
  return result.rows.length > 0;
}

export async function canCreateSensorOfflineSummary(params: {
  projectId: number;
  greenhouseId: number;
  windowMinutes: number;
}): Promise<boolean> {
  try {
    const users = await getTargetUsers(params.projectId);
    for (const userId of users) {
      if (await hasRecentNotification({ userId, type: 'sensor_offline', greenhouseId: params.greenhouseId, windowMinutes: params.windowMinutes })) {
        return false;
      }
    }
    return true;
  } catch { return true; }
}

export async function canCreateSensorAlert(params: {
  projectId: number;
  greenhouseId: number;
  sensorKey: string;
  triggered: 'low' | 'high';
  windowMinutes: number;
}): Promise<boolean> {
  try {
    const users = await getTargetUsers(params.projectId);
    for (const userId of users) {
      if (await hasRecentNotification({ userId, type: 'sensor_alert', greenhouseId: params.greenhouseId, sensorKey: params.sensorKey, triggered: params.triggered, windowMinutes: params.windowMinutes })) {
        return false;
      }
    }
    return true;
  } catch { return true; }
}

// ============================================================
// Main create function
// ============================================================

async function createNotification(data: CreateNotificationData): Promise<void> {
  try {
    const metadata = JSON.stringify(data.metadata || {});

    if (data.userId) {
      const settings = await getUserSettings(data.userId);
      if (!shouldSendNotification(settings, data)) return;
      if (shouldDedup(data) && !await canInsertForUser(data.userId, data)) return;
      await insertNotification({ userId: data.userId, ...data, metadata });
      return;
    }

    const targetUsers = await getTargetUsers(data.projectId);
    let sentCount = 0;

    for (const userId of targetUsers) {
      const settings = await getUserSettings(userId);
      if (!shouldSendNotification(settings, data)) continue;
      if (shouldDedup(data) && !await canInsertForUser(userId, data)) continue;
      await insertNotification({ userId, ...data, metadata });
      sentCount++;
    }

    console.log(`🔔 Notification sent to ${sentCount} users: ${data.type}`);
  } catch (error) {
    console.error('❌ Failed to create notification:', error);
  }
}

function shouldDedup(data: CreateNotificationData): boolean {
  return data.type === 'sensor_offline' || data.type === 'sensor_alert';
}

async function canInsertForUser(userId: number, data: CreateNotificationData): Promise<boolean> {
  if (data.type === 'sensor_offline') {
    return !await hasRecentNotification({ userId, type: 'sensor_offline', greenhouseId: data.greenhouseId, windowMinutes: 30 });
  }
  if (data.type === 'sensor_alert') {
    const sensorKey = (data.metadata as any)?.sensorKey;
    const triggered = (data.metadata as any)?.triggered;
    if (typeof sensorKey !== 'string' || (triggered !== 'low' && triggered !== 'high')) return true;
    return !await hasRecentNotification({ userId, type: 'sensor_alert', greenhouseId: data.greenhouseId, sensorKey, triggered, windowMinutes: 10 });
  }
  return true;
}

// ============================================================
// Target users + settings
// ============================================================

async function getTargetUsers(projectId?: number): Promise<number[]> {
  try {
    if (!projectId) {
      const result = await query(`SELECT id FROM users WHERE is_active = 1 AND role IN ('admin', 'superadmin', 'operator')`);
      return result.rows.map((u: any) => u.id);
    }
    const result = await query(`
      SELECT DISTINCT u.id FROM users u
      LEFT JOIN user_project_access upa ON u.id = upa.user_id
      WHERE u.is_active = 1 AND (u.role IN ('admin', 'superadmin') OR upa.project_id = $1)
    `, [projectId]);
    return result.rows.map((u: any) => u.id);
  } catch { return []; }
}

export async function getUserSettings(userId: number): Promise<NotificationSettings | null> {
  try {
    const result = await query(`SELECT * FROM notification_settings WHERE user_id = $1`, [userId]);
    if (result.rows.length === 0) {
      await createDefaultSettings(userId);
      return getUserSettings(userId);
    }
    const s = result.rows[0];
    return {
      enabled: Boolean(s.enabled),
      device_offline: Boolean(s.device_offline),
      device_online: Boolean(s.device_online),
      sensor_alert: Boolean(s.sensor_alert),
      sensor_offline: Boolean(s.sensor_offline),
      control_action: Boolean(s.control_action),
      auto_mode_changed: Boolean(s.auto_mode_changed),
      system_error: Boolean(s.system_error),
      show_info: Boolean(s.show_info),
      show_warning: Boolean(s.show_warning),
      show_critical: Boolean(s.show_critical),
      project_filter: JSON.parse(s.project_filter || '[]'),
      greenhouse_filter: JSON.parse(s.greenhouse_filter || '[]'),
      quiet_hours_enabled: Boolean(s.quiet_hours_enabled),
      quiet_hours_start: s.quiet_hours_start || '22:00',
      quiet_hours_end: s.quiet_hours_end || '07:00',
    };
  } catch { return null; }
}

async function createDefaultSettings(userId: number): Promise<void> {
  try {
    await query(`INSERT INTO notification_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
  } catch {}
}

function shouldSendNotification(settings: NotificationSettings | null, data: CreateNotificationData): boolean {
  if (!settings || !settings.enabled) return false;
  if (!settings[data.type as keyof NotificationSettings]) return false;
  if (data.severity === 'info' && !settings.show_info) return false;
  if (data.severity === 'warning' && !settings.show_warning) return false;
  if (data.severity === 'critical' && !settings.show_critical) return false;
  if (settings.project_filter.length > 0 && data.projectId) {
    if (!settings.project_filter.includes(data.projectId.toString())) return false;
  }
  if (settings.greenhouse_filter.length > 0 && data.greenhouseId) {
    if (!settings.greenhouse_filter.includes(data.greenhouseId.toString())) return false;
  }
  if (settings.quiet_hours_enabled) {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const { quiet_hours_start: start, quiet_hours_end: end } = settings;
    if (start < end) { if (currentTime >= start && currentTime <= end) return false; }
    else { if (currentTime >= start || currentTime <= end) return false; }
  }
  return true;
}

// ============================================================
// DB operations
// ============================================================

async function insertNotification(data: {
  userId: number;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  metadata: string;
  projectId?: number;
  greenhouseId?: number;
  autoDismiss?: boolean;
  dismissAfterSeconds?: number;
}): Promise<void> {
  await query(`
    INSERT INTO notifications (user_id, type, severity, title, message, metadata, project_id, greenhouse_id, auto_dismiss, dismiss_after_seconds)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  `, [
    data.userId, data.type, data.severity, data.title, data.message, data.metadata,
    data.projectId || null, data.greenhouseId || null,
    data.autoDismiss !== false ? 1 : 0,
    data.dismissAfterSeconds || 300,
  ]);
}

export async function markAsRead(notificationId: number, userId: number): Promise<boolean> {
  try {
    const result = await query(`UPDATE notifications SET is_read = 1, read_at = now()::text WHERE id = $1 AND user_id = $2`, [notificationId, userId]);
    return (result.rowCount ?? 0) > 0;
  } catch { return false; }
}

export async function markAllAsRead(userId: number, projectId?: number): Promise<number> {
  try {
    let sql = `UPDATE notifications SET is_read = 1, read_at = now()::text WHERE user_id = $1 AND is_read = 0`;
    const params: any[] = [userId];
    if (projectId) { sql += ` AND project_id = $2`; params.push(projectId); }
    const result = await query(sql, params);
    return result.rowCount ?? 0;
  } catch { return 0; }
}

export async function cleanupOldNotifications(daysToKeep: number = 30): Promise<number> {
  try {
    const result = await query(`
      DELETE FROM notifications WHERE is_read = 1
      AND read_at::timestamp < NOW() - INTERVAL '${daysToKeep} days'
    `);
    if ((result.rowCount ?? 0) > 0) console.log(`🧹 Cleaned up ${result.rowCount} old notifications`);
    return result.rowCount ?? 0;
  } catch { return 0; }
}

export async function logDeviceStatusChange(data: {
  greenhouseId: number;
  previousStatus: 'online' | 'offline' | 'unknown';
  newStatus: 'online' | 'offline' | 'unknown';
  reason?: string;
  signalStrength?: number;
  wifiSsid?: string;
  ipAddress?: string;
  firmwareVersion?: string;
  offlineDuration?: number;
}): Promise<void> {
  try {
    await query(`
      INSERT INTO device_status_logs (greenhouse_id, previous_status, new_status, reason, signal_strength, wifi_ssid, ip_address, firmware_version, offline_duration)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [data.greenhouseId, data.previousStatus, data.newStatus, data.reason || null, data.signalStrength || null, data.wifiSsid || null, data.ipAddress || null, data.firmwareVersion || null, data.offlineDuration || null]);

    const ghResult = await query(`
      SELECT g.name_th, p.id as project_id, p.name_th as project_name
      FROM greenhouses g JOIN projects p ON g.project_id = p.id WHERE g.id = $1
    `, [data.greenhouseId]);
    const greenhouse = ghResult.rows[0];
    if (!greenhouse) return;

    if (data.newStatus === 'offline') {
      await createNotification({
        type: 'device_offline', severity: 'critical',
        title: `${greenhouse.name_th} ออฟไลน์`,
        message: `${greenhouse.name_th} (${greenhouse.project_name}) ไม่สามารถเชื่อมต่อได้`,
        metadata: { greenhouseName: greenhouse.name_th, projectName: greenhouse.project_name, reason: data.reason },
        projectId: greenhouse.project_id, greenhouseId: data.greenhouseId, autoDismiss: false,
      });
    } else if (data.newStatus === 'online' && data.previousStatus === 'offline') {
      await createNotification({
        type: 'device_online', severity: 'info',
        title: `${greenhouse.name_th} กลับมาออนไลน์`,
        message: `${greenhouse.name_th} เชื่อมต่อได้แล้ว${data.offlineDuration ? ` (ออฟไลน์ ${Math.floor(data.offlineDuration / 60)} นาที)` : ''}`,
        metadata: { greenhouseName: greenhouse.name_th, offlineDuration: data.offlineDuration },
        projectId: greenhouse.project_id, greenhouseId: data.greenhouseId, autoDismiss: true, dismissAfterSeconds: 10,
      });
    }
  } catch (error) {
    console.error('❌ Failed to log device status change:', error);
  }
}

export const notificationService = {
  create: createNotification,
  markAsRead,
  markAllAsRead,
  cleanup: cleanupOldNotifications,
  getUserSettings,
  logDeviceStatusChange,
  canCreateSensorOfflineSummary,
  canCreateSensorAlert,
};