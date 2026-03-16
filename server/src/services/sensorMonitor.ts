import { query } from '../db/connection.js';
import { tbService } from './thingsboard.js';
import { notificationService } from './notificationService.js';

const SENSOR_OFFLINE_MS = 5 * 60 * 1000;
const OFFLINE_NOTIFY_EVERY_MS = 30 * 60 * 1000;
const lastGhOfflineNotifyAt = new Map<string, number>();

function canNotifyGhOffline(ghId: number): boolean {
  const last = lastGhOfflineNotifyAt.get(`gh:${ghId}`);
  if (!last) return true;
  return Date.now() - last >= OFFLINE_NOTIFY_EVERY_MS;
}

function markNotifiedGhOffline(ghId: number) {
  lastGhOfflineNotifyAt.set(`gh:${ghId}`, Date.now());
}

type Severity = 'info' | 'warning' | 'critical';
type ThresholdResult = 'low' | 'high' | null;
type OfflineReason = 'no_data' | 'stale_ts';
type OfflineGroupType = 'air' | 'soil';

interface SensorConfigRow {
  sensor_config_id: number;
  greenhouse_id: number;
  project_id: number;
  project_key: string;
  gh_key: string;
  greenhouse_name: string;
  sensor_key: string;
  sensor_name: string;
  data_key: string;
  unit: string | null;
  alert_min: number | null;
  alert_max: number | null;
}

interface OfflinePoint {
  groupId: string;
  groupType: OfflineGroupType;
  pointLabel: string;
  keys: string[];
  reason: OfflineReason;
  lastTs?: number;
  ageMs?: number;
}

interface OfflineBucket {
  projectId: number;
  ghName: string;
  items: OfflinePoint[];
}

function createNotification(payload: any) {
  const svc: any = notificationService as any;
  if (typeof svc.create === 'function') return svc.create(payload);
  console.error('❌ notificationService has no create method');
}

export async function checkAllSensorAlerts(): Promise<void> {
  try {
    const result = await query(`
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
    `);

    const sensors = result.rows as SensorConfigRow[];
    console.log(`🔍 [sensorMonitor] Checking sensors: ${sensors.length}`);

    const offlineByGh = new Map<number, OfflineBucket>();

    for (const s of sensors) {
      const { offlinePoint } = await checkOneSensor(s);

      if (offlinePoint) {
        const bucket = offlineByGh.get(s.greenhouse_id) ?? { projectId: s.project_id, ghName: s.greenhouse_name, items: [] };
        const existing = bucket.items.find(i => i.groupId === offlinePoint.groupId);

        if (existing) {
          for (const k of offlinePoint.keys) {
            if (!existing.keys.includes(k)) existing.keys.push(k);
          }
          if (existing.reason === 'no_data' && offlinePoint.reason === 'stale_ts') existing.reason = 'stale_ts';
          if (typeof offlinePoint.lastTs === 'number' && (!existing.lastTs || offlinePoint.lastTs > existing.lastTs)) existing.lastTs = offlinePoint.lastTs;
          if (typeof offlinePoint.ageMs === 'number' && (!existing.ageMs || offlinePoint.ageMs > existing.ageMs)) existing.ageMs = offlinePoint.ageMs;
        } else {
          bucket.items.push(offlinePoint);
        }

        offlineByGh.set(s.greenhouse_id, bucket);
      }
    }

    for (const [ghId, bucket] of offlineByGh.entries()) {
      if (!canNotifyGhOffline(ghId)) continue;

      bucket.items.sort((a, b) => {
        if (a.groupType !== b.groupType) return a.groupType === 'air' ? -1 : 1;
        if (a.groupType === 'soil') {
          return parseInt(a.groupId.split(':')[1] || '0') - parseInt(b.groupId.split(':')[1] || '0');
        }
        return 0;
      });

      const list = bucket.items.map(i => `- ${i.pointLabel}: ${i.keys.join(', ')}`).join('\n');

      createNotification({
        type: 'sensor_offline', severity: 'warning' as Severity,
        title: `📡 เซ็นเซอร์ออฟไลน์ (${bucket.ghName})`,
        message: `${bucket.ghName}: พบจุดออฟไลน์ ${bucket.items.length} จุด\n${list}`,
        metadata: { greenhouseId: ghId, greenhouseName: bucket.ghName, offlinePointCount: bucket.items.length, points: bucket.items, notifyEveryMs: OFFLINE_NOTIFY_EVERY_MS },
        projectId: bucket.projectId, greenhouseId: ghId, autoDismiss: false,
      });

      markNotifiedGhOffline(ghId);
      console.log(`🔔 [sensorMonitor] Offline summary sent: ${bucket.ghName} (${bucket.items.length} points)`);
    }

    const seenGhIds = new Set<number>(offlineByGh.keys());
    for (const key of [...lastGhOfflineNotifyAt.keys()]) {
      const ghId = Number(key.replace('gh:', ''));
      if (!seenGhIds.has(ghId)) lastGhOfflineNotifyAt.delete(key);
    }
  } catch (error) {
    console.error('❌ [sensorMonitor] Error checking sensors:', error);
  }
}

