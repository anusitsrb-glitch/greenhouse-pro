import { query } from '../db/connection.js';
import { tbService } from './thingsboard.js';
import { notificationService } from './notificationService.js';

interface DeviceStatus {
  greenhouseId: number;
  projectKey: string;
  ghKey: string;
  isOnline: boolean;
  lastChecked: number;
  offlineSince?: number | null;
}

const deviceStatusCache = new Map<number, DeviceStatus>();
let monitoringInterval: NodeJS.Timeout | null = null;

async function syncGreenhouseStatusToDb(greenhouseId: number, isOnline: boolean): Promise<void> {
  try {
    await query(`
      UPDATE greenhouses SET device_status = $1, last_online_at = $2 WHERE id = $3
    `, [isOnline ? 'online' : 'offline', isOnline ? new Date().toISOString() : null, greenhouseId]);
  } catch (error) {
    console.warn(`⚠️ Failed to sync greenhouse status to DB (id=${greenhouseId})`);
  }
}

async function checkDeviceStatus(greenhouseId: number, projectKey: string, ghKey: string): Promise<void> {
  try {
    const isOnline = await tbService.isDeviceOnline(projectKey, ghKey);
    const cached = deviceStatusCache.get(greenhouseId);
    const now = Date.now();

    console.log(`[CACHE] ${ghKey}: cached=${cached?.isOnline}, current=${isOnline}`);

    if (cached && cached.isOnline !== isOnline) {
      const previousStatus = cached.isOnline ? 'online' : 'offline';
      const newStatus = isOnline ? 'online' : 'offline';

      const offlineDuration = isOnline && cached.offlineSince
        ? Math.floor((now - cached.offlineSince) / 60000) * 60
        : undefined;

      await notificationService.logDeviceStatusChange({
        greenhouseId, previousStatus, newStatus,
        reason: isOnline ? 'Device reconnected' : 'Connection lost',
        offlineDuration,
      });

      await syncGreenhouseStatusToDb(greenhouseId, isOnline);
      console.log(`📡 Device status changed: ${ghKey} ${previousStatus} → ${newStatus}`);
    } else if (!cached) {
      console.log(`🆕 First check for ${ghKey}, status: ${isOnline ? 'online' : 'offline'}`);
      await syncGreenhouseStatusToDb(greenhouseId, isOnline);
    } else {
      console.log(`✓ No change for ${ghKey} (still ${isOnline ? 'online' : 'offline'})`);
    }

    deviceStatusCache.set(greenhouseId, {
      greenhouseId, projectKey, ghKey, isOnline,
      lastChecked: now,
      offlineSince: isOnline ? null : (cached?.offlineSince ?? now),
    });
  } catch (error) {
    console.error(`❌ Error checking device ${ghKey}:`, error);
  }
}

export async function checkAllDeviceStatus(): Promise<void> {
  try {
    const result = await query(`
      SELECT g.id, g.gh_key, p.key as project_key, g.name_th
      FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE g.status IN ('ready','developing') AND g.tb_device_id IS NOT NULL
    `);

    console.log(`🔍 Checking ${result.rows.length} devices...`);
    await Promise.all(result.rows.map((gh: any) => checkDeviceStatus(gh.id, gh.project_key, gh.gh_key)));
  } catch (error) {
    console.error('❌ Error checking device status:', error);
  }
}

export function startDeviceMonitoring(intervalSeconds: number = 30): void {
  console.log(`🚀 Starting device monitoring (every ${intervalSeconds}s)...`);
  if (monitoringInterval) { clearInterval(monitoringInterval); monitoringInterval = null; }
  void checkAllDeviceStatus();
  monitoringInterval = setInterval(() => { void checkAllDeviceStatus(); }, intervalSeconds * 1000);
}

export function stopDeviceMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('🛑 Device monitoring stopped');
  }
}

export const deviceMonitor = {
  start: startDeviceMonitoring,
  stop: stopDeviceMonitoring,
  checkAll: checkAllDeviceStatus,
  getCache: () => deviceStatusCache,
};