/**
 * Line Notify Service
 * Handles sending notifications via Line Notify API
 */

import { query } from '../db/connection.js';

interface LineNotifyConfig {
  enabled: boolean;
  token: string;
  alertOnOffline: boolean;
  alertOnThreshold: boolean;
  thresholds: {
    temp_min: number;
    temp_max: number;
    humidity_min: number;
    humidity_max: number;
    soil_moisture_min: number;
    soil_moisture_max: number;
  };
}

interface AlertData {
  projectName: string;
  greenhouseName: string;
  alertType: 'offline' | 'threshold';
  sensorName?: string;
  currentValue?: number;
  threshold?: number;
  direction?: 'above' | 'below';
}

export async function getLineNotifyConfig(): Promise<LineNotifyConfig | null> {
  try {
    const result = await query(`SELECT value FROM app_settings WHERE key = 'line_notify'`, []);
    const setting = result.rows[0] as { value: string } | undefined;
    if (!setting) return null;
    return JSON.parse(setting.value) as LineNotifyConfig;
  } catch {
    return null;
  }
}

export async function sendLineNotification(message: string): Promise<boolean> {
  const config = await getLineNotifyConfig();

  if (!config || !config.enabled || !config.token) {
    console.log('Line Notify is disabled or not configured');
    return false;
  }

  try {
    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${config.token}`,
      },
      body: new URLSearchParams({ message }),
    });

    if (!response.ok) {
      console.error('Line Notify error:', response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Line Notify error:', error);
    return false;
  }
}

export async function sendAlert(data: AlertData): Promise<boolean> {
  const config = await getLineNotifyConfig();

  if (!config || !config.enabled) return false;
  if (data.alertType === 'offline' && !config.alertOnOffline) return false;
  if (data.alertType === 'threshold' && !config.alertOnThreshold) return false;

  let message = '\n🌿 GreenHouse Pro Alert\n';
  message += `📍 ${data.projectName} - ${data.greenhouseName}\n`;

  if (data.alertType === 'offline') {
    message += '⚠️ อุปกรณ์ออฟไลน์!\n';
    message += 'กรุณาตรวจสอบการเชื่อมต่อ';
  } else if (data.alertType === 'threshold') {
    const icon = data.direction === 'above' ? '🔺' : '🔻';
    const dirText = data.direction === 'above' ? 'สูงกว่า' : 'ต่ำกว่า';
    message += `${icon} ${data.sensorName}\n`;
    message += `ค่าปัจจุบัน: ${data.currentValue}\n`;
    message += `${dirText}เกณฑ์: ${data.threshold}`;
  }

  return sendLineNotification(message);
}

export async function checkThresholds(
  projectName: string,
  greenhouseName: string,
  sensorData: Record<string, number | null>
): Promise<void> {
  const config = await getLineNotifyConfig();
  if (!config || !config.enabled || !config.alertOnThreshold) return;

  const checks = [
    { key: 'air_temp', name: 'อุณหภูมิอากาศ', min: config.thresholds.temp_min, max: config.thresholds.temp_max, unit: '°C' },
    { key: 'air_humidity', name: 'ความชื้นอากาศ', min: config.thresholds.humidity_min, max: config.thresholds.humidity_max, unit: '%' },
  ];

  for (let i = 1; i <= 10; i++) {
    checks.push({
      key: `soil${i}_moisture`,
      name: `ความชื้นดิน จุด ${i}`,
      min: config.thresholds.soil_moisture_min,
      max: config.thresholds.soil_moisture_max,
      unit: '%',
    });
  }

  for (const check of checks) {
    const value = sensorData[check.key];
    if (value === null || value === undefined) continue;

    if (value < check.min) {
      await sendAlert({ projectName, greenhouseName, alertType: 'threshold', sensorName: check.name, currentValue: value, threshold: check.min, direction: 'below' });
    } else if (value > check.max) {
      await sendAlert({ projectName, greenhouseName, alertType: 'threshold', sensorName: check.name, currentValue: value, threshold: check.max, direction: 'above' });
    }
  }
}

export async function sendDailySummary(
  projectName: string,
  greenhouseName: string,
  summary: { avgTemp: number; avgHumidity: number; avgSoilMoisture: number; alertCount: number }
): Promise<boolean> {
  const config = await getLineNotifyConfig();
  if (!config || !config.enabled) return false;

  const message = `
🌿 GreenHouse Pro - สรุปรายวัน
📍 ${projectName} - ${greenhouseName}
📅 ${new Date().toLocaleDateString('th-TH')}

🌡️ อุณหภูมิเฉลี่ย: ${summary.avgTemp.toFixed(1)}°C
💧 ความชื้นเฉลี่ย: ${summary.avgHumidity.toFixed(1)}%
🌱 ความชื้นดินเฉลี่ย: ${summary.avgSoilMoisture.toFixed(1)}%
⚠️ การแจ้งเตือน: ${summary.alertCount} ครั้ง
`;

  return sendLineNotification(message);
}

export const lineNotifyService = {
  getConfig: getLineNotifyConfig,
  send: sendLineNotification,
  sendAlert,
  checkThresholds,
  sendDailySummary,
};