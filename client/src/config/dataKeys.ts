/**
 * ThingsBoard Data Keys Configuration (Frontend)
 * Mirrors backend config - import from here for consistency
 */

// ============================================================
// Telemetry Keys
// ============================================================

export const TELEMETRY_KEYS = {
  AIR: {
    TEMP: 'air_temp',
    HUMIDITY: 'air_humidity',
    CO2: 'air_co2',
    LIGHT: 'air_light',
  },
  SYSTEM: {
    WIFI_SSID: 'wifi_ssid',
    RSSI: 'rssi',
    FIRMWARE_VERSION: 'firmware_version',
    STATS_READ_TIME_MS: 'stats_read_time_ms',
  },
} as const;

export function getSoilKeys(nodeIndex: number) {
  const i = nodeIndex;
  return {
    MOISTURE: `soil${i}_moisture`,
    TEMP: `soil${i}_temp`,
    EC: `soil${i}_ec`,
    PH: `soil${i}_ph`,
    N: `soil${i}_n`,
    P: `soil${i}_p`,
    K: `soil${i}_k`,
  };
}

export const AIR_TELEMETRY_KEYS = Object.values(TELEMETRY_KEYS.AIR);
export const SYSTEM_TELEMETRY_KEYS = Object.values(TELEMETRY_KEYS.SYSTEM);

export function getSoilKeysArray(nodeIndex: number): string[] {
  return Object.values(getSoilKeys(nodeIndex));
}

// ============================================================
// Attribute Keys
// ============================================================

export const ATTRIBUTE_KEYS = {
  STATUS: 'status',
  
  RELAY: {
    FAN_1_CMD: 'fan_1_cmd',
    FAN_2_CMD: 'fan_2_cmd',
    VALVE_1_CMD: 'valve_1_cmd',
    VALVE_2_CMD: 'valve_2_cmd',
    VALVE_3_CMD: 'valve_3_cmd',
    VALVE_4_CMD: 'valve_4_cmd',
    LIGHT_1_CMD: 'light_1_cmd',
  },
  
  MOTOR: {
    MOTOR_1_FW: 'motor_1_fw',
    MOTOR_1_RE: 'motor_1_re',
    MOTOR_2_FW: 'motor_2_fw',
    MOTOR_2_RE: 'motor_2_re',
    MOTOR_3_FW: 'motor_3_fw',
    MOTOR_3_RE: 'motor_3_re',
    MOTOR_4_FW: 'motor_4_fw',
    MOTOR_4_RE: 'motor_4_re',
  },
  
  AUTO: {
    FAN_1_AUTO: 'fan_1_auto',
    FAN_2_AUTO: 'fan_2_auto',
    VALVE_1_AUTO: 'valve_1_auto',
    VALVE_2_AUTO: 'valve_2_auto',
    VALVE_3_AUTO: 'valve_3_auto',
    VALVE_4_AUTO: 'valve_4_auto',
    LIGHT_1_AUTO: 'light_1_auto',
    GLOBAL_MOTOR_AUTO: 'global_motor_auto',
  },
  
  TIMER: {
    FAN_1_ON: 'fan_1_on',
    FAN_1_OFF: 'fan_1_off',
    FAN_2_ON: 'fan_2_on',
    FAN_2_OFF: 'fan_2_off',
    VALVE_1_ON: 'valve_1_on',
    VALVE_1_OFF: 'valve_1_off',
    VALVE_2_ON: 'valve_2_on',
    VALVE_2_OFF: 'valve_2_off',
    VALVE_3_ON: 'valve_3_on',
    VALVE_3_OFF: 'valve_3_off',
    VALVE_4_ON: 'valve_4_on',
    VALVE_4_OFF: 'valve_4_off',
    LIGHT_1_ON: 'light_1_on',
    LIGHT_1_OFF: 'light_1_off',
    GLOBAL_FW_TIME: 'global_fw_time',
    GLOBAL_RE_TIME: 'global_re_time',
  },
} as const;

