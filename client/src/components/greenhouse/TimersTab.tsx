import { useState, useEffect } from 'react';
import { Card, Button } from '@/components/ui';
import { useAttributes } from '@/hooks/useAttributes';
import { useRpc } from '@/hooks/useRpc';
import { useToast } from '@/hooks/useToast';
import { 
  TIMER_ATTRIBUTE_KEYS,
  RPC_METHODS,
  ATTRIBUTE_KEYS,
} from '@/config/dataKeys';
import { Clock, Save, RefreshCw, AlertTriangle, Fan, Droplets, Waves, Lightbulb, Cog } from 'lucide-react';
import { cn, formatDateTime, isValidTimeFormat } from '@/lib/utils';

interface TimersTabProps {
  project: string;
  gh: string;
  isReady: boolean;
  isOnline: boolean;
  userRole: string;
}

interface TimerConfig {
  key: string;
  name: string;
  icon: typeof Fan;
  onKey: string;
  offKey: string;
  onMethod: string;
  offMethod: string;
}

const TIMER_CONFIGS: TimerConfig[] = [
  {
    key: 'fan_1',
    name: 'พัดลม 1',
    icon: Fan,
    onKey: ATTRIBUTE_KEYS.TIMER.FAN_1_ON,
    offKey: ATTRIBUTE_KEYS.TIMER.FAN_1_OFF,
    onMethod: RPC_METHODS.TIMER.SET_FAN_1_ON_TIME,
    offMethod: RPC_METHODS.TIMER.SET_FAN_1_OFF_TIME,
  },
  {
    key: 'fan_2',
    name: 'พัดลม 2',
    icon: Fan,
    onKey: ATTRIBUTE_KEYS.TIMER.FAN_2_ON,
    offKey: ATTRIBUTE_KEYS.TIMER.FAN_2_OFF,
    onMethod: RPC_METHODS.TIMER.SET_FAN_2_ON_TIME,
    offMethod: RPC_METHODS.TIMER.SET_FAN_2_OFF_TIME,
  },
  {
    key: 'valve_2',
    name: 'วาล์ว 2',
    icon: Droplets,
    onKey: ATTRIBUTE_KEYS.TIMER.VALVE_2_ON,
    offKey: ATTRIBUTE_KEYS.TIMER.VALVE_2_OFF,
    onMethod: RPC_METHODS.TIMER.SET_VALVE_2_ON_TIME,
    offMethod: RPC_METHODS.TIMER.SET_VALVE_2_OFF_TIME,
  },
  {
    key: 'pump_1',
    name: 'ปั๊ม 1',
    icon: Waves,
    onKey: ATTRIBUTE_KEYS.TIMER.PUMP_1_ON,
    offKey: ATTRIBUTE_KEYS.TIMER.PUMP_1_OFF,
    onMethod: RPC_METHODS.TIMER.SET_PUMP_1_ON_TIME,
    offMethod: RPC_METHODS.TIMER.SET_PUMP_1_OFF_TIME,
  },
  {
    key: 'light_1',
    name: 'ไฟ 1',
    icon: Lightbulb,
    onKey: ATTRIBUTE_KEYS.TIMER.LIGHT_1_ON,
    offKey: ATTRIBUTE_KEYS.TIMER.LIGHT_1_OFF,
    onMethod: RPC_METHODS.TIMER.SET_LIGHT_1_ON_TIME,
    offMethod: RPC_METHODS.TIMER.SET_LIGHT_1_OFF_TIME,
  },
];

const MOTOR_TIMER_CONFIG = {
  key: 'motor',
  name: 'มอเตอร์ (รวม)',
  icon: Cog,
  fwKey: ATTRIBUTE_KEYS.TIMER.GLOBAL_FW_TIME,
  reKey: ATTRIBUTE_KEYS.TIMER.GLOBAL_RE_TIME,
  fwMethod: RPC_METHODS.TIMER.SET_GLOBAL_FW_TIME,
  reMethod: RPC_METHODS.TIMER.SET_GLOBAL_RE_TIME,
};

