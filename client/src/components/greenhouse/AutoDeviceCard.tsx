import React, { useEffect, useMemo, useRef, useState, ComponentType } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Activity,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { useThingsBoardRPC } from '@/hooks/useThingsBoardRPC';
import { normalizeBoolean } from '@/lib/utils';
import { useT } from '@/i18n';

interface DeviceConfig {
  id: string;
  name: string;
  icon: ComponentType<any>;
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
  const { t } = useT();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'daily' | 'condition' | 'interval'>(() => {
    if (device.supportsModes.includes('daily')) return 'daily';
    if (device.supportsModes.includes('condition')) return 'condition';
    return 'interval';
  });

  const conditionRpc = useThingsBoardRPC(deviceId, device.conditionMethod || '');
  const intervalRpc = useThingsBoardRPC(deviceId, device.intervalMethod || '');

  const [conditionEnabled, setConditionEnabled] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState('air_temp');
  const [selectedCondition, setSelectedCondition] = useState('>');
  const [threshold, setThreshold] = useState('35');
  const [action, setAction] = useState<number>(1);

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

  const modeKey = useMemo(() => `${attrPrefix}_mode`, [attrPrefix]);

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
    if (modeValue === undefined) return t('autoDevice.unknown');
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
    if (modeValue === 3) return 'Cycle Timer';
    if (modeValue === 2) return 'Smart Rules';
    if (modeValue === 1) return 'Daily';
    return 'OFF';
  }, [device.id, modeValue, t]);

  const prevModeRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (modeValue === undefined) return;
    if (prevModeRef.current !== modeValue) {
      prevModeRef.current = modeValue;
      setActiveTab(derivedActiveTab);
    }
  }, [modeValue, derivedActiveTab]);

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
    const condEnKey = `${attrPrefix}_cond_en`;
    if (condEnKey in attributes) {
      setConditionEnabled(readBool(condEnKey));
      setSelectedSensor(readStr(`${attrPrefix}_cond_sensor`, 'air_temp'));
      setSelectedCondition(readStr(`${attrPrefix}_cond_op`, '>'));
      setThreshold(String(readNum(`${attrPrefix}_cond_th`, 35)));
      setAction(readNum(`${attrPrefix}_cond_act`, 1));
    }
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
    try {
      await conditionRpc.sendCommand({
        enabled: conditionEnabled,
        sensorKey: selectedSensor,
        condition: selectedCondition,
        threshold: parseFloat(threshold),
        action,
      });
      onRefresh?.();
    } catch (error) {
      console.error('Failed to save condition config:', error);
    }
  };

  const handleIntervalSave = async () => {
    if (!device.intervalMethod) return;
    try {
      await intervalRpc.sendCommand({
        enabled: intervalEnabled,
        startTime,
        endTime,
        onMinutes: parseInt(onMinutes, 10),
        offMinutes: parseInt(offMinutes, 10),
        maxCycles: parseInt(maxCycles, 10),
      });
      onRefresh?.();
    } catch (error) {
      console.error('Failed to save interval config:', error);
    }
  };

  const selectedSensorInfo = sensorOptions.find((s) => s.value === selectedSensor);

  const actionLabel = useMemo(() => {
    if (device.id === 'motor') {
      return action === 2 ? t('autoDevice.actionReverse') : t('autoDevice.actionForward');
    }
    return action === 1 ? t('autoDevice.actionOn') : t('autoDevice.actionOff');
  }, [action, device.id, t]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                {device.special === 'sequential' && t('autoDevice.sequential')}
                {device.special === 'allZones' && t('autoDevice.allZones')}
                {!device.special && t('autoDevice.autoControl')}
              </p>
            </div>
          </div>
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {t('autoDevice.currentMode')}: <span className="font-semibold">{modeLabel}</span>
            </div>
          </div>

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
                  <span>{t('autoDevice.tabSchedule')}</span>
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
                  <span>{t('autoDevice.tabCondition')}</span>
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
                  <span>{t('autoDevice.tabCycle')}</span>
                </div>
              </button>
            )}
          </div>

          {activeTab === 'daily' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Daily Schedule</p>
                  <p>{t('autoDevice.dailyInfo')}</p>
                  <p className="mt-1 opacity-90">{t('autoDevice.dailyGoTo')}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'condition' && device.supportsModes.includes('condition') && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{t('autoDevice.enable')}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('autoDevice.conditionDesc')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={conditionEnabled} onChange={(e) => setConditionEnabled(e.target.checked)} className="sr-only peer" />
                  <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-green-600" />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('autoDevice.selectSensor')}</label>
                <select value={selectedSensor} onChange={(e) => setSelectedSensor(e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  {sensorOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label} ({option.unit})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('autoDevice.condition')}</label>
                  <select value={selectedCondition} onChange={(e) => setSelectedCondition(e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    {conditionOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('autoDevice.targetValue')} {selectedSensorInfo && `(${selectedSensorInfo.unit})`}
                  </label>
                  <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} step="0.1" className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('autoDevice.whenTrue')}</label>
                {device.id === 'motor' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setAction(1)} className={`py-3 px-4 rounded-xl font-medium transition-all ${action === 1 ? 'bg-green-500 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>{t('autoDevice.actionForward')}</button>
                    <button onClick={() => setAction(2)} className={`py-3 px-4 rounded-xl font-medium transition-all ${action === 2 ? 'bg-orange-500 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>{t('autoDevice.actionReverse')}</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setAction(1)} className={`py-3 px-4 rounded-xl font-medium transition-all ${action === 1 ? 'bg-green-500 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>{t('autoDevice.actionOn')}</button>
                    <button onClick={() => setAction(0)} className={`py-3 px-4 rounded-xl font-medium transition-all ${action === 0 ? 'bg-red-500 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>{t('autoDevice.actionOff')}</button>
                  </div>
                )}
              </div>

              <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('autoDevice.exampleTitle')}:</p>
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  <span className="font-semibold">IF</span> {selectedSensorInfo?.label}{' '}
                  <span className="font-bold text-blue-600 dark:text-blue-400">{conditionOptions.find((c) => c.value === selectedCondition)?.label}</span>{' '}
                  <span className="font-bold text-purple-600 dark:text-purple-400">{threshold} {selectedSensorInfo?.unit}</span>{' '}
                  <span className="font-semibold">→</span>{' '}
                  <span className={`font-bold ${action === 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {actionLabel} {device.name}
                  </span>
                </p>
              </div>

              <button onClick={handleConditionSave} disabled={conditionRpc.isPending} className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-xl hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all">
                {conditionRpc.isPending ? t('autoDevice.saving') : t('autoDevice.saveBtn')}
              </button>
            </div>
          )}

          {activeTab === 'interval' && device.supportsModes.includes('interval') && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{t('autoDevice.enable')}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {device.special === 'sequential' ? t('autoDevice.sequential') : t('autoDevice.cycleDesc')}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={intervalEnabled} onChange={(e) => setIntervalEnabled(e.target.checked)} className="sr-only peer" />
                  <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600" />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('autoDevice.timeRange')}</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">{t('autoDevice.start')}</label>
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">{t('autoDevice.end')}</label>
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {device.special === 'sequential' ? t('autoDevice.onTimePerZone') : t('autoDevice.onTime')}
                  </label>
                  <input type="number" value={onMinutes} onChange={(e) => setOnMinutes(e.target.value)} min="1" max="1440" className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {device.special === 'sequential' ? t('autoDevice.waitBetween') : t('autoDevice.offTime')}
                  </label>
                  <input type="number" value={offMinutes} onChange={(e) => setOffMinutes(e.target.value)} min="0" max="1440" className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('autoDevice.maxCycles')}</label>
                <input type="number" value={maxCycles} onChange={(e) => setMaxCycles(e.target.value)} min="1" max="10" className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('autoDevice.maxCyclesHint')}</p>
              </div>

              {device.special === 'sequential' ? (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('autoDevice.exampleCycle1')}</p>
                  <div className="space-y-1 text-sm text-gray-800 dark:text-gray-200">
                    <p>• {startTime} → {t('autoDevice.zone1')} ({onMinutes} min)</p>
                    <p>• → {t('autoDevice.zone2')} ({onMinutes} min)</p>
                    <p>• → {t('autoDevice.zone3')} ({onMinutes} min)</p>
                    <p>• → {t('autoDevice.zone4')} ({onMinutes} min)</p>
                    <p className="font-medium text-purple-600 dark:text-purple-400">
                      • {t('autoDevice.cycleWait').replace('{off}', offMinutes).replace('{max}', maxCycles)}
                    </p>
                  </div>
                  <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">{t('autoDevice.cycleWarning')}</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('autoDevice.exampleTitle')}:</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    {t('autoDevice.cycleExample')
                      .replace('{start}', startTime)
                      .replace('{end}', endTime)
                      .replace('{on}', onMinutes)
                      .replace('{off}', offMinutes)
                      .replace('{max}', maxCycles)}
                  </p>
                </div>
              )}

              <button onClick={handleIntervalSave} disabled={intervalRpc.isPending} className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-xl hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all">
                {intervalRpc.isPending ? t('autoDevice.saving') : t('autoDevice.saveBtn')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}