export const RELAY_ATTRIBUTE_KEYS = Object.values(ATTRIBUTE_KEYS.RELAY);
export const MOTOR_ATTRIBUTE_KEYS = Object.values(ATTRIBUTE_KEYS.MOTOR);
export const AUTO_ATTRIBUTE_KEYS = Object.values(ATTRIBUTE_KEYS.AUTO);
export const TIMER_ATTRIBUTE_KEYS = Object.values(ATTRIBUTE_KEYS.TIMER);

export const ALL_CONTROL_ATTRIBUTES = [
  ATTRIBUTE_KEYS.STATUS,
  ...RELAY_ATTRIBUTE_KEYS,
  ...MOTOR_ATTRIBUTE_KEYS,
  ...AUTO_ATTRIBUTE_KEYS,
  ...TIMER_ATTRIBUTE_KEYS,
];

// ============================================================
// RPC Methods
// ============================================================

export const RPC_METHODS = {
  RELAY: {
    SET_FAN_1_CMD: 'set_fan_1_cmd',
    SET_FAN_2_CMD: 'set_fan_2_cmd',
    SET_VALVE_1_CMD: 'set_valve_1_cmd',
    SET_VALVE_2_CMD: 'set_valve_2_cmd',
    SET_VALVE_3_CMD: 'set_valve_3_cmd',
    SET_VALVE_4_CMD: 'set_valve_4_cmd',
    SET_LIGHT_1_CMD: 'set_light_1_cmd',
  },
  
  MOTOR: {
    SET_MOTOR_1_STATUS: 'set_motor_1_status',
    SET_MOTOR_2_STATUS: 'set_motor_2_status',
    SET_MOTOR_3_STATUS: 'set_motor_3_status',
    SET_MOTOR_4_STATUS: 'set_motor_4_status',
  },
  
  AUTO: {
    SET_FAN_1_AUTO: 'set_fan_1_auto',
    SET_FAN_2_AUTO: 'set_fan_2_auto',
    SET_VALVE_1_AUTO: 'set_valve_1_auto',
    SET_VALVE_2_AUTO: 'set_valve_2_auto',
    SET_VALVE_3_AUTO: 'set_valve_3_auto',
    SET_VALVE_4_AUTO: 'set_valve_4_auto',
    SET_LIGHT_1_AUTO: 'set_light_1_auto',
    SET_GLOBAL_MOTOR_AUTO: 'set_global_motor_auto',
  },
  
  TIMER: {
    SET_FAN_1_ON_TIME: 'set_fan_1_on_time',
    SET_FAN_1_OFF_TIME: 'set_fan_1_off_time',
    SET_FAN_2_ON_TIME: 'set_fan_2_on_time',
    SET_FAN_2_OFF_TIME: 'set_fan_2_off_time',
    SET_VALVE_1_ON_TIME: 'set_valve_1_on_time',
    SET_VALVE_1_OFF_TIME: 'set_valve_1_off_time',
    SET_VALVE_2_ON_TIME: 'set_valve_2_on_time',
    SET_VALVE_2_OFF_TIME: 'set_valve_2_off_time',
    SET_VALVE_3_ON_TIME: 'set_valve_3_on_time',
    SET_VALVE_3_OFF_TIME: 'set_valve_3_off_time',
    SET_VALVE_4_ON_TIME: 'set_valve_4_on_time',
    SET_VALVE_4_OFF_TIME: 'set_valve_4_off_time',
    SET_LIGHT_1_ON_TIME: 'set_light_1_on_time',
    SET_LIGHT_1_OFF_TIME: 'set_light_1_off_time',
    SET_GLOBAL_FW_TIME: 'set_global_fw_time',
    SET_GLOBAL_RE_TIME: 'set_global_re_time',
  },
  
  // Advanced Auto - Condition-based
  CONDITION: {
    SET_FAN_1_CONDITION: 'set_fan_1_condition_auto',
    SET_FAN_2_CONDITION: 'set_fan_2_condition_auto',
    SET_LIGHT_1_CONDITION: 'set_light_1_condition_auto',
    SET_MOTOR_CONDITION: 'set_motor_condition_auto',
  },
  
  // Advanced Auto - Interval Loop
  INTERVAL: {
    SET_FAN_1_INTERVAL: 'set_fan_1_interval_auto',
    SET_FAN_2_INTERVAL: 'set_fan_2_interval_auto',
    SET_WATER_INTERVAL: 'set_water_interval_auto',
    SET_LIGHT_1_INTERVAL: 'set_light_1_interval_auto',
    SET_MOTOR_INTERVAL: 'set_motor_interval_auto',
  },
} as const;

