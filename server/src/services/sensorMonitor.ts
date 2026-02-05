/**
 * Sensor Alert Monitor
 * ตรวจสอบค่าเซ็นเซอร์และสร้าง notification เมื่อผิดปกติ
 */

import { db } from '../db/connection.js';
import { tbService } from './thingsboard.js';
import { notificationService } from './notificationService.js';

interface SensorAlert {
  id: number;
  greenhouseId: number;
  sensorKey: string;
  sensorName: string;
  conditionType: 'above' | 'below' | 'equal' | 'between' | 'outside';
  thresholdValue: number | null;
  thresholdMin: number | null;
  thresholdMax: number | null;
  severity: 'info' | 'warning' | 'critical';
  cooldownMinutes: number;
  lastTriggeredAt: string | null;
}

/**
 * ตรวจสอบ sensor alerts ทั้งหมด
 */
export async function checkAllSensorAlerts(): Promise<void> {
  try {
    // ดึง alert rules ที่ active
    const alerts = db.prepare(`
      SELECT ar.*, g.name_th as greenhouse_name, g.gh_key, p.key as project_key, p.id as project_id
      FROM alert_rules ar
      JOIN greenhouses g ON ar.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE ar.is_active = 1 AND g.status = 'ready'
    `).all() as Array<SensorAlert & { 
      greenhouse_name: string; 
      gh_key: string; 
      project_key: string;
      project_id: number;
    }>;

    console.log(`🔍 Checking ${alerts.length} sensor alerts...`);

    for (const alert of alerts) {
      await checkSensorAlert(alert);
    }
  } catch (error) {
    console.error('❌ Error checking sensor alerts:', error);
  }
}

/**
 * ตรวจสอบ alert rule ตัวเดียว
 */
async function checkSensorAlert(
  alert: SensorAlert & { 
    greenhouse_name: string; 
    gh_key: string; 
    project_key: string;
    project_id: number;
  }
): Promise<void> {
  try {
    // เช็ค cooldown
    if (alert.lastTriggeredAt) {
      const lastTriggered = new Date(alert.lastTriggeredAt).getTime();
      const now = Date.now();
      const cooldown = alert.cooldownMinutes * 60 * 1000;
      
      if (now - lastTriggered < cooldown) {
        return; // ยังอยู่ใน cooldown period
      }
    }

    // ดึงค่า sensor ล่าสุด
    const telemetry = await tbService.getLatestTelemetry(
      alert.project_key,
      alert.gh_key,
      [alert.sensorKey]
    );

    const sensorData = telemetry[alert.sensorKey];
    if (!sensorData || sensorData.length === 0) {
      return; // ไม่มีข้อมูล
    }

    const currentValue = Number(sensorData[0].value);
    
    // เช็คว่าเกินเงื่อนไขหรือไม่
    const isTriggered = checkCondition(
      currentValue,
      alert.conditionType,
      alert.thresholdValue,
      alert.thresholdMin,
      alert.thresholdMax
    );

    if (isTriggered) {
      // สร้าง notification
      const message = buildAlertMessage(
        alert.sensorName || alert.sensorKey,
        currentValue,
        alert.conditionType,
        alert.thresholdValue,
        alert.thresholdMin,
        alert.thresholdMax
      );

      notificationService.create({
        type: 'sensor_alert',
        severity: alert.severity,
        title: `⚠️ ${alert.sensorName || alert.sensorKey} ผิดปกติ`,
        message: `${alert.greenhouse_name}: ${message}`,
        metadata: {
          greenhouseName: alert.greenhouse_name,
          sensorKey: alert.sensorKey,
          sensorName: alert.sensorName,
          currentValue,
          threshold: alert.thresholdValue,
          thresholdMin: alert.thresholdMin,
          thresholdMax: alert.thresholdMax,
          conditionType: alert.conditionType,
        },
        projectId: alert.project_id,
        greenhouseId: alert.greenhouseId,
        autoDismiss: alert.severity === 'info',
      });

      // อัพเดท last_triggered_at
      db.prepare(`
        UPDATE alert_rules 
        SET last_triggered_at = datetime('now')
        WHERE id = ?
      `).run(alert.id);

      console.log(`🚨 Sensor alert triggered: ${alert.greenhouse_name} - ${alert.sensorKey}`);
    }
  } catch (error) {
    console.error(`❌ Error checking alert ${alert.id}:`, error);
  }
}

/**
 * ตรวจสอบเงื่อนไข
 */
function checkCondition(
  value: number,
  type: string,
  threshold: number | null,
  min: number | null,
  max: number | null
): boolean {
  switch (type) {
    case 'above':
      return threshold !== null && value > threshold;
    case 'below':
      return threshold !== null && value < threshold;
    case 'equal':
      return threshold !== null && value === threshold;
    case 'between':
      return min !== null && max !== null && value >= min && value <= max;
    case 'outside':
      return min !== null && max !== null && (value < min || value > max);
    default:
      return false;
  }
}

/**
 * สร้างข้อความแจ้งเตือน
 */
function buildAlertMessage(
  sensorName: string,
  currentValue: number,
  type: string,
  threshold: number | null,
  min: number | null,
  max: number | null
): string {
  const valueStr = currentValue.toFixed(2);
  
  switch (type) {
    case 'above':
      return `${sensorName} สูงกว่ากำหนด (${valueStr} > ${threshold})`;
    case 'below':
      return `${sensorName} ต่ำกว่ากำหนด (${valueStr} < ${threshold})`;
    case 'equal':
      return `${sensorName} เท่ากับ ${threshold}`;
    case 'between':
      return `${sensorName} อยู่ในช่วง ${min}-${max} (${valueStr})`;
    case 'outside':
      return `${sensorName} นอกช่วงปกติ (${valueStr}, ควรอยู่ ${min}-${max})`;
    default:
      return `${sensorName} = ${valueStr}`;
  }
}

/**
 * เริ่มต้น monitoring (เรียกทุก 1 นาที)
 */
export function startSensorMonitoring(intervalSeconds: number = 60): void {
  console.log(`🚀 Starting sensor alert monitoring (every ${intervalSeconds}s)...`);
  
  // Check ทันที
  checkAllSensorAlerts();
  
  // ตั้ง interval
  setInterval(() => {
    checkAllSensorAlerts();
  }, intervalSeconds * 1000);
}

// Export สำหรับ testing
export const sensorMonitor = {
  start: startSensorMonitoring,
  checkAll: checkAllSensorAlerts,
};