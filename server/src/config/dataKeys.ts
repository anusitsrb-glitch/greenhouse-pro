/**
 * ThingsBoard Data Keys Configuration
 * Centralized mapping for all telemetry, attributes, and RPC methods
 * 
 * DO NOT scatter these keys across files - always import from here
 */

// ============================================================
// Telemetry Keys (Read-only from device)
// ============================================================

export const TELEMETRY_KEYS = {
  // Air sensors
  AIR: {
    TEMP: 'air_temp',
    HUMIDITY: 'air_humidity',
    CO2: 'air_co2',
    LIGHT: 'air_light',
  },
  
  // System info
  SYSTEM: {
    WIFI_SSID: 'wifi_ssid',
    RSSI: 'rssi',
    FIRMWARE_VERSION: 'firmware_version',
    STATS_READ_TIME_MS: 'stats_read_time_ms',
  },
} as const;

// Soil node telemetry (1-10)
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

// All air telemetry keys as array
export const AIR_TELEMETRY_KEYS = Object.values(TELEMETRY_KEYS.AIR);

// All system telemetry keys as array
export const SYSTEM_TELEMETRY_KEYS = Object.values(TELEMETRY_KEYS.SYSTEM);

// Get all soil keys for a node as array
export function getSoilKeysArray(nodeIndex: number): string[] {
  return Object.values(getSoilKeys(nodeIndex));
}

// Get all soil keys for all nodes (1-10)
export function getAllSoilKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 10; i++) {
    keys.push(...getSoilKeysArray(i));
  }
  return keys;
}

// ============================================================
// Attribute Keys (Device state/status)
// ============================================================

export const ATTRIBUTE_KEYS = {
  // Connection status
  STATUS: 'status',
  
  // Relay commands
  RELAY: {
    FAN_1_CMD: 'fan_1_cmd',
    FAN_2_CMD: 'fan_2_cmd',
    VALVE_2_CMD: 'valve_2_cmd',
    PUMP_1_CMD: 'pump_1_cmd',
    LIGHT_1_CMD: 'light_1_cmd',
  },
  
  // Motor states
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
  
  // Auto modes
  AUTO: {
    FAN_1_AUTO: 'fan_1_auto',
    FAN_2_AUTO: 'fan_2_auto',
    VALVE_2_AUTO: 'valve_2_auto',
    PUMP_1_AUTO: 'pump_1_auto',
    LIGHT_1_AUTO: 'light_1_auto',
    GLOBAL_MOTOR_AUTO: 'global_motor_auto',
  },
  
  // Timer schedules (HH:mm format)
  TIMER: {
    FAN_1_ON: 'fan_1_on',
    FAN_1_OFF: 'fan_1_off',
    FAN_2_ON: 'fan_2_on',
    FAN_2_OFF: 'fan_2_off',
    VALVE_2_ON: 'valve_2_on',
    VALVE_2_OFF: 'valve_2_off',
    PUMP_1_ON: 'pump_1_on',
    PUMP_1_OFF: 'pump_1_off',
    LIGHT_1_ON: 'light_1_on',
    LIGHT_1_OFF: 'light_1_off',
    GLOBAL_FW_TIME: 'global_fw_time',
    GLOBAL_RE_TIME: 'global_re_time',
  },
} as const;

// All relay attribute keys
export const RELAY_ATTRIBUTE_KEYS = Object.values(ATTRIBUTE_KEYS.RELAY);

// All motor attribute keys
export const MOTOR_ATTRIBUTE_KEYS = Object.values(ATTRIBUTE_KEYS.MOTOR);

// All auto mode attribute keys
export const AUTO_ATTRIBUTE_KEYS = Object.values(ATTRIBUTE_KEYS.AUTO);

// All timer attribute keys
export const TIMER_ATTRIBUTE_KEYS = Object.values(ATTRIBUTE_KEYS.TIMER);

// All control-related attributes (for polling)
export const ALL_CONTROL_ATTRIBUTES = [
  ATTRIBUTE_KEYS.STATUS,
  ...RELAY_ATTRIBUTE_KEYS,
  ...MOTOR_ATTRIBUTE_KEYS,
  ...AUTO_ATTRIBUTE_KEYS,
  ...TIMER_ATTRIBUTE_KEYS,
];

// ============================================================
// RPC Methods (Commands to device)
// ============================================================

