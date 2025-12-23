import { db } from '../db/connection.js';

interface AuditEntry {
  userId: number | null;
  action: string;
  projectKey?: string | null;
  ghKey?: string | null;
  detail?: Record<string, unknown>;
}

/**
 * Log an action to the audit log
 */
export function logAudit(entry: AuditEntry): void {
  try {
    db.prepare(`
      INSERT INTO audit_log (user_id, action, project_key, gh_key, detail_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      entry.userId,
      entry.action,
      entry.projectKey ?? null,
      entry.ghKey ?? null,
      JSON.stringify(entry.detail ?? {})
    );
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

// Audit action types
export const AuditActions = {
  // Generic CRUD (used by some routes)
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  DELETED: 'DELETED',

  // Auth
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_RESET: 'PASSWORD_RESET',

  // User management
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DISABLED: 'USER_DISABLED',
  USER_ENABLED: 'USER_ENABLED',
  USER_DELETED: 'USER_DELETED',
  ROLE_CHANGED: 'ROLE_CHANGED',
  PROJECT_ACCESS_GRANTED: 'PROJECT_ACCESS_GRANTED',
  PROJECT_ACCESS_REVOKED: 'PROJECT_ACCESS_REVOKED',

  // Project/Greenhouse
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  PROJECT_DELETED: 'PROJECT_DELETED',
  GREENHOUSE_CREATED: 'GREENHOUSE_CREATED',
  GREENHOUSE_UPDATED: 'GREENHOUSE_UPDATED',
  GREENHOUSE_DELETED: 'GREENHOUSE_DELETED',
  DEVICE_LINKED: 'DEVICE_LINKED',
  DEVICE_UNLINKED: 'DEVICE_UNLINKED',

  // Control actions
  RPC_SENT: 'RPC_SENT',
  RPC_SUCCESS: 'RPC_SUCCESS',
  RPC_FAILED: 'RPC_FAILED',
  RPC_TIMEOUT: 'RPC_TIMEOUT',

  // Settings
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  LINE_NOTIFY_UPDATED: 'LINE_NOTIFY_UPDATED',
  LINE_NOTIFY_TEST: 'LINE_NOTIFY_TEST',

  // Reports
  REPORT_GENERATED: 'REPORT_GENERATED',

  // Sensors
  SENSOR_CREATED: 'SENSOR_CREATED',
  SENSOR_UPDATED: 'SENSOR_UPDATED',
  SENSOR_DELETED: 'SENSOR_DELETED',
  SENSOR_CALIBRATED: 'SENSOR_CALIBRATED',
  SENSORS_BULK_CREATED: 'SENSORS_BULK_CREATED',

  // Controls
  CONTROL_CREATED: 'CONTROL_CREATED',
  CONTROL_UPDATED: 'CONTROL_UPDATED',
  CONTROL_DELETED: 'CONTROL_DELETED',
  CONTROLS_BULK_CREATED: 'CONTROLS_BULK_CREATED',

  // Alerts
  ALERT_ACKNOWLEDGED: 'ALERT_ACKNOWLEDGED',
  ALERTS_ACKNOWLEDGED_ALL: 'ALERTS_ACKNOWLEDGED_ALL',

  // Data Export
  DATA_EXPORTED: 'DATA_EXPORTED',
};