// ============================================================
// RPC to Attribute Confirmation Mapping
// ============================================================

export const RPC_CONFIRM_MAP: Record<string, string> = {
  // Relay
  [RPC_METHODS.RELAY.SET_FAN_1_CMD]: ATTRIBUTE_KEYS.RELAY.FAN_1_CMD,
  [RPC_METHODS.RELAY.SET_FAN_2_CMD]: ATTRIBUTE_KEYS.RELAY.FAN_2_CMD,
  [RPC_METHODS.RELAY.SET_VALVE_1_CMD]: ATTRIBUTE_KEYS.RELAY.VALVE_1_CMD,
  [RPC_METHODS.RELAY.SET_VALVE_2_CMD]: ATTRIBUTE_KEYS.RELAY.VALVE_2_CMD,
  [RPC_METHODS.RELAY.SET_VALVE_3_CMD]: ATTRIBUTE_KEYS.RELAY.VALVE_3_CMD,
  [RPC_METHODS.RELAY.SET_VALVE_4_CMD]: ATTRIBUTE_KEYS.RELAY.VALVE_4_CMD,
  [RPC_METHODS.RELAY.SET_LIGHT_1_CMD]: ATTRIBUTE_KEYS.RELAY.LIGHT_1_CMD,
  
  // Auto
  [RPC_METHODS.AUTO.SET_FAN_1_AUTO]: ATTRIBUTE_KEYS.AUTO.FAN_1_AUTO,
  [RPC_METHODS.AUTO.SET_FAN_2_AUTO]: ATTRIBUTE_KEYS.AUTO.FAN_2_AUTO,
  [RPC_METHODS.AUTO.SET_VALVE_1_AUTO]: ATTRIBUTE_KEYS.AUTO.VALVE_1_AUTO,
  [RPC_METHODS.AUTO.SET_VALVE_2_AUTO]: ATTRIBUTE_KEYS.AUTO.VALVE_2_AUTO,
  [RPC_METHODS.AUTO.SET_VALVE_3_AUTO]: ATTRIBUTE_KEYS.AUTO.VALVE_3_AUTO,
  [RPC_METHODS.AUTO.SET_VALVE_4_AUTO]: ATTRIBUTE_KEYS.AUTO.VALVE_4_AUTO,
  [RPC_METHODS.AUTO.SET_LIGHT_1_AUTO]: ATTRIBUTE_KEYS.AUTO.LIGHT_1_AUTO,
  [RPC_METHODS.AUTO.SET_GLOBAL_MOTOR_AUTO]: ATTRIBUTE_KEYS.AUTO.GLOBAL_MOTOR_AUTO,
  
  // Timer
  [RPC_METHODS.TIMER.SET_FAN_1_ON_TIME]: ATTRIBUTE_KEYS.TIMER.FAN_1_ON,
  [RPC_METHODS.TIMER.SET_FAN_1_OFF_TIME]: ATTRIBUTE_KEYS.TIMER.FAN_1_OFF,
  [RPC_METHODS.TIMER.SET_FAN_2_ON_TIME]: ATTRIBUTE_KEYS.TIMER.FAN_2_ON,
  [RPC_METHODS.TIMER.SET_FAN_2_OFF_TIME]: ATTRIBUTE_KEYS.TIMER.FAN_2_OFF,
  [RPC_METHODS.TIMER.SET_VALVE_1_ON_TIME]: ATTRIBUTE_KEYS.TIMER.VALVE_1_ON,
  [RPC_METHODS.TIMER.SET_VALVE_1_OFF_TIME]: ATTRIBUTE_KEYS.TIMER.VALVE_1_OFF,
  [RPC_METHODS.TIMER.SET_VALVE_2_ON_TIME]: ATTRIBUTE_KEYS.TIMER.VALVE_2_ON,
  [RPC_METHODS.TIMER.SET_VALVE_2_OFF_TIME]: ATTRIBUTE_KEYS.TIMER.VALVE_2_OFF,
  [RPC_METHODS.TIMER.SET_VALVE_3_ON_TIME]: ATTRIBUTE_KEYS.TIMER.VALVE_3_ON,
  [RPC_METHODS.TIMER.SET_VALVE_3_OFF_TIME]: ATTRIBUTE_KEYS.TIMER.VALVE_3_OFF,
  [RPC_METHODS.TIMER.SET_VALVE_4_ON_TIME]: ATTRIBUTE_KEYS.TIMER.VALVE_4_ON,
  [RPC_METHODS.TIMER.SET_VALVE_4_OFF_TIME]: ATTRIBUTE_KEYS.TIMER.VALVE_4_OFF,
  [RPC_METHODS.TIMER.SET_LIGHT_1_ON_TIME]: ATTRIBUTE_KEYS.TIMER.LIGHT_1_ON,
  [RPC_METHODS.TIMER.SET_LIGHT_1_OFF_TIME]: ATTRIBUTE_KEYS.TIMER.LIGHT_1_OFF,
  [RPC_METHODS.TIMER.SET_GLOBAL_FW_TIME]: ATTRIBUTE_KEYS.TIMER.GLOBAL_FW_TIME,
  [RPC_METHODS.TIMER.SET_GLOBAL_RE_TIME]: ATTRIBUTE_KEYS.TIMER.GLOBAL_RE_TIME,
};

