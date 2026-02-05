/**
 * Sensor Monitor (Production)
 * - Sensor Threshold Alerts: uses sensor_configs.alert_min/alert_max (matches UI)
 * - Sensor Offline Alerts: checks telemetry last timestamp per sensor
 */

import { db } from '../db/connection.js';
import { tbService } from './thingsboard.js';
import { notificationService } from './notificationService.js';

// ============================================================
// Config
// ============================================================

// Offline considered if last telemetry older than this (default 5 minutes)
const SENSOR_OFFLINE_MS = 5 * 60 * 1000;

// In-memory cooldown to prevent spam even if DB cooldown not present
const MEM_COOLDOWN_MS = 5 * 60 * 1000;

// Telemetry request keys are from sensor_configs.data_key
// ============================================================

// Track last triggered times in memory
const memCooldown = new Map<string, number>();

function memCooldownOk(key: string): boolean {
  const last = memCooldown.get(key);
  if (!last) return true;
  return Date.now() - last >= MEM_COOLDOWN_MS;
}

function setMemCooldown(key: string) {
  memCooldown.set(key, Date.now());
}

// Create notification wrapper (support different method names)
function createNotification(payload: any) {
  const svc: any = notificationService as any;

  if (typeof svc.create === 'function') return svc.create(payload);
  if (typeof svc.createNotification === 'function') return svc.createNotification(payload);
  if (typeof svc.createNotificationData === 'function') return svc.createNotificationData(payload);

  // Fallback: try common names
  if (typeof svc.createNotification === 'function') return svc.createNotification(payload);

  console.error('❌ notificationService has no create/createNotification method');
}

// ============================================================
// Types
// ============================================================

type Severity = 'info' | 'warning' | 'critical';

interface SensorConfigRow {
  sensor_config_id: number;
  greenhouse_id: number;
  project_id: number;

  project_key: string;
  gh_key: string;

  greenhouse_name: string;

  sensor_key: string;      // logical id
  sensor_name: string;     // display name
  data_key: string;        // TB telemetry key
  unit: string | null;

  alert_min: number | null;
  alert_max: number | null;

  // optional if you have columns; safe to read as any
  last_alert_at?: string | null;
  alert_cooldown_min?: number | null;
}

type ThresholdResult = 'low' | 'high' | null;

// ============================================================
// Main entry
// ============================================================

export async function checkAllSensorAlerts(): Promise<void> {
  try {
    const sensors = db.prepare(`
      SELECT
        sc.id as sensor_config_id,
        sc.greenhouse_id,
        p.id as project_id,
        p.key as project_key,
        g.gh_key,
        g.name_th as greenhouse_name,

        sc.sensor_key,
        sc.name_th as sensor_name,
        sc.data_key,
        sc.unit,

        sc.alert_min,
        sc.alert_max

      FROM sensor_configs sc
      JOIN greenhouses g ON sc.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id

      WHERE sc.is_active = 1
        AND g.status = 'ready'
        AND sc.data_key IS NOT NULL
        AND TRIM(sc.data_key) != ''
        AND (
          sc.alert_min IS NOT NULL
          OR sc.alert_max IS NOT NULL
          OR 1 = 1
        )
    `).all() as SensorConfigRow[];

    // NOTE: we also do offline checks even if alert_min/max is null
    console.log(`🔍 [sensorMonitor] Checking sensors: ${sensors.length}`);

    for (const s of sensors) {
      await checkOneSensor(s);
    }
  } catch (error) {
    console.error('❌ [sensorMonitor] Error checking sensors:', error);
  }
}

// ============================================================
// Per sensor check (offline + threshold)
// ============================================================

async function checkOneSensor(s: SensorConfigRow): Promise<void> {
  try {
    // Fetch latest telemetry for this sensor key
    const telemetry = await tbService.getLatestTelemetry(
      s.project_key,
      s.gh_key,
      [s.data_key]
    );

    const arr = telemetry?.[s.data_key];

    // ----------------------------
    // 1) Offline check
    // ----------------------------
    await checkOffline(s, arr);

    // If no telemetry, cannot threshold-check
    if (!arr || arr.length === 0) return;

    const currentValue = Number(arr[0]?.value);
    const ts = Number(arr[0]?.ts ?? 0);

    if (Number.isNaN(currentValue)) return;

    // ----------------------------
    // 2) Threshold check
    // ----------------------------
    const th = checkThreshold(currentValue, s.alert_min, s.alert_max);
    if (!th) return;

    const memKey = `sensor_alert:${s.greenhouse_id}:${s.sensor_key}:${th}`;
    if (!memCooldownOk(memKey)) return;

    const unit = s.unit ? ` ${s.unit}` : '';
    const name = s.sensor_name || s.sensor_key;

    const msg =
      th === 'low'
        ? `${name} ต่ำกว่ากำหนด (${fmt(currentValue)}${unit} < ${fmt(s.alert_min)}${unit})`
        : `${name} สูงกว่ากำหนด (${fmt(currentValue)}${unit} > ${fmt(s.alert_max)}${unit})`;

    createNotification({
      type: 'sensor_alert',
      severity: 'warning' as Severity,
      title: `⚠️ ${name} ผิดปกติ`,
      message: `${s.greenhouse_name}: ${msg}`,
      metadata: {
        greenhouseId: s.greenhouse_id,
        greenhouseName: s.greenhouse_name,
        sensorConfigId: s.sensor_config_id,
        sensorKey: s.sensor_key,
        sensorName: name,
        dataKey: s.data_key,
        currentValue,
        alertMin: s.alert_min,
        alertMax: s.alert_max,
        triggered: th,
        ts,
      },
      projectId: s.project_id,
      greenhouseId: s.greenhouse_id,
      autoDismiss: false,
    });

    setMemCooldown(memKey);
    console.log(`🚨 [sensorMonitor] Threshold triggered: ${s.greenhouse_name} - ${s.sensor_key} (${th})`);
  } catch (error) {
    console.error(`❌ [sensorMonitor] Error sensor ${s.sensor_key} (GH ${s.greenhouse_id}):`, error);
  }
}

