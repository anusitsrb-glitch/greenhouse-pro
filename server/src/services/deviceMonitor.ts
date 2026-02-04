/**
 * Device Status Monitor
 * ตรวจสอบสถานะอุปกรณ์และสร้าง notification
 */

import { db } from '../db/connection.js';
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

/**
 * Sync สถานะลง DB เพื่อให้หน้า "รวมโรงเรือน" แสดงถูก
 * - พยายามอัปเดต device_status/last_online_at ก่อน
 * - ถ้า schema ไม่มีคอลัมน์ -> fallback ไปอัปเดต status
 */
function syncGreenhouseStatusToDb(greenhouseId: number, isOnline: boolean): void {
  try {
    db.prepare(`
      UPDATE greenhouses
      SET device_status = ?, last_online_at = ?
      WHERE id = ?
    `).run(
      isOnline ? 'online' : 'offline',
      isOnline ? new Date().toISOString() : null,
      greenhouseId
    );
    return;
  } catch {}

  try {
    db.prepare(`
      UPDATE greenhouses
      SET status = ?
      WHERE id = ?
    `).run(
      isOnline ? 'ready' : 'offline',
      greenhouseId
    );
  } catch {
    console.warn(`⚠️ Failed to sync greenhouse status to DB (id=${greenhouseId})`);
  }
}

/**
 * ตรวจสอบสถานะอุปกรณ์ตัวเดียว
 */
async function checkDeviceStatus(
  greenhouseId: number,
  projectKey: string,
  ghKey: string
): Promise<void> {
  try {
    const isOnline = await tbService.isDeviceOnline(projectKey, ghKey);
    const cached = deviceStatusCache.get(greenhouseId);

    console.log(`[CACHE] ${ghKey}: cached=${cached?.isOnline}, current=${isOnline}`);

    const now = Date.now();

    // ✅ ถ้าสถานะเปลี่ยน
    if (cached && cached.isOnline !== isOnline) {
      const previousStatus = cached.isOnline ? 'online' : 'offline';
      const newStatus = isOnline ? 'online' : 'offline';

      console.log(`🔄 Status change detected: ${previousStatus} → ${newStatus}`);

      const offlineDuration =
        isOnline && cached.offlineSince
          ? Math.floor((now - cached.offlineSince) / 60000) * 60 // เป็นวินาที
          : undefined;

      notificationService.logDeviceStatusChange({
        greenhouseId,
        previousStatus,
        newStatus,
        reason: isOnline ? 'Device reconnected' : 'Connection lost',
        offlineDuration,
      });

      // ✅ sync DB เมื่อมีการเปลี่ยนสถานะ
      syncGreenhouseStatusToDb(greenhouseId, isOnline);

      console.log(`📡 Device status changed: ${ghKey} ${previousStatus} → ${newStatus}`);

      if (offlineDuration) {
        console.log(`⏱️ Was offline for ${offlineDuration} seconds`);
      }
    }
    // ✅ first check (ยังไม่มี cache) -> sync DB ด้วย เพื่อไม่ให้หน้า list ค้างค่าเก่า
    else if (!cached) {
      console.log(`🆕 First check for ${ghKey}, status: ${isOnline ? 'online' : 'offline'}`);
      syncGreenhouseStatusToDb(greenhouseId, isOnline);
    }
    // ✅ ไม่เปลี่ยน
    else {
      console.log(`✓ No change for ${ghKey} (still ${isOnline ? 'online' : 'offline'})`);
    }

    // ✅ update cache (ครั้งเดียวพอ)
    deviceStatusCache.set(greenhouseId, {
      greenhouseId,
      projectKey,
      ghKey,
      isOnline,
      lastChecked: now,
      offlineSince: isOnline ? null : (cached?.offlineSince ?? now),
    });
  } catch (error) {
    console.error(`❌ Error checking device ${ghKey}:`, error);
  }
}

/**
 * ตรวจสอบสถานะอุปกรณ์ทั้งหมด
 */
export async function checkAllDeviceStatus(): Promise<void> {
  try {
    const greenhouses = db.prepare(`
      SELECT g.id, g.gh_key, p.key as project_key, g.name_th
      FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE g.status IN ('ready','developing') AND g.tb_device_id IS NOT NULL
    `).all() as Array<{
      id: number;
      gh_key: string;
      project_key: string;
      name_th: string;
    }>;

    console.log(`🔍 Checking ${greenhouses.length} devices...`);

    // ✅ รันพร้อมกัน (เร็วขึ้น)
    await Promise.all(
      greenhouses.map((gh) => checkDeviceStatus(gh.id, gh.project_key, gh.gh_key))
    );
  } catch (error) {
    console.error('❌ Error checking device status:', error);
  }
}

/**
 * เริ่มต้น monitoring (เรียกทุก N วินาที)
 */
export function startDeviceMonitoring(intervalSeconds: number = 30): void {
  console.log(`🚀 Starting device monitoring (every ${intervalSeconds}s)...`);

  // ✅ กัน start ซ้อน
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }

  void checkAllDeviceStatus();

  monitoringInterval = setInterval(() => {
    void checkAllDeviceStatus();
  }, intervalSeconds * 1000);
}

/**
 * หยุด monitoring (ใช้สำหรับ testing หรือ shutdown)
 */
export function stopDeviceMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('🛑 Device monitoring stopped');
  }
}

// Export สำหรับ testing
export const deviceMonitor = {
  start: startDeviceMonitoring,
  stop: stopDeviceMonitoring,
  checkAll: checkAllDeviceStatus,
  getCache: () => deviceStatusCache,
};