// ============================================================
// Display Names (Thai)
// ============================================================

export const DISPLAY_NAMES: Record<string, string> = {
  // Air
  air_temp: 'อุณหภูมิอากาศ',
  air_humidity: 'ความชื้นอากาศ',
  air_co2: 'CO₂',
  air_light: 'แสง',
  
  // Soil
  moisture: 'ความชื้นดิน',
  temp: 'อุณหภูมิดิน',
  ec: 'EC',
  ph: 'pH',
  n: 'ไนโตรเจน (N)',
  p: 'ฟอสฟอรัส (P)',
  k: 'โพแทสเซียม (K)',
  
  // Relays
  fan_1_cmd: 'พัดลมใหญ่',
  fan_2_cmd: 'พัดลมกวนอากาศ',
  valve_1_cmd: 'น้ำโซน 1',
  valve_2_cmd: 'น้ำโซน 2',
  valve_3_cmd: 'น้ำโซน 3',
  valve_4_cmd: 'น้ำโซน 4',
  light_1_cmd: 'แสงเสริม',
  
  // Motors
  motor_1_fw: 'มอเตอร์ 1 เดินหน้า',
  motor_1_re: 'มอเตอร์ 1 ถอยหลัง',
  motor_2_fw: 'มอเตอร์ 2 เดินหน้า',
  motor_2_re: 'มอเตอร์ 2 ถอยหลัง',
  motor_3_fw: 'มอเตอร์ 3 เดินหน้า',
  motor_3_re: 'มอเตอร์ 3 ถอยหลัง',
  motor_4_fw: 'มอเตอร์ 4 เดินหน้า',
  motor_4_re: 'มอเตอร์ 4 ถอยหลัง',
  
  // System
  wifi_ssid: 'WiFi SSID',
  rssi: 'สัญญาณ WiFi',
  firmware_version: 'Firmware',
  stats_read_time_ms: 'เวลาอ่านข้อมูล',
};

