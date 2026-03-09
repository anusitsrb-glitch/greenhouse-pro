import React, { useState } from 'react';
import { Fan, Droplets, Lightbulb, Sun, Zap, Clock, Activity } from 'lucide-react';
import { useThingsBoardAttributes } from '@/hooks/useThingsBoardAttributes';
import { RPC_METHODS } from '@/config/dataKeys';
import AutoDeviceCard from './AutoDeviceCard';

interface AutomationTabProps {
  project: string;
  gh: string;
  isReady: boolean;
  isOnline: boolean;
  userRole: string;
}

type DeviceColor = 'blue' | 'cyan' | 'yellow' | 'orange' | 'purple';

interface AutoDeviceConfig {
  id: 'fan_1' | 'fan_2' | 'water' | 'light_1' | 'motor';
  name: string;
  icon: React.ComponentType<any>;
  color: DeviceColor;
  conditionMethod?: string;
  intervalMethod?: string;
  supportsModes: readonly ('daily' | 'condition' | 'interval')[];
  special?: 'sequential' | 'allZones';
}

// Device configurations
const AUTO_DEVICES: AutoDeviceConfig[] = [
  {
    id: 'fan_1',
    name: 'พัดลมใหญ่',
    icon: Fan,
    color: 'blue',
    conditionMethod: RPC_METHODS.CONDITION?.SET_FAN_1_CONDITION || '',
    intervalMethod: RPC_METHODS.INTERVAL?.SET_FAN_1_INTERVAL || '',
    supportsModes: ['daily', 'condition', 'interval'],
  },
  {
    id: 'fan_2',
    name: 'พัดลมกวนอากาศ',
    icon: Fan,
    color: 'cyan',
    conditionMethod: RPC_METHODS.CONDITION?.SET_FAN_2_CONDITION || '',
    intervalMethod: RPC_METHODS.INTERVAL?.SET_FAN_2_INTERVAL || '',
    supportsModes: ['daily', 'condition', 'interval'],
  },
  {
    id: 'water',
    name: 'เปิดน้ำ (4 โซน)',
    icon: Droplets,
    color: 'blue',
    intervalMethod: RPC_METHODS.INTERVAL?.SET_WATER_INTERVAL || '',
    supportsModes: ['daily', 'interval'],
    special: 'sequential',
  },
  {
    id: 'light_1',
    name: 'แสงเสริม',
    icon: Lightbulb,
    color: 'yellow',
    conditionMethod: RPC_METHODS.CONDITION?.SET_LIGHT_1_CONDITION || '',
    intervalMethod: RPC_METHODS.INTERVAL?.SET_LIGHT_1_INTERVAL || '',
    supportsModes: ['daily', 'condition', 'interval'],
  },
  {
    id: 'motor',
    name: 'ระบบพรางแสง (4 โซน)',
    icon: Sun,
    color: 'orange',
    conditionMethod: RPC_METHODS.CONDITION?.SET_MOTOR_CONDITION || '',
    intervalMethod: RPC_METHODS.INTERVAL?.SET_MOTOR_INTERVAL || '',
    supportsModes: ['daily', 'condition', 'interval'],
    special: 'allZones',
  },
];

const SENSOR_OPTIONS = [
  { value: 'air_temp', label: 'อุณหภูมิอากาศ', unit: '°C' },
  { value: 'air_humidity', label: 'ความชื้นอากาศ', unit: '%' },
  { value: 'air_light', label: 'แสง', unit: 'lux' },
  { value: 'air_co2', label: 'CO2', unit: 'ppm' },
  { value: 'soil1_moisture', label: 'ความชื้นดิน จุดที่ 1', unit: '%' },
  { value: 'soil2_moisture', label: 'ความชื้นดิน จุดที่ 2', unit: '%' },
  { value: 'soil3_moisture', label: 'ความชื้นดิน จุดที่ 3', unit: '%' },
  { value: 'soil4_moisture', label: 'ความชื้นดิน จุดที่ 4', unit: '%' },
  { value: 'soil5_moisture', label: 'ความชื้นดิน จุดที่ 5', unit: '%' },
  { value: 'soil6_moisture', label: 'ความชื้นดิน จุดที่ 6', unit: '%' },
  { value: 'soil7_moisture', label: 'ความชื้นดิน จุดที่ 7', unit: '%' },
  { value: 'soil8_moisture', label: 'ความชื้นดิน จุดที่ 8', unit: '%' },
  { value: 'soil9_moisture', label: 'ความชื้นดิน จุดที่ 9', unit: '%' },
  { value: 'soil10_moisture', label: 'ความชื้นดิน จุดที่ 10', unit: '%' },
];

const CONDITION_OPTIONS = [
  { value: '>', label: 'มากกว่า (>)' },
  { value: '<', label: 'น้อยกว่า (<)' },
  { value: '>=', label: 'มากกว่าหรือเท่ากับ (≥)' },
  { value: '<=', label: 'น้อยกว่าหรือเท่ากับ (≤)' },
];

const iconColorClasses: Record<DeviceColor, string> = {
  blue: 'bg-blue-100 text-blue-600',
  cyan: 'bg-cyan-100 text-cyan-600',
  yellow: 'bg-yellow-100 text-yellow-600',
  orange: 'bg-orange-100 text-orange-600',
  purple: 'bg-purple-100 text-purple-600',
};

