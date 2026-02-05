/**
 * AutoDeviceCard.tsx - Enhanced Version
 * ✅ Improved UI for Condition & Interval modes
 * ✅ Better validation & error handling
 * ✅ Real-time attribute sync from ESP32
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  LucideIcon, ChevronDown, ChevronUp, Clock, Activity, Zap, 
  AlertCircle, CheckCircle, Info, AlertTriangle, RefreshCw 
} from 'lucide-react';
import { useThingsBoardRPC } from '@/hooks/useThingsBoardRPC';
import { normalizeBoolean, cn } from '@/lib/utils';

interface DeviceConfig {
  id: string;
  name: string;
  icon: LucideIcon;
  color: 'blue' | 'cyan' | 'yellow' | 'orange' | 'purple';
  conditionMethod?: string;
  intervalMethod?: string;
  supportsModes: readonly ('daily' | 'condition' | 'interval')[];
  special?: 'sequential' | 'allZones';
}

interface SensorOption {
  value: string;
  label: string;
  unit: string;
}

interface ConditionOption {
  value: string;
  label: string;
}

interface AutoDeviceCardProps {
  device: DeviceConfig;
  deviceId: string;
  sensorOptions: SensorOption[];
  conditionOptions: ConditionOption[];
  attributes: Record<string, any>;
  onRefresh?: () => void;
}

export default function AutoDeviceCard({
  device,
  deviceId,
  sensorOptions,
  conditionOptions,
  attributes,
  onRefresh,
}: AutoDeviceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'daily' | 'condition' | 'interval'>(() => {
    if (device.supportsModes.includes('daily')) return 'daily';
    if (device.supportsModes.includes('condition')) return 'condition';
    return 'interval';
  });

  const conditionRpc = useThingsBoardRPC(deviceId, device.conditionMethod || '');
  const intervalRpc = useThingsBoardRPC(deviceId, device.intervalMethod || '');

  // Condition state
  const [conditionEnabled, setConditionEnabled] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState('air_temp');
  const [selectedCondition, setSelectedCondition] = useState('>');
  const [threshold, setThreshold] = useState('35');
  const [action, setAction] = useState<number>(1);

  // Interval state
  const [intervalEnabled, setIntervalEnabled] = useState(false);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('19:00');
  const [onMinutes, setOnMinutes] = useState('10');
  const [offMinutes, setOffMinutes] = useState('60');
  const [maxCycles, setMaxCycles] = useState('5');

  // Validation states
  const [conditionError, setConditionError] = useState<string>('');
  const [intervalError, setIntervalError] = useState<string>('');

  // Success states
  const [showConditionSuccess, setShowConditionSuccess] = useState(false);
  const [showIntervalSuccess, setShowIntervalSuccess] = useState(false);

  const Icon = device.icon;
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    cyan: 'from-cyan-500 to-cyan-600',
    yellow: 'from-yellow-500 to-yellow-600',
    orange: 'from-orange-500 to-orange-600',
    purple: 'from-purple-500 to-purple-600',
  };

  // Attribute prefix
  const attrPrefix = useMemo(() => {
    switch (device.id) {
      case 'fan_1': return 'fan1';
      case 'fan_2': return 'fan2';
      case 'light_1': return 'light1';
      case 'water': return 'water';
      case 'motor': return 'motor';
      default: return device.id;
    }
  }, [device.id]);

  // Mode detection from ESP32
  const modeKey = `${attrPrefix}_mode`;
  const modeValue = useMemo(() => {
    const raw = attributes?.[modeKey];
    if (raw === undefined || raw === null) return undefined;
    const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }, [attributes, modeKey]);

  const derivedActiveTab = useMemo<'daily' | 'condition' | 'interval'>(() => {
    if (device.id === 'water') {
      return modeValue === 2 ? 'interval' : 'daily';
    }
    if (modeValue === 2) return 'condition';
    if (modeValue === 3) return 'interval';
    return 'daily';
  }, [modeValue, device.id]);

  const modeLabel = useMemo(() => {
    if (modeValue === undefined) return 'ไม่ทราบ';
    if (modeValue === 255) return 'Manual/Override';
    if (device.id === 'water') {
      if (modeValue === 2) return 'Interval (Sequential)';
      if (modeValue === 1) return 'Daily (Valve)';
      return 'OFF';
    }
    if (device.id === 'motor') {
      if (modeValue === 3) return 'Interval';
      if (modeValue === 2) return 'Condition';
      if (modeValue === 1) return 'Global/Daily';
      return 'OFF';
    }
    if (modeValue === 3) return 'Interval';
    if (modeValue === 2) return 'Condition';
    if (modeValue === 1) return 'Daily';
    return 'OFF';
  }, [device.id, modeValue]);

  // Sync tab with mode
  const prevModeRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (modeValue === undefined) return;
    if (prevModeRef.current !== modeValue) {
      prevModeRef.current = modeValue;
      setActiveTab(derivedActiveTab);
    }
  }, [modeValue, derivedActiveTab]);

  // Hydrate from attributes
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!attributes) return;

    const readBool = (k: string) => normalizeBoolean(attributes[k]);
    const readStr = (k: string, fallback: string) => {
      const v = attributes[k];
      return typeof v === 'string' && v.length ? v : fallback;
    };
    const readNum = (k: string, fallback: number) => {
      const v = attributes[k];
      const n = typeof v === 'string' ? parseFloat(v) : Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    if (isExpanded && hydratedRef.current) return;

    // Condition
    const condEnKey = `${attrPrefix}_cond_en`;
    if (condEnKey in attributes) {
      setConditionEnabled(readBool(condEnKey));
      setSelectedSensor(readStr(`${attrPrefix}_cond_sensor`, 'air_temp'));
      setSelectedCondition(readStr(`${attrPrefix}_cond_op`, '>'));
      setThreshold(String(readNum(`${attrPrefix}_cond_th`, 35)));
      setAction(readNum(`${attrPrefix}_cond_act`, 1));
    }

    // Interval
    const intvEnKey = `${attrPrefix}_intv_en`;
    if (intvEnKey in attributes) {
      setIntervalEnabled(readBool(intvEnKey));
      setStartTime(readStr(`${attrPrefix}_intv_st`, '10:00'));
      setEndTime(readStr(`${attrPrefix}_intv_et`, '19:00'));
      setOnMinutes(String(readNum(`${attrPrefix}_intv_on`, 10)));
      setOffMinutes(String(readNum(`${attrPrefix}_intv_off`, 60)));
      setMaxCycles(String(readNum(`${attrPrefix}_intv_cyc`, 5)));
    }

    hydratedRef.current = true;
  }, [attributes, attrPrefix, isExpanded]);

  // Validate Condition
  const validateCondition = (): boolean => {
    if (!conditionEnabled) return true;

    const th = parseFloat(threshold);
    if (isNaN(th)) {
      setConditionError('กรุณากรอกค่า Threshold ที่ถูกต้อง');
      return false;
    }

    setConditionError('');
    return true;
  };

  // Validate Interval
  const validateInterval = (): boolean => {
    if (!intervalEnabled) return true;

    const on = parseInt(onMinutes);
    const off = parseInt(offMinutes);
    const cycles = parseInt(maxCycles);

    if (isNaN(on) || on <= 0) {
      setIntervalError('เวลาเปิดต้องมากกว่า 0 นาที');
      return false;
    }

    if (isNaN(off) || off < 0) {
      setIntervalError('เวลาปิดต้องไม่เป็นลบ');
      return false;
    }

    if (isNaN(cycles) || cycles <= 0 || cycles > 10) {
      setIntervalError('จำนวนรอบต้องอยู่ระหว่าง 1-10');
      return false;
    }

    if (!startTime || !endTime) {
      setIntervalError('กรุณาระบุช่วงเวลา');
      return false;
    }

    setIntervalError('');
    return true;
  };

  // Save Condition
  const handleConditionSave = async () => {
    if (!device.conditionMethod) return;
    
    if (!validateCondition()) return;

    const params = {
      enabled: conditionEnabled,
      sensorKey: selectedSensor,
      condition: selectedCondition,
      threshold: parseFloat(threshold),
      action: action,
    };

    try {
      await conditionRpc.sendCommand(params);
      setShowConditionSuccess(true);
      setTimeout(() => setShowConditionSuccess(false), 3000);
      onRefresh?.();
    } catch (err) {
      setConditionError('ไม่สามารถบันทึกได้ กรุณาลองใหม่');
    }
  };

  // Save Interval
  const handleIntervalSave = async () => {
    if (!device.intervalMethod) return;
    
    if (!validateInterval()) return;

    const params = {
      enabled: intervalEnabled,
      startTime: startTime,
      endTime: endTime,
      onMinutes: parseInt(onMinutes),
      offMinutes: parseInt(offMinutes),
      maxCycles: parseInt(maxCycles),
    };

    try {
      await intervalRpc.sendCommand(params);
      setShowIntervalSuccess(true);
      setTimeout(() => setShowIntervalSuccess(false), 3000);
      onRefresh?.();
    } catch (err) {
      setIntervalError('ไม่สามารถบันทึกได้ กรุณาลองใหม่');
    }
  };

  const selectedSensorInfo = sensorOptions.find(s => s.value === selectedSensor);
  const actionLabel = useMemo(() => {
    if (device.id === 'motor') {
      return action === 2 ? 'ย้อนกลับ' : 'เดินหน้า';
    }
    return action === 1 ? 'เปิด' : 'ปิด';
  }, [action, device.id]);

  // Calculate interval stats
  const totalCycleTime = parseInt(onMinutes) + parseInt(offMinutes);
  const cyclesPerHour = totalCycleTime > 0 ? Math.floor(60 / totalCycleTime) : 0;
  const onPercentage = totalCycleTime > 0 ? Math.round((parseInt(onMinutes) / totalCycleTime) * 100) : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-xl">
      {/* Header */}
      <div
        className={`bg-gradient-to-r ${colorClasses[device.color]} p-5 text-white cursor-pointer`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{device.name}</h3>
              <p className="text-sm text-white/80">
                {device.special === 'sequential' && 'ระบบหมุนเวียน 4 โซน'}
                {device.special === 'allZones' && 'ทำงานพร้อมกัน 4 โซน'}
                {!device.special && 'ควบคุมอัตโนมัติ'}
              </p>
            </div>
          </div>
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-6">
          {/* Current Mode Status */}
          <div className="mb-4 p-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  โหมดปัจจุบัน:
                </span>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">
                {modeLabel}
              </span>
            </div>
            {modeValue === 255 && (
              <div className="mt-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>อุปกรณ์อยู่ในโหมดควบคุมด้วยมือ (Manual Override)</span>
              </div>
            )}
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-2 mb-6 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
            {device.supportsModes.includes('daily') && (
              <button
                onClick={() => setActiveTab('daily')}
                className={cn(
                  'flex-1 py-2.5 px-4 rounded-lg font-medium transition-all',
                  activeTab === 'daily'
                    ? 'bg-white dark:bg-gray-600 shadow-md text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                <div className="flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span className="hidden sm:inline">ตั้งเวลา</span>
                </div>
              </button>
            )}
            
            {device.supportsModes.includes('condition') && (
              <button
                onClick={() => setActiveTab('condition')}
                className={cn(
                  'flex-1 py-2.5 px-4 rounded-lg font-medium transition-all',
                  activeTab === 'condition'
                    ? 'bg-white dark:bg-gray-600 shadow-md text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                <div className="flex items-center justify-center gap-2">
                  <Activity className="w-4 h-4" />
                  <span className="hidden sm:inline">ตามเงื่อนไข</span>
                </div>
              </button>
            )}
            
            {device.supportsModes.includes('interval') && (
              <button
                onClick={() => setActiveTab('interval')}
                className={cn(
                  'flex-1 py-2.5 px-4 rounded-lg font-medium transition-all',
                  activeTab === 'interval'
                    ? 'bg-white dark:bg-gray-600 shadow-md text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                <div className="flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4" />
                  <span className="hidden sm:inline">รอบเวลา</span>
                </div>
              </button>
            )}
          </div>

          {/* Daily Schedule Tab */}
          {activeTab === 'daily' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                    โหมดตั้งเวลาแบบง่าย
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    ตั้งเวลาเปิด-ปิดแบบง่าย วนซ้ำทุกวัน<br />
                    👉 ไปตั้งค่าที่แท็บ "ตั้งเวลา" ด้านบน
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Condition Tab */}
          {activeTab === 'condition' && device.supportsModes.includes('condition') && (
            <div className="space-y-5">
              {/* Success Message */}
              {showConditionSuccess && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    บันทึกสำเร็จ!
                  </span>
                </div>
              )}

              {/* Error Message */}
              {conditionError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-red-800 dark:text-red-200">{conditionError}</span>
                </div>
              )}

              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">เปิดใช้งานโหมดนี้</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">ควบคุมตามค่าเซ็นเซอร์แบบ Real-time</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={conditionEnabled}
                    onChange={(e) => setConditionEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                </label>
              </div>

              {/* Configuration */}
              <div className="space-y-4">
                {/* Sensor Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    เลือกเซ็นเซอร์
                  </label>
                  <select
                    value={selectedSensor}
                    onChange={(e) => setSelectedSensor(e.target.value)}
                    disabled={!conditionEnabled}
                    className={cn(
                      'w-full px-4 py-2.5 bg-white dark:bg-gray-700 border rounded-xl',
                      'focus:ring-2 focus:ring-primary/50 focus:border-transparent',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'border-gray-300 dark:border-gray-600'
                    )}
                  >
                    {sensorOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} ({option.unit})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Condition & Threshold */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      เงื่อนไข
                    </label>
                    <select
                      value={selectedCondition}
                      onChange={(e) => setSelectedCondition(e.target.value)}
                      disabled={!conditionEnabled}
                      className={cn(
                        'w-full px-4 py-2.5 bg-white dark:bg-gray-700 border rounded-xl',
                        'focus:ring-2 focus:ring-primary/50 focus:border-transparent',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'border-gray-300 dark:border-gray-600'
                      )}
                    >
                      {conditionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      ค่า {selectedSensorInfo && `(${selectedSensorInfo.unit})`}
                    </label>
                    <input
                      type="number"
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                      disabled={!conditionEnabled}
                      step="0.1"
                      className={cn(
                        'w-full px-4 py-2.5 bg-white dark:bg-gray-700 border rounded-xl',
                        'focus:ring-2 focus:ring-primary/50 focus:border-transparent',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'border-gray-300 dark:border-gray-600'
                      )}
                    />
                  </div>
                </div>

                {/* Action */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    เมื่อเงื่อนไขเป็นจริง
                  </label>
                  {device.id === 'motor' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setAction(1)}
                        disabled={!conditionEnabled}
                        className={cn(
                          'py-3 px-4 rounded-xl font-medium transition-all',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          action === 1
                            ? 'bg-green-500 text-white shadow-lg'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        )}
                      >
                        เดินหน้า
                      </button>
                      <button
                        onClick={() => setAction(2)}
                        disabled={!conditionEnabled}
                        className={cn(
                          'py-3 px-4 rounded-xl font-medium transition-all',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          action === 2
                            ? 'bg-orange-500 text-white shadow-lg'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        )}
                      >
                        ย้อนกลับ
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setAction(1)}
                        disabled={!conditionEnabled}
                        className={cn(
                          'py-3 px-4 rounded-xl font-medium transition-all',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          action === 1
                            ? 'bg-green-500 text-white shadow-lg'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        )}
                      >
                        เปิด
                      </button>
                      <button
                        onClick={() => setAction(0)}
                        disabled={!conditionEnabled}
                        className={cn(
                          'py-3 px-4 rounded-xl font-medium transition-all',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          action === 0
                            ? 'bg-red-500 text-white shadow-lg'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        )}
                      >
                        ปิด
                      </button>
                    </div>
                  )}
                </div>

                {/* Preview */}
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    ตัวอย่างการทำงาน:
                  </p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 pl-6">
                    <span className="font-semibold">IF</span> {selectedSensorInfo?.label}{' '}
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {conditionOptions.find(c => c.value === selectedCondition)?.label}
                    </span>{' '}
                    <span className="font-bold text-purple-600 dark:text-purple-400">
                      {threshold} {selectedSensorInfo?.unit}
                    </span>{' '}
                    <span className="font-semibold">→</span>{' '}
                    <span className={cn(
                      'font-bold',
                      action === 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                    )}>
                      {actionLabel} {device.name}
                    </span>
                  </p>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleConditionSave}
                  disabled={conditionRpc.isPending || !conditionEnabled}
                  className={cn(
                    'w-full py-3 px-4 rounded-xl font-medium transition-all',
                    'bg-gradient-to-r from-green-500 to-emerald-600',
                    'text-white shadow-lg',
                    'hover:from-green-600 hover:to-emerald-700',
                    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-green-500 disabled:hover:to-emerald-600'
                  )}
                >
                  {conditionRpc.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      กำลังบันทึก...
                    </span>
                  ) : (
                    'บันทึกการตั้งค่า'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Interval Tab */}
          {activeTab === 'interval' && device.supportsModes.includes('interval') && (
            <div className="space-y-5">
              {/* Success Message */}
              {showIntervalSuccess && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    บันทึกสำเร็จ!
                  </span>
                </div>
              )}

              {/* Error Message */}
              {intervalError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-red-800 dark:text-red-200">{intervalError}</span>
                </div>
              )}

              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">เปิดใช้งานโหมดนี้</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {device.special === 'sequential' ? 'ระบบหมุนเวียน 4 โซน' : 'ทำงานเป็นรอบๆ'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={intervalEnabled}
                    onChange={(e) => setIntervalEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Configuration */}
              <div className="space-y-4">
                {/* Time Window */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ช่วงเวลาทำงาน
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">เริ่ม</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        disabled={!intervalEnabled}
                        className={cn(
                          'w-full px-4 py-2.5 bg-white dark:bg-gray-700 border rounded-xl',
                          'focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          'border-gray-300 dark:border-gray-600'
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">สิ้นสุด</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        disabled={!intervalEnabled}
                        className={cn(
                          'w-full px-4 py-2.5 bg-white dark:bg-gray-700 border rounded-xl',
                          'focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          'border-gray-300 dark:border-gray-600'
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Timing */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {device.special === 'sequential' ? 'เวลาต่อโซน (นาที)' : 'เวลาเปิด (นาที)'}
                    </label>
                    <input
                      type="number"
                      value={onMinutes}
                      onChange={(e) => setOnMinutes(e.target.value)}
                      disabled={!intervalEnabled}
                      min="1"
                      max="1440"
                      className={cn(
                        'w-full px-4 py-2.5 bg-white dark:bg-gray-700 border rounded-xl',
                        'focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'border-gray-300 dark:border-gray-600'
                      )}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {device.special === 'sequential' ? 'รอระหว่างรอบ (นาที)' : 'เวลาปิด (นาที)'}
                    </label>
                    <input
                      type="number"
                      value={offMinutes}
                      onChange={(e) => setOffMinutes(e.target.value)}
                      disabled={!intervalEnabled}
                      min="0"
                      max="1440"
                      className={cn(
                        'w-full px-4 py-2.5 bg-white dark:bg-gray-700 border rounded-xl',
                        'focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'border-gray-300 dark:border-gray-600'
                      )}
                    />
                  </div>
                </div>

                {/* Max Cycles */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    จำนวนรอบสูงสุด
                  </label>
                  <input
                    type="number"
                    value={maxCycles}
                    onChange={(e) => setMaxCycles(e.target.value)}
                    disabled={!intervalEnabled}
                    min="1"
                    max="10"
                    className={cn(
                      'w-full px-4 py-2.5 bg-white dark:bg-gray-700 border rounded-xl',
                      'focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'border-gray-300 dark:border-gray-600'
                    )}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ระบุได้ 1-10 รอบ</p>
                </div>

                {/* Stats & Preview */}
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    สรุปรอบการทำงาน:
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400">รอบเวลา</p>
                      <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                        {totalCycleTime} นาที
                      </p>
                    </div>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400">รอบต่อชั่วโมง</p>
                      <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                        {cyclesPerHour} รอบ
                      </p>
                    </div>
                  </div>

                  {/* Timeline Visual */}
                  {totalCycleTime > 0 && (
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">แผนภาพ:</p>
                      <div className="flex h-8 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                        <div 
                          className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                          style={{ width: `${onPercentage}%` }}
                        >
                          {onPercentage > 15 && `เปิด ${onMinutes}'`}
                        </div>
                        <div 
                          className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                          style={{ width: `${100 - onPercentage}%` }}
                        >
                          {(100 - onPercentage) > 15 && `ปิด ${offMinutes}'`}
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-700 dark:text-gray-300 mt-3">
                    ช่วง <strong>{startTime}-{endTime}</strong> → 
                    วนซ้ำ <strong>{maxCycles}</strong> รอบ
                  </p>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleIntervalSave}
                  disabled={intervalRpc.isPending || !intervalEnabled}
                  className={cn(
                    'w-full py-3 px-4 rounded-xl font-medium transition-all',
                    'bg-gradient-to-r from-purple-500 to-pink-600',
                    'text-white shadow-lg',
                    'hover:from-purple-600 hover:to-pink-700',
                    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-purple-500 disabled:hover:to-pink-600'
                  )}
                >
                  {intervalRpc.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      กำลังบันทึก...
                    </span>
                  ) : (
                    'บันทึกการตั้งค่า'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}