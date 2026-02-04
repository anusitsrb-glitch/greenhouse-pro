/**
 * Auto Configuration Types
 * WebApp-based configuration for Advanced Auto System
 */

// ============================================================
// Auto Mode Enums
// ============================================================

export type AutoMode = 'off' | 'daily' | 'condition' | 'interval';
export type WaterMode = 'off' | 'valve_daily' | 'interval';
export type MotorMode = 'off' | 'global' | 'condition' | 'interval';

// ============================================================
// Configuration Structures
// ============================================================

export interface DailyConfig {
  enabled: boolean;
  onTime: string;   // "HH:mm"
  offTime: string;  // "HH:mm"
}

export interface ConditionConfig {
  enabled: boolean;
  sensorKey: string;    // "air_temp", "air_humidity", "soil1_moisture", etc.
  operator: '>' | '<' | '>=' | '<=';
  threshold: number;
  action: 0 | 1;        // 0=OFF when condition met, 1=ON when condition met
}

export interface IntervalConfig {
  enabled: boolean;
  startTime: string;    // "HH:mm"
  endTime: string;      // "HH:mm"
  onMinutes: number;
  offMinutes: number;
  maxCycles: number;
}

// ============================================================
// Device Auto Configurations
// ============================================================

export interface DeviceAutoConfig {
  mode: AutoMode;
  daily: DailyConfig;
  condition: ConditionConfig;
  interval: IntervalConfig;
}

export interface WaterAutoConfig {
  mode: WaterMode;
  valve_daily: {
    valve1: DailyConfig;
    valve2: DailyConfig;
    valve3: DailyConfig;
    valve4: DailyConfig;
  };
  interval: IntervalConfig;
}

export interface MotorAutoConfig {
  mode: MotorMode;
  global: {
    enabled: boolean;
    fwTime: string;  // "HH:mm"
    reTime: string;  // "HH:mm"
  };
  condition: ConditionConfig;
  interval: IntervalConfig;
}

// ============================================================
// Root Auto Configuration
// ============================================================

export interface AutoConfig {
  fan1: DeviceAutoConfig;
  fan2: DeviceAutoConfig;
  light1: DeviceAutoConfig;
  water: WaterAutoConfig;
  motor: MotorAutoConfig;
}

// ============================================================
// Default Configurations
// ============================================================

export const DEFAULT_DAILY_CONFIG: DailyConfig = {
  enabled: false,
  onTime: '07:00',
  offTime: '18:00',
};

export const DEFAULT_CONDITION_CONFIG: ConditionConfig = {
  enabled: false,
  sensorKey: 'air_temp',
  operator: '>',
  threshold: 35,
  action: 1,
};

export const DEFAULT_INTERVAL_CONFIG: IntervalConfig = {
  enabled: false,
  startTime: '10:00',
  endTime: '19:00',
  onMinutes: 10,
  offMinutes: 60,
  maxCycles: 5,
};

export const DEFAULT_DEVICE_AUTO_CONFIG: DeviceAutoConfig = {
  mode: 'off',
  daily: DEFAULT_DAILY_CONFIG,
  condition: DEFAULT_CONDITION_CONFIG,
  interval: DEFAULT_INTERVAL_CONFIG,
};

export const DEFAULT_WATER_AUTO_CONFIG: WaterAutoConfig = {
  mode: 'off',
  valve_daily: {
    valve1: DEFAULT_DAILY_CONFIG,
    valve2: DEFAULT_DAILY_CONFIG,
    valve3: DEFAULT_DAILY_CONFIG,
    valve4: DEFAULT_DAILY_CONFIG,
  },
  interval: DEFAULT_INTERVAL_CONFIG,
};

export const DEFAULT_MOTOR_AUTO_CONFIG: MotorAutoConfig = {
  mode: 'off',
  global: {
    enabled: false,
    fwTime: '08:00',
    reTime: '17:00',
  },
  condition: DEFAULT_CONDITION_CONFIG,
  interval: DEFAULT_INTERVAL_CONFIG,
};

export const DEFAULT_AUTO_CONFIG: AutoConfig = {
  fan1: DEFAULT_DEVICE_AUTO_CONFIG,
  fan2: DEFAULT_DEVICE_AUTO_CONFIG,
  light1: DEFAULT_DEVICE_AUTO_CONFIG,
  water: DEFAULT_WATER_AUTO_CONFIG,
  motor: DEFAULT_MOTOR_AUTO_CONFIG,
};

// ============================================================
// Sensor Options for Condition-based Control
// ============================================================