// ============================================================
// Offline detector
// ============================================================

async function checkOffline(s: SensorConfigRow, arr: any[] | undefined): Promise<void> {
  const name = s.sensor_name || s.sensor_key;

  // No data at all => offline (nodata)
  if (!arr || arr.length === 0) {
    const memKey = `sensor_offline:${s.greenhouse_id}:${s.sensor_key}:nodata`;
    if (!memCooldownOk(memKey)) return;

    createNotification({
      type: 'sensor_offline',
      severity: 'warning' as Severity,
      title: `📡 เซ็นเซอร์ออฟไลน์`,
      message: `${s.greenhouse_name}: ${name} ไม่มีข้อมูลล่าสุด`,
      metadata: {
        greenhouseId: s.greenhouse_id,
        greenhouseName: s.greenhouse_name,
        sensorConfigId: s.sensor_config_id,
        sensorKey: s.sensor_key,
        sensorName: name,
        dataKey: s.data_key,
        reason: 'no_data',
      },
      projectId: s.project_id,
      greenhouseId: s.greenhouse_id,
      autoDismiss: false,
    });

    setMemCooldown(memKey);
    console.log(`📴 [sensorMonitor] Offline (no data): ${s.greenhouse_name} - ${s.sensor_key}`);
    return;
  }

  const ts = Number(arr[0]?.ts ?? 0);
  if (!ts) return;

  const age = Date.now() - ts;
  if (age <= SENSOR_OFFLINE_MS) return;

  const memKey = `sensor_offline:${s.greenhouse_id}:${s.sensor_key}:stale`;
  if (!memCooldownOk(memKey)) return;

  const mins = Math.round(SENSOR_OFFLINE_MS / 60000);

  createNotification({
    type: 'sensor_offline',
    severity: 'warning' as Severity,
    title: `📡 เซ็นเซอร์ออฟไลน์`,
    message: `${s.greenhouse_name}: ${name} ไม่อัปเดตเกิน ${mins} นาที`,
    metadata: {
      greenhouseId: s.greenhouse_id,
      greenhouseName: s.greenhouse_name,
      sensorConfigId: s.sensor_config_id,
      sensorKey: s.sensor_key,
      sensorName: name,
      dataKey: s.data_key,
      lastTs: ts,
      ageMs: age,
      offlineMs: SENSOR_OFFLINE_MS,
      reason: 'stale_ts',
    },
    projectId: s.project_id,
    greenhouseId: s.greenhouse_id,
    autoDismiss: false,
  });

  setMemCooldown(memKey);
  console.log(`📴 [sensorMonitor] Offline (stale): ${s.greenhouse_name} - ${s.sensor_key} (${Math.round(age / 60000)}m)`);
}

// ============================================================
// Helpers
// ============================================================

function checkThreshold(value: number, min: number | null, max: number | null): ThresholdResult {
  if (min !== null && typeof min === 'number' && value < min) return 'low';
  if (max !== null && typeof max === 'number' && value > max) return 'high';
  return null;
}

function fmt(v: any): string {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  // keep nice format
  if (Math.abs(n) >= 100) return n.toFixed(1);
  if (Math.abs(n) >= 10) return n.toFixed(2);
  return n.toFixed(2);
}

// ============================================================
// Scheduler
// ============================================================

export function startSensorMonitoring(intervalSeconds: number = 60): void {
  console.log(`🚀 Starting sensor monitoring (every ${intervalSeconds}s)...`);
  checkAllSensorAlerts();

  setInterval(() => {
    checkAllSensorAlerts();
  }, intervalSeconds * 1000);
}

// Export for testing
export const sensorMonitor = {
  start: startSensorMonitoring,
  checkAll: checkAllSensorAlerts,
};