export const RPC_METHODS = {
  // Relay controls (param: 1=ON, 0=OFF)
  RELAY: {
    SET_FAN_1_CMD: 'set_fan_1_cmd',
    SET_FAN_2_CMD: 'set_fan_2_cmd',
    SET_VALVE_2_CMD: 'set_valve_2_cmd',
    SET_PUMP_1_CMD: 'set_pump_1_cmd',
    SET_LIGHT_1_CMD: 'set_light_1_cmd',
  },
  
  // Motor controls (param: 1=Down/Fw, 2=Up/Re, 0=Stop)
  MOTOR: {
    SET_MOTOR_1_STATUS: 'set_motor_1_status',
    SET_MOTOR_2_STATUS: 'set_motor_2_status',
    SET_MOTOR_3_STATUS: 'set_motor_3_status',
    SET_MOTOR_4_STATUS: 'set_motor_4_status',
  },
  
  // Auto mode controls (param: 1=ON, 0=OFF)
  AUTO: {
    SET_FAN_1_AUTO: 'set_fan_1_auto',
    SET_FAN_2_AUTO: 'set_fan_2_auto',
    SET_VALVE_2_AUTO: 'set_valve_2_auto',
    SET_PUMP_1_AUTO: 'set_pump_1_auto',
    SET_LIGHT_1_AUTO: 'set_light_1_auto',
    SET_GLOBAL_MOTOR_AUTO: 'set_global_motor_auto',
  },
  
  // Timer controls (param: string "HH:mm")
  TIMER: {
    SET_FAN_1_ON_TIME: 'set_fan_1_on_time',
    SET_FAN_1_OFF_TIME: 'set_fan_1_off_time',
    SET_FAN_2_ON_TIME: 'set_fan_2_on_time',
    SET_FAN_2_OFF_TIME: 'set_fan_2_off_time',
    SET_VALVE_2_ON_TIME: 'set_valve_2_on_time',
    SET_VALVE_2_OFF_TIME: 'set_valve_2_off_time',
    SET_PUMP_1_ON_TIME: 'set_pump_1_on_time',
    SET_PUMP_1_OFF_TIME: 'set_pump_1_off_time',
    SET_LIGHT_1_ON_TIME: 'set_light_1_on_time',
    SET_LIGHT_1_OFF_TIME: 'set_light_1_off_time',
    SET_GLOBAL_FW_TIME: 'set_global_fw_time',
    SET_GLOBAL_RE_TIME: 'set_global_re_time',
  },
} as const;

// ============================================================
// RPC Confirmation Mapping
// Maps RPC method to the attribute that should change to confirm success
// ============================================================

export interface RpcConfirmation {
  attribute: string;
  expectedValue?: unknown; // If provided, must match this value
  transform?: (params: unknown) => unknown; // Transform params to expected value
}