export const SENSOR_OPTIONS = [
  { value: 'air_temp', label: 'อุณหภูมิอากาศ (°C)' },
  { value: 'air_humidity', label: 'ความชื้นอากาศ (%)' },
  { value: 'air_light', label: 'แสง (lux)' },
  { value: 'air_co2', label: 'CO₂ (ppm)' },
  { value: 'soil1_moisture', label: 'ความชื้นดินโซน 1 (%)' },
  { value: 'soil2_moisture', label: 'ความชื้นดินโซน 2 (%)' },
  { value: 'soil3_moisture', label: 'ความชื้นดินโซน 3 (%)' },
  { value: 'soil4_moisture', label: 'ความชื้นดินโซน 4 (%)' },
  { value: 'soil5_moisture', label: 'ความชื้นดินโซน 5 (%)' },
  { value: 'soil6_moisture', label: 'ความชื้นดินโซน 6 (%)' },
  { value: 'soil7_moisture', label: 'ความชื้นดินโซน 7 (%)' },
  { value: 'soil8_moisture', label: 'ความชื้นดินโซน 8 (%)' },
  { value: 'soil9_moisture', label: 'ความชื้นดินโซน 9 (%)' },
  { value: 'soil10_moisture', label: 'ความชื้นดินโซน 10 (%)' },
] as const;

export const OPERATOR_OPTIONS = [
  { value: '>', label: 'มากกว่า (>)' },
  { value: '<', label: 'น้อยกว่า (<)' },
  { value: '>=', label: 'มากกว่าหรือเท่ากับ (≥)' },
  { value: '<=', label: 'น้อยกว่าหรือเท่ากับ (≤)' },
] as const;

export const ACTION_OPTIONS = [
  { value: 0, label: 'ปิด (OFF)' },
  { value: 1, label: 'เปิด (ON)' },
] as const;

// ============================================================
// Helper Functions
// ============================================================

export function getDeviceName(key: keyof AutoConfig): string {
  const names: Record<keyof AutoConfig, string> = {
    fan1: 'พัดลมใหญ่',
    fan2: 'พัดลมกวนอากาศ',
    light1: 'แสงเสริม',
    water: 'ระบบน้ำ',
    motor: 'มอเตอร์พรางแสง',
  };
  return names[key];
}

export function getModeName(mode: AutoMode | WaterMode | MotorMode): string {
  const names: Record<string, string> = {
    off: 'ปิด',
    daily: 'ตั้งเวลา',
    condition: 'ตามเงื่อนไข',
    interval: 'รอบเวลา',
    valve_daily: 'ตั้งเวลาแยกโซน',
    global: 'ควบคุมพร้อมกัน',
  };
  return names[mode] || mode;
}

export function isValidTime(time: string): boolean {
  const regex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
  return regex.test(time);
}

export function validateIntervalConfig(config: IntervalConfig): string[] {
  const errors: string[] = [];
  
  if (!isValidTime(config.startTime)) {
    errors.push('เวลาเริ่มต้นไม่ถูกต้อง (ต้องเป็น HH:mm)');
  }
  
  if (!isValidTime(config.endTime)) {
    errors.push('เวลาสิ้นสุดไม่ถูกต้อง (ต้องเป็น HH:mm)');
  }
  
  if (config.onMinutes <= 0) {
    errors.push('เวลาเปิดต้องมากกว่า 0 นาที');
  }
  
  if (config.offMinutes <= 0) {
    errors.push('เวลาปิดต้องมากกว่า 0 นาที');
  }
  
  if (config.maxCycles <= 0) {
    errors.push('จำนวนรอบต้องมากกว่า 0');
  }
  
  return errors;
}

export function validateDailyConfig(config: DailyConfig): string[] {
  const errors: string[] = [];
  
  if (!isValidTime(config.onTime)) {
    errors.push('เวลาเปิดไม่ถูกต้อง (ต้องเป็น HH:mm)');
  }
  
  if (!isValidTime(config.offTime)) {
    errors.push('เวลาปิดไม่ถูกต้อง (ต้องเป็น HH:mm)');
  }
  
  return errors;
}

export function validateConditionConfig(config: ConditionConfig): string[] {
  const errors: string[] = [];
  
  if (!config.sensorKey) {
    errors.push('กรุณาเลือกเซ็นเซอร์');
  }
  
  if (config.threshold === undefined || isNaN(config.threshold)) {
    errors.push('ค่าเกณฑ์ไม่ถูกต้อง');
  }
  
  return errors;
}