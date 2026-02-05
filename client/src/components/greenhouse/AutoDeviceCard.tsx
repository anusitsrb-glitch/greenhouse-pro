import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LucideIcon, ChevronDown, ChevronUp, Clock, Activity, Zap, AlertCircle } from 'lucide-react';
import { useThingsBoardRPC } from '@/hooks/useThingsBoardRPC';
import { normalizeBoolean } from '@/lib/utils';

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
  /** Latest ThingsBoard shared attributes for the whole device */
  attributes: Record<string, any>;
  /** Optional callback to force refresh attributes after RPC */
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

  // Condition-based state
  const [conditionEnabled, setConditionEnabled] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState('air_temp');
  const [selectedCondition, setSelectedCondition] = useState('>');
  const [threshold, setThreshold] = useState('35');
  // Fans/Lights: 1=ON,0=OFF. Motor: 1=FW,2=RE
  const [action, setAction] = useState<number>(1);

  // Interval Loop state
  const [intervalEnabled, setIntervalEnabled] = useState(false);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('19:00');
  const [onMinutes, setOnMinutes] = useState('10');
  const [offMinutes, setOffMinutes] = useState('60');
  const [maxCycles, setMaxCycles] = useState('5');

  const Icon = device.icon;
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    cyan: 'from-cyan-500 to-cyan-600',
    yellow: 'from-yellow-500 to-yellow-600',
    orange: 'from-orange-500 to-orange-600',
    purple: 'from-purple-500 to-purple-600',
  };

  // -----------------------------
  // Attribute mapping from ESP32
  // -----------------------------

  const attrPrefix = useMemo(() => {
    switch (device.id) {
      case 'fan_1':
        return 'fan1';
      case 'fan_2':
        return 'fan2';
      case 'light_1':
        return 'light1';
      case 'water':
        return 'water';
      case 'motor':
        return 'motor';
      default:
        return device.id;
    }
  }, [device.id]);

  const modeKey = useMemo(() => {
    // ESP32 publishes: fan1_mode, fan2_mode, light1_mode, water_mode, motor_mode
    return `${attrPrefix}_mode`;
  }, [attrPrefix]);

  const modeValue = useMemo(() => {
    const raw = attributes?.[modeKey];
    if (raw === undefined || raw === null) return undefined;
    const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }, [attributes, modeKey]);

  const derivedActiveTab = useMemo<'daily' | 'condition' | 'interval'>(() => {
  if (device.id === 'water') {
    // water_mode: 1=Daily(Valve), 2=Interval(Sequential)
    return modeValue === 2 ? 'interval' : 'daily';
  }
  if (modeValue === 2) return 'Smart Rules';
  if (modeValue === 3) return 'Cycle Timer';
  return 'daily';
  }, [modeValue, device.id]);


  const modeLabel = useMemo(() => {
    if (modeValue === undefined) return 'ไม่ทราบ';
    if (modeValue === 255) return 'Manual/Override';
    if (device.id === 'water') {
      if (modeValue === 2) return 'Cycle Timer (Sequential)';
      if (modeValue === 1) return 'Daily (Valve)';
      return 'OFF';
    }
    if (device.id === 'motor') {
      if (modeValue === 3) return 'Cycle Timer';
      if (modeValue === 2) return 'Smart Rules';
      if (modeValue === 1) return 'Global/Daily';
      return 'OFF';
    }
    // Fan/Light
    if (modeValue === 3) return 'Cycle Timer';
    if (modeValue === 2) return 'Smart Rules';
    if (modeValue === 1) return 'Daily';
    return 'OFF';
  }, [device.id, modeValue]);

  // Keep the selected tab in sync with the current mode (but don't fight the user
  // while they're actively editing).
  const prevModeRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (modeValue === undefined) return;
    if (prevModeRef.current !== modeValue) {
      prevModeRef.current = modeValue;
      setActiveTab(derivedActiveTab);
    }
  }, [modeValue, derivedActiveTab]);

  // Hydrate UI state from attributes (avoid overwriting while user edits)
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

    // Only overwrite state when collapsed, or first time hydrate.
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

  const handleConditionSave = async () => {
    if (!device.conditionMethod) return;
    
    const params = {
      enabled: conditionEnabled,
      sensorKey: selectedSensor,
      condition: selectedCondition,
      threshold: parseFloat(threshold),
      action: action,
    };

    await conditionRpc.sendCommand(params);
    onRefresh?.();
  };

  const handleIntervalSave = async () => {
    if (!device.intervalMethod) return;
    
    const params = {
      enabled: intervalEnabled,
      startTime: startTime,
      endTime: endTime,
      onMinutes: parseInt(onMinutes),
      offMinutes: parseInt(offMinutes),
      maxCycles: parseInt(maxCycles),
    };

    await intervalRpc.sendCommand(params);
    onRefresh?.();
  };

  const selectedSensorInfo = sensorOptions.find(s => s.value === selectedSensor);
  const actionLabel = useMemo(() => {
    if (device.id === 'motor') {
      return action === 2 ? 'ย้อนกลับ' : 'เดินหน้า';
    }
    return action === 1 ? 'เปิด' : 'ปิด';
  }, [action, device.id]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
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
          {/* Current mode */}
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              โหมดปัจจุบัน: <span className="font-semibold">{modeLabel}</span>
            </div>
            {modeValue === 255 && (
              <span className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                Manual/Override
              </span>
            )}
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-2 mb-6 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
            {device.supportsModes.includes('daily') && (
              <button
                onClick={() => setActiveTab('daily')}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${
                  activeTab === 'daily'
                    ? 'bg-white dark:bg-gray-600 shadow-md text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>ตั้งเวลา</span>
                </div>
              </button>
            )}
            
            {device.supportsModes.includes('condition') && (
              <button
                onClick={() => setActiveTab('condition')}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${
                  activeTab === 'condition'
                    ? 'bg-white dark:bg-gray-600 shadow-md text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Activity className="w-4 h-4" />
                  <span>ตามเงื่อนไข</span>
                </div>
              </button>
            )}
            
            {device.supportsModes.includes('interval') && (
              <button
                onClick={() => setActiveTab('interval')}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${
                  activeTab === 'interval'
                    ? 'bg-white dark:bg-gray-600 shadow-md text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4" />
                  <span>รอบเวลา</span>
                </div>
              </button>
            )}
          </div>

          {/* Daily Schedule */}
          {activeTab === 'daily' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  ตั้งเวลาเปิด-ปิดแบบง่าย วนซ้ำทุกวัน (ไปตั้งค่าที่ Tab "ตั้งเวลา")
                </p>
              </div>
            </div>
          )}

          {/* Condition-based */}
          {activeTab === 'condition' && device.supportsModes.includes('condition') && (
            <div className="space-y-5">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">เปิดใช้งาน</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">ควบคุมตามเงื่อนไขเซ็นเซอร์</p>
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

              {/* Sensor Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  เลือกเซ็นเซอร์
                </label>
                <select
                  value={selectedSensor}
                  onChange={(e) => setSelectedSensor(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {sensorOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Condition */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    เงื่อนไข
                  </label>
                  <select
                    value={selectedCondition}
                    onChange={(e) => setSelectedCondition(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    ค่าที่ต้องการ {selectedSensorInfo && `(${selectedSensorInfo.unit})`}
                  </label>
                  <input
                    type="number"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    step="0.1"
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className={`py-3 px-4 rounded-xl font-medium transition-all ${
                        action === 1
                          ? 'bg-green-500 text-white shadow-lg'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      เดินหน้า
                    </button>
                    <button
                      onClick={() => setAction(2)}
                      className={`py-3 px-4 rounded-xl font-medium transition-all ${
                        action === 2
                          ? 'bg-orange-500 text-white shadow-lg'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      ย้อนกลับ
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setAction(1)}
                      className={`py-3 px-4 rounded-xl font-medium transition-all ${
                        action === 1
                          ? 'bg-green-500 text-white shadow-lg'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      เปิด
                    </button>
                    <button
                      onClick={() => setAction(0)}
                      className={`py-3 px-4 rounded-xl font-medium transition-all ${
                        action === 0
                          ? 'bg-red-500 text-white shadow-lg'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      ปิด
                    </button>
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ตัวอย่างการทำงาน:
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  <span className="font-semibold">IF</span> {selectedSensorInfo?.label}{' '}
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {conditionOptions.find(c => c.value === selectedCondition)?.label}
                  </span>{' '}
                  <span className="font-bold text-purple-600 dark:text-purple-400">
                    {threshold} {selectedSensorInfo?.unit}
                  </span>{' '}
                  <span className="font-semibold">→</span>{' '}
                  <span className={`font-bold ${action === 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {actionLabel} {device.name}
                  </span>
                </p>
              </div>

              {/* Save Button */}
              <button
                onClick={handleConditionSave}
                disabled={conditionRpc.isPending}
                className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-xl hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all"
              >
                {conditionRpc.isPending ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
              </button>
            </div>
          )}

          {/* Interval Loop */}
          {activeTab === 'interval' && device.supportsModes.includes('interval') && (
            <div className="space-y-5">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">เปิดใช้งาน</p>
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
                      className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">สิ้นสุด</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                    min="1"
                    max="1440"
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                    min="0"
                    max="1440"
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  min="1"
                  max="10"
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ระบุได้ 1-10 รอบ</p>
              </div>

              {/* Preview */}
              {device.special === 'sequential' ? (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ตัวอย่างการทำงาน (รอบที่ 1):
                  </p>
                  <div className="space-y-1 text-sm text-gray-800 dark:text-gray-200">
                    <p>• {startTime} → เปิดน้ำโซน 1 ({onMinutes} นาที)</p>
                    <p>• จากนั้น → เปิดน้ำโซน 2 ({onMinutes} นาที)</p>
                    <p>• จากนั้น → เปิดน้ำโซน 3 ({onMinutes} นาที)</p>
                    <p>• จากนั้น → เปิดน้ำโซน 4 ({onMinutes} นาที)</p>
                    <p className="font-medium text-purple-600 dark:text-purple-400">
                      • รอ {offMinutes} นาที แล้ววนรอบใหม่ (สูงสุด {maxCycles} รอบ)
                    </p>
                  </div>
                  <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">
                      ⚠️ หากใกล้เวลาสิ้นสุด ระบบจะทำให้ครบ 4 โซนก่อนหยุด
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ตัวอย่างการทำงาน:
                  </p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    ช่วงเวลา <span className="font-bold text-purple-600">{startTime}-{endTime}</span> → 
                    เปิด <span className="font-bold text-green-600">{onMinutes} นาที</span>, 
                    ปิด <span className="font-bold text-red-600">{offMinutes} นาที</span>, 
                    วนซ้ำ <span className="font-bold text-blue-600">{maxCycles} รอบ</span>
                  </p>
                </div>
              )}

              {/* Save Button */}
              <button
                onClick={handleIntervalSave}
                disabled={intervalRpc.isPending}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-xl hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all"
              >
                {intervalRpc.isPending ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