function normalizeModeValue(raw: unknown): number {
  if (raw === undefined || raw === null) return 0;
  const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export default function AutomationTab({
  project,
  gh,
  isReady,
  isOnline,
  userRole,
}: AutomationTabProps) {
  const [activeMode, setActiveMode] = useState<'overview' | 'detail'>('overview');

  // Get device ID from project/gh keys
  const deviceId = `${project}_${gh}`;

  const { attributes, isLoading: isAttrLoading, refresh } = useThingsBoardAttributes(deviceId, {
    pollingMs: 5000,
  });

  const getDeviceStatus = (device: AutoDeviceConfig) => {
    let isActive = false;
    let autoModeCode = 0;

    // Active status
    if (device.id === 'water') {
      isActive =
        attributes['valve_1_cmd'] === true ||
        attributes['valve_2_cmd'] === true ||
        attributes['valve_3_cmd'] === true ||
        attributes['valve_4_cmd'] === true;
    } else if (device.id === 'motor') {
      isActive = attributes['motor_1_fw'] === true || attributes['motor_1_re'] === true;
    } else {
      isActive = attributes[`${device.id}_cmd`] === true;
    }

    // Auto mode status from firmware-published attributes
    if (device.id === 'water') {
      autoModeCode = normalizeModeValue(
        attributes['water_mode'] ?? (attributes['valve_1_auto'] ? 1 : 0)
      );
    } else if (device.id === 'motor') {
      autoModeCode = normalizeModeValue(
        attributes['motor_mode'] ?? (attributes['global_motor_auto'] ? 1 : 0)
      );
    } else {
      const modeKey = device.id.replace('_', '') + '_mode'; // fan_1 -> fan1_mode
      autoModeCode = normalizeModeValue(
        attributes[modeKey] ?? (attributes[`${device.id}_auto`] ? 1 : 0)
      );
    }

    return { isActive, autoModeCode };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <Zap className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">ระบบทำงาน Auto</h2>
            <p className="text-purple-100 text-sm">ควบคุมอัตโนมัติด้วย 3 ระบบอัจฉริยะ</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setActiveMode('overview')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-all duration-200 ${
              activeMode === 'overview'
                ? 'bg-white text-purple-600 shadow-lg'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Activity className="w-4 h-4" />
              <span>ภาพรวม</span>
            </div>
          </button>
          <button
            onClick={() => setActiveMode('detail')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-all duration-200 ${
              activeMode === 'detail'
                ? 'bg-white text-purple-600 shadow-lg'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              <span>ตั้งค่าโหมด Auto</span>
            </div>
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Daily Schedule</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">ตั้งเวลาเปิด/ปิด</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 border border-green-200 dark:border-green-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500 rounded-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Smart Rules</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">การทำงานตามเงื่อนไข</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500 rounded-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Cycle Timer</p>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">การทํางานเป็นรอบ</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {activeMode === 'overview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              สถานะการทำงานแบบ Real-time
            </h3>
            {isAttrLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-400 animate-pulse">
                <Activity className="w-4 h-4" />
                <span>กำลังอัปเดต...</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {AUTO_DEVICES.map((device) => {
              const { isActive, autoModeCode } = getDeviceStatus(device);
              const isAutoEnabled = autoModeCode > 0;

              const modeNames = [
                'Manual',
                'ตั้งเวลา (Daily)',
                'การทำงานตามเงื่อนไข',
                'การทํางานเป็นรอบ',
              ];
              const currentModeName = modeNames[autoModeCode] || 'Manual';

              return (
                <div
                  key={device.id}
                  className={`relative overflow-hidden rounded-2xl p-4 border transition-all ${
                    isActive
                      ? 'bg-white border-emerald-200 shadow-md'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase ${
                        isActive ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {isActive ? 'Working' : 'Idle'}
                    </span>
                    <span
                      className={`flex h-2.5 w-2.5 rounded-full ${
                        isActive
                          ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                          : 'bg-slate-300'
                      }`}
                    />
                  </div>

                  <div className="flex items-start gap-4 mb-3">
                    <div
                      className={`p-3 rounded-xl flex items-center justify-center transition-colors ${
                        isActive ? iconColorClasses[device.color] : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      <device.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 dark:text-gray-100 text-lg leading-tight">
                        {device.name}
                      </h4>
                      <p className="text-[10px] text-gray-400 mt-1 font-mono uppercase tracking-widest">
                        {device.id}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">ระบบควบคุม</span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          isAutoEnabled
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {isAutoEnabled ? currentModeName : 'Manual'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {!isOnline && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-700 shadow-sm">
              <Zap className="w-5 h-5 fill-rose-500" />
              <div className="text-sm">
                <p className="font-bold leading-none mb-1">อุปกรณ์ออฟไลน์</p>
                <p className="opacity-80">ระบบอัตโนมัติจะทำงานตามค่าล่าสุดที่บันทึกไว้ในตัวเครื่อง</p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeMode === 'detail' && (
        <div className="space-y-6">
          {AUTO_DEVICES.map((device) => (
            <AutoDeviceCard
              key={device.id}
              device={device}
              deviceId={deviceId}
              attributes={attributes}
              onRefresh={refresh}
              sensorOptions={SENSOR_OPTIONS}
              conditionOptions={CONDITION_OPTIONS}
            />
          ))}
        </div>
      )}
    </div>
  );
}