async function checkOneSensor(s: SensorConfigRow): Promise<{ offlinePoint: OfflinePoint | null; thresholdNotified: boolean }> {
  try {
    const telemetry = await tbService.getLatestTelemetry(s.project_key, s.gh_key, [s.data_key]);
    const arr = telemetry?.[s.data_key];

    const offlinePoint = detectOfflineGroupedPoint(s, arr);
    if (offlinePoint) return { offlinePoint, thresholdNotified: false };

    if (!arr || arr.length === 0) return { offlinePoint: null, thresholdNotified: false };

    const currentValue = Number(arr[0]?.value);
    const ts = Number(arr[0]?.ts ?? 0);
    if (Number.isNaN(currentValue)) return { offlinePoint: null, thresholdNotified: false };

    const th = checkThreshold(currentValue, s.alert_min, s.alert_max);
    if (!th) return { offlinePoint: null, thresholdNotified: false };

    const unit = s.unit ? ` ${s.unit}` : '';
    const name = s.sensor_name || s.sensor_key;
    const msg = th === 'low'
      ? `${name} ต่ำกว่ากำหนด (${fmt(currentValue)}${unit} < ${fmt(s.alert_min)}${unit})`
      : `${name} สูงกว่ากำหนด (${fmt(currentValue)}${unit} > ${fmt(s.alert_max)}${unit})`;

    createNotification({
      type: 'sensor_alert', severity: 'warning' as Severity,
      title: `⚠️ ${name} ผิดปกติ`,
      message: `${s.greenhouse_name}: ${msg}`,
      metadata: { greenhouseId: s.greenhouse_id, greenhouseName: s.greenhouse_name, sensorConfigId: s.sensor_config_id, sensorKey: s.sensor_key, sensorName: name, dataKey: s.data_key, currentValue, alertMin: s.alert_min, alertMax: s.alert_max, triggered: th, ts },
      projectId: s.project_id, greenhouseId: s.greenhouse_id, autoDismiss: false,
    });

    console.log(`🚨 [sensorMonitor] Threshold triggered: ${s.greenhouse_name} - ${s.data_key} (${th})`);
    return { offlinePoint: null, thresholdNotified: true };
  } catch (error) {
    console.error(`❌ [sensorMonitor] Error sensor ${s.data_key} (GH ${s.greenhouse_id}):`, error);
    return { offlinePoint: null, thresholdNotified: false };
  }
}

function detectOfflineGroupedPoint(s: SensorConfigRow, arr: any[] | undefined): OfflinePoint | null {
  const g = groupKey(s.data_key);
  if (!g) return null;

  if (!arr || arr.length === 0) return { groupId: g.groupId, groupType: g.groupType, pointLabel: g.pointLabel, keys: [s.data_key], reason: 'no_data' };

  const ts = Number(arr[0]?.ts ?? 0);
  if (!ts) return { groupId: g.groupId, groupType: g.groupType, pointLabel: g.pointLabel, keys: [s.data_key], reason: 'no_data' };

  const age = Date.now() - ts;
  if (age <= SENSOR_OFFLINE_MS) return null;

  return { groupId: g.groupId, groupType: g.groupType, pointLabel: g.pointLabel, keys: [s.data_key], reason: 'stale_ts', lastTs: ts, ageMs: age };
}

function groupKey(dataKey: string): { groupId: string; groupType: OfflineGroupType; pointLabel: string } | null {
  const k = (dataKey || '').trim();
  if (['air_temp', 'air_humidity', 'air_co2', 'air_light'].includes(k)) {
    return { groupId: 'air', groupType: 'air', pointLabel: 'เซ็นเซอร์อากาศ' };
  }
  const m = /^soil(\d+)_/i.exec(k);
  if (m) {
    const idx = Number(m[1]);
    if (idx >= 1 && idx <= 10) return { groupId: `soil:${idx}`, groupType: 'soil', pointLabel: `เซ็นเซอร์ดิน ${idx}` };
  }
  return null;
}

function checkThreshold(value: number, min: number | null, max: number | null): ThresholdResult {
  if (min !== null && typeof min === 'number' && value < min) return 'low';
  if (max !== null && typeof max === 'number' && value > max) return 'high';
  return null;
}

function fmt(v: any): string {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(2);
}

export function startSensorMonitoring(intervalSeconds: number = 60): void {
  console.log(`🚀 Starting sensor monitoring (every ${intervalSeconds}s)...`);
  checkAllSensorAlerts();
  setInterval(() => { checkAllSensorAlerts(); }, intervalSeconds * 1000);
}

export const sensorMonitor = {
  start: startSensorMonitoring,
  checkAll: checkAllSensorAlerts,
};