// ============================================================
// Units
// ============================================================

export const UNITS: Record<string, string> = {
  air_temp: '°C',
  air_humidity: '%',
  air_co2: 'ppm',
  air_light: 'lux',
  moisture: '%',
  temp: '°C',
  ec: 'mS/cm',
  ph: '',
  n: 'mg/kg',
  p: 'mg/kg',
  k: 'mg/kg',
  rssi: 'dBm',
  stats_read_time_ms: 'ms',
};

// ============================================================
// Polling Intervals (ms)
// ============================================================

export const POLLING_INTERVALS = {
  ATTRIBUTES: 3000,      // 3 seconds - for control states
  TELEMETRY: 60000,      // 60 seconds - for sensor data
  BURST_CONFIRM: 500,    // 500ms - after RPC for confirmation
  BURST_DURATION: 6000,  // 6 seconds - how long to burst poll
};

// ============================================================
// Relay Configurations (7 อุปกรณ์ - ตาม firmware v2.0)
// ============================================================

export const RELAY_CONFIG = [
  { key: 'fan_1', name: 'พัดลมใหญ่', icon: 'Fan', cmdKey: 'fan_1_cmd', autoKey: 'fan_1_auto', rpcMethod: 'set_fan_1_cmd' },
  { key: 'fan_2', name: 'พัดลมกวนอากาศ', icon: 'Fan', cmdKey: 'fan_2_cmd', autoKey: 'fan_2_auto', rpcMethod: 'set_fan_2_cmd' },
  { key: 'valve_1', name: 'เปิดน้ำโซน 1', icon: 'Droplets', cmdKey: 'valve_1_cmd', autoKey: 'valve_1_auto', rpcMethod: 'set_valve_1_cmd' },
  { key: 'valve_2', name: 'เปิดน้ำโซน 2', icon: 'Droplets', cmdKey: 'valve_2_cmd', autoKey: 'valve_2_auto', rpcMethod: 'set_valve_2_cmd' },
  { key: 'valve_3', name: 'เปิดน้ำโซน 3', icon: 'Droplets', cmdKey: 'valve_3_cmd', autoKey: 'valve_3_auto', rpcMethod: 'set_valve_3_cmd' },
  { key: 'valve_4', name: 'เปิดน้ำโซน 4', icon: 'Droplets', cmdKey: 'valve_4_cmd', autoKey: 'valve_4_auto', rpcMethod: 'set_valve_4_cmd' },
  { key: 'light_1', name: 'แสงเสริม', icon: 'Lightbulb', cmdKey: 'light_1_cmd', autoKey: 'light_1_auto', rpcMethod: 'set_light_1_cmd' },
] as const;

// ============================================================
// Motor Configurations (ระบบพรางแสง)
// ============================================================

export const MOTOR_CONFIG = [
  { key: 'motor_1', name: 'พรางแสงโซนที่ 1', fwKey: 'motor_1_fw', reKey: 'motor_1_re', rpcMethod: 'set_motor_1_status' },
  { key: 'motor_2', name: 'พรางแสงโซนที่ 2', fwKey: 'motor_2_fw', reKey: 'motor_2_re', rpcMethod: 'set_motor_2_status' },
  { key: 'motor_3', name: 'พรางแสงโซนที่ 3', fwKey: 'motor_3_fw', reKey: 'motor_3_re', rpcMethod: 'set_motor_3_status' },
  { key: 'motor_4', name: 'พรางแสงโซนที่ 4', fwKey: 'motor_4_fw', reKey: 'motor_4_re', rpcMethod: 'set_motor_4_status' },
] as const;

// Motor command values
export const MOTOR_COMMANDS = {
  FORWARD: 1,  // พรางแสง (ลง)
  REVERSE: 2,  // ไม่พรางแสง (ขึ้น)
  STOP: 0,
} as const;