export const RPC_CONFIRMATIONS: Record<string, RpcConfirmation> = {
  // Relay confirmations
  [RPC_METHODS.RELAY.SET_FAN_1_CMD]: { attribute: ATTRIBUTE_KEYS.RELAY.FAN_1_CMD },
  [RPC_METHODS.RELAY.SET_FAN_2_CMD]: { attribute: ATTRIBUTE_KEYS.RELAY.FAN_2_CMD },
  [RPC_METHODS.RELAY.SET_VALVE_2_CMD]: { attribute: ATTRIBUTE_KEYS.RELAY.VALVE_2_CMD },
  [RPC_METHODS.RELAY.SET_PUMP_1_CMD]: { attribute: ATTRIBUTE_KEYS.RELAY.PUMP_1_CMD },
  [RPC_METHODS.RELAY.SET_LIGHT_1_CMD]: { attribute: ATTRIBUTE_KEYS.RELAY.LIGHT_1_CMD },
  
  // Auto mode confirmations
  [RPC_METHODS.AUTO.SET_FAN_1_AUTO]: { attribute: ATTRIBUTE_KEYS.AUTO.FAN_1_AUTO },
  [RPC_METHODS.AUTO.SET_FAN_2_AUTO]: { attribute: ATTRIBUTE_KEYS.AUTO.FAN_2_AUTO },
  [RPC_METHODS.AUTO.SET_VALVE_2_AUTO]: { attribute: ATTRIBUTE_KEYS.AUTO.VALVE_2_AUTO },
  [RPC_METHODS.AUTO.SET_PUMP_1_AUTO]: { attribute: ATTRIBUTE_KEYS.AUTO.PUMP_1_AUTO },
  [RPC_METHODS.AUTO.SET_LIGHT_1_AUTO]: { attribute: ATTRIBUTE_KEYS.AUTO.LIGHT_1_AUTO },
  [RPC_METHODS.AUTO.SET_GLOBAL_MOTOR_AUTO]: { attribute: ATTRIBUTE_KEYS.AUTO.GLOBAL_MOTOR_AUTO },
  
  // Timer confirmations
  [RPC_METHODS.TIMER.SET_FAN_1_ON_TIME]: { attribute: ATTRIBUTE_KEYS.TIMER.FAN_1_ON },
  [RPC_METHODS.TIMER.SET_FAN_1_OFF_TIME]: { attribute: ATTRIBUTE_KEYS.TIMER.FAN_1_OFF },
  [RPC_METHODS.TIMER.SET_FAN_2_ON_TIME]: { attribute: ATTRIBUTE_KEYS.TIMER.FAN_2_ON },
  [RPC_METHODS.TIMER.SET_FAN_2_OFF_TIME]: { attribute: ATTRIBUTE_KEYS.TIMER.FAN_2_OFF },
  [RPC_METHODS.TIMER.SET_VALVE_2_ON_TIME]: { attribute: ATTRIBUTE_KEYS.TIMER.VALVE_2_ON },
  [RPC_METHODS.TIMER.SET_VALVE_2_OFF_TIME]: { attribute: ATTRIBUTE_KEYS.TIMER.VALVE_2_OFF },
  [RPC_METHODS.TIMER.SET_PUMP_1_ON_TIME]: { attribute: ATTRIBUTE_KEYS.TIMER.PUMP_1_ON },
  [RPC_METHODS.TIMER.SET_PUMP_1_OFF_TIME]: { attribute: ATTRIBUTE_KEYS.TIMER.PUMP_1_OFF },
  [RPC_METHODS.TIMER.SET_LIGHT_1_ON_TIME]: { attribute: ATTRIBUTE_KEYS.TIMER.LIGHT_1_ON },
  [RPC_METHODS.TIMER.SET_LIGHT_1_OFF_TIME]: { attribute: ATTRIBUTE_KEYS.TIMER.LIGHT_1_OFF },
  [RPC_METHODS.TIMER.SET_GLOBAL_FW_TIME]: { attribute: ATTRIBUTE_KEYS.TIMER.GLOBAL_FW_TIME },
  [RPC_METHODS.TIMER.SET_GLOBAL_RE_TIME]: { attribute: ATTRIBUTE_KEYS.TIMER.GLOBAL_RE_TIME },
};

// Motor confirmations are special - they depend on the params value
export function getMotorConfirmation(motorIndex: number, params: number): RpcConfirmation[] {
  const fwKey = `motor_${motorIndex}_fw`;
  const reKey = `motor_${motorIndex}_re`;
  
  switch (params) {
    case 1: // Down/Forward
      return [
        { attribute: fwKey, expectedValue: true },
        { attribute: reKey, expectedValue: false },
      ];
    case 2: // Up/Reverse
      return [
        { attribute: fwKey, expectedValue: false },
        { attribute: reKey, expectedValue: true },
      ];
    case 0: // Stop
    default:
      return [
        { attribute: fwKey, expectedValue: false },
        { attribute: reKey, expectedValue: false },
      ];
  }
}

// ============================================================
// Units and Display Formatting
// ============================================================

export const UNITS = {
  TEMPERATURE: '°C',
  HUMIDITY: '%',
  CO2: 'ppm',
  LIGHT: 'lux',
  EC: 'mS/cm',
  PH: '',
  MOISTURE: '%',
  NPK: 'mg/kg',
  RSSI: 'dBm',
  TIME: 'ms',
} as const;

export const DISPLAY_NAMES = {
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
  fan_1: 'พัดลม 1',
  fan_2: 'พัดลม 2',
  valve_2: 'วาล์ว 2',
  pump_1: 'ปั๊ม 1',
  light_1: 'ไฟ 1',
  
  // Motors
  motor_1: 'มอเตอร์ 1',
  motor_2: 'มอเตอร์ 2',
  motor_3: 'มอเตอร์ 3',
  motor_4: 'มอเตอร์ 4',
  
  // System
  wifi_ssid: 'WiFi SSID',
  rssi: 'สัญญาณ WiFi',
  firmware_version: 'Firmware',
  stats_read_time_ms: 'เวลาอ่านข้อมูล',
} as const;
