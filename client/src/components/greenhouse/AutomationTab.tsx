import React, { useState } from 'react';
import { Fan, Droplets, Lightbulb, Sun, Zap, Clock, Activity } from 'lucide-react';
import { useThingsBoardRPC } from '@/hooks/useThingsBoardRPC';
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

// Device configurations
const AUTO_DEVICES = [
  {
    id: 'fan_1',
    name: 'พัดลมใหญ่',
    icon: Fan,
    color: 'blue' as const,
    conditionMethod: RPC_METHODS.CONDITION?.SET_FAN_1_CONDITION || '',
    intervalMethod: RPC_METHODS.INTERVAL?.SET_FAN_1_INTERVAL || '',
    supportsModes: ['daily', 'condition', 'interval'] as const,
  },
  {
    id: 'fan_2',
    name: 'พัดลมกวนอากาศ',
    icon: Fan,
    color: 'cyan' as const,
    conditionMethod: RPC_METHODS.CONDITION?.SET_FAN_2_CONDITION || '',
    intervalMethod: RPC_METHODS.INTERVAL?.SET_FAN_2_INTERVAL || '',
    supportsModes: ['daily', 'condition', 'interval'] as const,
  },
  {
    id: 'water',
    name: 'เปิดน้ำ (4 โซน)',
    icon: Droplets,
    color: 'blue' as const,
    intervalMethod: RPC_METHODS.INTERVAL?.SET_WATER_INTERVAL || '',
    supportsModes: ['interval'] as const,
    special: 'sequential' as const,
  },
  {
    id: 'light_1',
    name: 'แสงเสริม',
    icon: Lightbulb,
    color: 'yellow' as const,
    conditionMethod: RPC_METHODS.CONDITION?.SET_LIGHT_1_CONDITION || '',
    intervalMethod: RPC_METHODS.INTERVAL?.SET_LIGHT_1_INTERVAL || '',
    supportsModes: ['daily', 'condition', 'interval'] as const,
  },
  {
    id: 'motor',
    name: 'ระบบพรางแสง (4 โซน)',
    icon: Sun,
    color: 'orange' as const,
    conditionMethod: RPC_METHODS.CONDITION?.SET_MOTOR_CONDITION || '',
    intervalMethod: RPC_METHODS.INTERVAL?.SET_MOTOR_INTERVAL || '',
    supportsModes: ['daily', 'condition', 'interval'] as const,
    special: 'allZones' as const,
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

export default function AutomationTab({ 
  project, 
  gh, 
  isReady, 
  isOnline, 
  userRole 
}: AutomationTabProps) {
  const [activeMode, setActiveMode] = useState<'overview' | 'detail'>('overview');
  
  // Get device ID from project/gh keys
  const deviceId = `${project}_${gh}`;
  
  const { attributes, isLoading: isAttrLoading, refresh } = useThingsBoardAttributes(deviceId, {
    // Faster polling on this screen so the UI reflects ESP32-published
    // advanced-auto attributes quickly after RPC writes.
    pollingMs: 5000,
  });

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
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">ตั้งเวลา</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 border border-green-200 dark:border-green-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500 rounded-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Condition-based</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">ตามเงื่อนไข</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500 rounded-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Interval Loop</p>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">รอบเวลา</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {activeMode === 'overview' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            สถานะระบบ Auto
          </h3>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400 text-center py-8">
              กำลังพัฒนา... (แสดงสถานะการทำงานแบบ real-time)
            </p>
          </div>
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
