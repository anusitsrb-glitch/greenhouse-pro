// User types
export type UserRole = 'superadmin' | 'admin' | 'operator' | 'viewer';

export interface User {
  id: number;
  username: string;
  email: string | null;
  fullName?: string | null;
  phone?: string | null;
  role: UserRole;
  language?: string;
  theme?: string;
  isActive: boolean;
  createdAt: string;

  // ✅ เพิ่มให้ตรงกับ ProfilePage (backend อาจส่งมา หรือไม่ส่งมาก็ได้)
  lastLoginAt?: string | null;
}

// Auth context types
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Project types
export type ProjectStatus = 'ready' | 'developing';

export interface Project {
  id: number;
  key: string;
  nameTh: string;
  status: ProjectStatus;
}

// Greenhouse types
export type GreenhouseStatus = 'ready' | 'developing';

export interface Greenhouse {
  id: number;
  projectId: number;
  ghKey: string;
  nameTh: string;
  status: GreenhouseStatus;
  deviceId: string | null;
}

// Tab types for greenhouse page
export type GreenhouseTab = 'soil' | 'charts' | 'dashboard' | 'timers';

export const TAB_ORDER: GreenhouseTab[] = ['soil', 'charts', 'dashboard', 'timers'];

export const TAB_LABELS: Record<GreenhouseTab, string> = {
  soil: 'ค่าดิน',
  charts: 'กราฟ',
  dashboard: 'ควบคุม',
  timers: 'ตั้งเวลา',
};

// Telemetry types
export interface AirTelemetry {
  air_temp: number | null;
  air_humidity: number | null;
  air_co2: number | null;
  air_light: number | null;
}

export interface SoilNodeTelemetry {
  moisture: number | null;
  temp: number | null;
  ec: number | null;
  ph: number | null;
  n: number | null;
  p: number | null;
  k: number | null;
}

export interface SystemTelemetry {
  wifi_ssid: string | null;
  rssi: number | null;
  firmware_version: string | null;
  stats_read_time_ms: number | null;
}

// Attributes types
export interface DeviceAttributes {
  status: string | null;
  fan_1_cmd: boolean;
  fan_2_cmd: boolean;
  valve_2_cmd: boolean;
  pump_1_cmd: boolean;
  light_1_cmd: boolean;

  motor_1_fw: boolean;
  motor_1_re: boolean;
  motor_2_fw: boolean;
  motor_2_re: boolean;
  motor_3_fw: boolean;
  motor_3_re: boolean;
  motor_4_fw: boolean;
  motor_4_re: boolean;

  fan_1_auto: boolean;
  fan_2_auto: boolean;
  valve_2_auto: boolean;
  pump_1_auto: boolean;
  light_1_auto: boolean;
  global_motor_auto: boolean;

  fan_1_on: string;
  fan_1_off: string;
  fan_2_on: string;
  fan_2_off: string;
  valve_2_on: string;
  valve_2_off: string;
  pump_1_on: string;
  pump_1_off: string;
  light_1_on: string;
  light_1_off: string;
  global_fw_time: string;
  global_re_time: string;
}

export type RelayKey = 'fan_1' | 'fan_2' | 'valve_2' | 'pump_1' | 'light_1';
export type MotorKey = 'motor_1' | 'motor_2' | 'motor_3' | 'motor_4';

export interface ControlCommand {
  method: string;
  params: number | string;
  confirmKey: string;
  expectedValue: unknown;
}

export interface PendingState {
  isPending: boolean;
  startedAt: number | null;
  method: string | null;
  expectedValue: unknown;
}

export type LockReason =
  | 'offline'
  | 'auto_locked'
  | 'motor_auto_locked'
  | 'pending'
  | 'no_permission'
  | 'developing';

export const LOCK_REASON_MESSAGES: Record<LockReason, string> = {
  offline: 'อุปกรณ์ออฟไลน์ (Offline) ไม่สามารถสั่งงานได้',
  auto_locked: 'ถูกล็อกเพราะเปิดโหมด Auto ต้องปิด Auto ก่อน',
  motor_auto_locked: 'ถูกล็อกเพราะเปิดโหมด Auto มอเตอร์ ต้องปิด Auto ก่อน',
  pending: 'คำสั่งกำลังดำเนินการ กรุณารอ',
  no_permission: 'คุณไม่มีสิทธิ์ควบคุมอุปกรณ์',
  developing: 'กำลังพัฒนา - ยังไม่มีการผูก ThingsBoard Device (deviceId)',
};

export type ChartRange = '1h' | '6h' | '24h' | '7d' | '30d';

export const CHART_RANGE_CONFIG: Record<ChartRange, { label: string; ms: number; interval: number; agg: string }> = {
  '1h': { label: '1 ชั่วโมง', ms: 60 * 60 * 1000, interval: 60000, agg: 'AVG' },
  '6h': { label: '6 ชั่วโมง', ms: 6 * 60 * 60 * 1000, interval: 300000, agg: 'AVG' },
  '24h': { label: '24 ชั่วโมง', ms: 24 * 60 * 60 * 1000, interval: 600000, agg: 'AVG' },
  '7d': { label: '7 วัน', ms: 7 * 24 * 60 * 60 * 1000, interval: 3600000, agg: 'AVG' },
  '30d': { label: '30 วัน', ms: 30 * 24 * 60 * 60 * 1000, interval: 14400000, agg: 'AVG' },
};

export type ChartMode = 'air' | 'soil' | 'compare';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}