export function TimersTab({ project, gh, isReady, isOnline, userRole }: TimersTabProps) {
  const { addToast } = useToast();
  
  // Local state for editing
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState<Record<string, boolean>>({});

  // Fetch current timer values
  const { data, isLoading, refetch, lastUpdated } = useAttributes({
    project,
    gh,
    keys: TIMER_ATTRIBUTE_KEYS,
    enabled: isReady,
    pollInterval: 10000, // 10 seconds
  });

  // RPC hook
  const rpc = useRpc({
    project,
    gh,
    onSuccess: (method) => {
      addToast({ type: 'success', message: 'บันทึกเวลาสำเร็จ' });
      // Clear dirty state for this timer
      const key = Object.entries(editValues).find(([k, v]) => {
        const config = TIMER_CONFIGS.find(c => c.onMethod === method || c.offMethod === method);
        return config && (k === config.onKey || k === config.offKey);
      })?.[0];
      if (key) {
        setIsDirty(prev => ({ ...prev, [key]: false }));
      }
      refetch();
    },
    onError: (method, error) => {
      addToast({ type: 'error', message: error });
    },
  });

  // Initialize edit values from fetched data
  useEffect(() => {
    if (!isLoading && data) {
      const newValues: Record<string, string> = {};
      for (const key of TIMER_ATTRIBUTE_KEYS) {
        const value = data[key];
        newValues[key] = typeof value === 'string' ? value : value ? String(value) : '';
      }
      setEditValues(prev => {
        // Only update values that aren't dirty
        const updated = { ...newValues };
        for (const key of Object.keys(isDirty)) {
          if (isDirty[key] && prev[key]) {
            updated[key] = prev[key];
          }
        }
        return updated;
      });
    }
  }, [data, isLoading]);

  const canControl = userRole === 'admin' || userRole === 'operator';
  const controlsDisabled = !isReady || !isOnline || !canControl;

  const handleTimeChange = (key: string, value: string) => {
    setEditValues(prev => ({ ...prev, [key]: value }));
    setIsDirty(prev => ({ ...prev, [key]: true }));
  };

  const handleSave = async (method: string, key: string) => {
    const value = editValues[key];
    if (!value || !isValidTimeFormat(value)) {
      addToast({ type: 'error', message: 'รูปแบบเวลาไม่ถูกต้อง (HH:mm)' });
      return;
    }
    await rpc.sendCommand(method, value, value);
  };

  return (
    <div className="space-y-6">
      {/* Warning if controls disabled */}
      {!canControl && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-800">
            คุณไม่มีสิทธิ์ตั้งเวลา (ต้องเป็น operator หรือ admin)
          </p>
        </div>
      )}

      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>
            อัปเดตล่าสุด: {lastUpdated ? formatDateTime(new Date(lastUpdated)) : '--'}
          </span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          รีเฟรช
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          ⏰ ตั้งเวลาเปิด-ปิดอุปกรณ์อัตโนมัติ (ต้องเปิดโหมด Auto ในแท็บควบคุมด้วย)
        </p>
      </div>

      {/* Relay Timers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TIMER_CONFIGS.map((config) => {
          const Icon = config.icon;
          const onValue = editValues[config.onKey] || '';
          const offValue = editValues[config.offKey] || '';
          const isOnDirty = isDirty[config.onKey];
          const isOffDirty = isDirty[config.offKey];

          return (
            <Card key={config.key}>
              <div className="p-4">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{config.name}</h3>
                </div>

                {/* Time inputs */}
                <div className="space-y-3">
                  {/* On time */}
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">เวลาเปิด</label>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={onValue}
                        onChange={(e) => handleTimeChange(config.onKey, e.target.value)}
                        disabled={controlsDisabled}
                        className={cn(
                          'flex-1 px-3 py-2 border rounded-lg text-sm',
                          'focus:outline-none focus:ring-2 focus:ring-primary/50',
                          'disabled:bg-gray-100 disabled:cursor-not-allowed',
                          isOnDirty && 'border-primary'
                        )}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSave(config.onMethod, config.onKey)}
                        disabled={controlsDisabled || !isOnDirty || rpc.isPending(config.onMethod)}
                        className="px-3"
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Off time */}
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">เวลาปิด</label>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={offValue}
                        onChange={(e) => handleTimeChange(config.offKey, e.target.value)}
                        disabled={controlsDisabled}
                        className={cn(
                          'flex-1 px-3 py-2 border rounded-lg text-sm',
                          'focus:outline-none focus:ring-2 focus:ring-primary/50',
                          'disabled:bg-gray-100 disabled:cursor-not-allowed',
                          isOffDirty && 'border-primary'
                        )}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSave(config.offMethod, config.offKey)}
                        disabled={controlsDisabled || !isOffDirty || rpc.isPending(config.offMethod)}
                        className="px-3"
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Motor Timer */}
      <Card>
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <Cog className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{MOTOR_TIMER_CONFIG.name}</h3>
              <p className="text-sm text-gray-500">ตั้งเวลาเคลื่อนที่ (Forward/Reverse)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Forward time */}
            <div>
              <label className="text-sm text-gray-600 mb-1 block">เวลา Forward (ลง)</label>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={editValues[MOTOR_TIMER_CONFIG.fwKey] || ''}
                  onChange={(e) => handleTimeChange(MOTOR_TIMER_CONFIG.fwKey, e.target.value)}
                  disabled={controlsDisabled}
                  className={cn(
                    'flex-1 px-3 py-2 border rounded-lg text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50',
                    'disabled:bg-gray-100 disabled:cursor-not-allowed',
                    isDirty[MOTOR_TIMER_CONFIG.fwKey] && 'border-primary'
                  )}
                />
                <Button
                  size="sm"
                  onClick={() => handleSave(MOTOR_TIMER_CONFIG.fwMethod, MOTOR_TIMER_CONFIG.fwKey)}
                  disabled={controlsDisabled || !isDirty[MOTOR_TIMER_CONFIG.fwKey] || rpc.isPending(MOTOR_TIMER_CONFIG.fwMethod)}
                  className="px-3"
                >
                  <Save className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Reverse time */}
            <div>
              <label className="text-sm text-gray-600 mb-1 block">เวลา Reverse (ขึ้น)</label>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={editValues[MOTOR_TIMER_CONFIG.reKey] || ''}
                  onChange={(e) => handleTimeChange(MOTOR_TIMER_CONFIG.reKey, e.target.value)}
                  disabled={controlsDisabled}
                  className={cn(
                    'flex-1 px-3 py-2 border rounded-lg text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50',
                    'disabled:bg-gray-100 disabled:cursor-not-allowed',
                    isDirty[MOTOR_TIMER_CONFIG.reKey] && 'border-primary'
                  )}
                />
                <Button
                  size="sm"
                  onClick={() => handleSave(MOTOR_TIMER_CONFIG.reMethod, MOTOR_TIMER_CONFIG.reKey)}
                  disabled={controlsDisabled || !isDirty[MOTOR_TIMER_CONFIG.reKey] || rpc.isPending(MOTOR_TIMER_CONFIG.reMethod)}
                  className="px-3"
                >
                  <Save className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
