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
import { useT } from '@/i18n';

interface TimersTabProps {
  project: string;
  gh: string;
  isReady: boolean;
  isOnline: boolean;
  userRole: string;
}

interface TimerConfig {
  key: string;
  nameKey: string;
  icon: typeof Fan;
  onKey: string;
  offKey: string;
  onMethod: string;
  offMethod: string;
}

const TIMER_CONFIGS: TimerConfig[] = [
  {
    key: 'fan_1',
    nameKey: 'timers.fan1',
    icon: Fan,
    onKey: ATTRIBUTE_KEYS.TIMER.FAN_1_ON,
    offKey: ATTRIBUTE_KEYS.TIMER.FAN_1_OFF,
    onMethod: RPC_METHODS.TIMER.SET_FAN_1_ON_TIME,
    offMethod: RPC_METHODS.TIMER.SET_FAN_1_OFF_TIME,
  },
  {
    key: 'fan_2',
    nameKey: 'timers.fan2',
    icon: Fan,
    onKey: ATTRIBUTE_KEYS.TIMER.FAN_2_ON,
    offKey: ATTRIBUTE_KEYS.TIMER.FAN_2_OFF,
    onMethod: RPC_METHODS.TIMER.SET_FAN_2_ON_TIME,
    offMethod: RPC_METHODS.TIMER.SET_FAN_2_OFF_TIME,
  },
  {
    key: 'valve_1',
    nameKey: 'timers.valve1',
    icon: Droplets,
    onKey: ATTRIBUTE_KEYS.TIMER.VALVE_1_ON,
    offKey: ATTRIBUTE_KEYS.TIMER.VALVE_1_OFF,
    onMethod: RPC_METHODS.TIMER.SET_VALVE_1_ON_TIME,
    offMethod: RPC_METHODS.TIMER.SET_VALVE_1_OFF_TIME,
  },
  {
    key: 'valve_2',
    nameKey: 'timers.valve2',
    icon: Droplets,
    onKey: ATTRIBUTE_KEYS.TIMER.VALVE_2_ON,
    offKey: ATTRIBUTE_KEYS.TIMER.VALVE_2_OFF,
    onMethod: RPC_METHODS.TIMER.SET_VALVE_2_ON_TIME,
    offMethod: RPC_METHODS.TIMER.SET_VALVE_2_OFF_TIME,
  },
  {
    key: 'valve_3',
    nameKey: 'timers.valve3',
    icon: Droplets,
    onKey: ATTRIBUTE_KEYS.TIMER.VALVE_3_ON,
    offKey: ATTRIBUTE_KEYS.TIMER.VALVE_3_OFF,
    onMethod: RPC_METHODS.TIMER.SET_VALVE_3_ON_TIME,
    offMethod: RPC_METHODS.TIMER.SET_VALVE_3_OFF_TIME,
  },
  {
    key: 'valve_4',
    nameKey: 'timers.valve4',
    icon: Droplets,
    onKey: ATTRIBUTE_KEYS.TIMER.VALVE_4_ON,
    offKey: ATTRIBUTE_KEYS.TIMER.VALVE_4_OFF,
    onMethod: RPC_METHODS.TIMER.SET_VALVE_4_ON_TIME,
    offMethod: RPC_METHODS.TIMER.SET_VALVE_4_OFF_TIME,
  },
  {
    key: 'light_1',
    nameKey: 'timers.light1',
    icon: Lightbulb,
    onKey: ATTRIBUTE_KEYS.TIMER.LIGHT_1_ON,
    offKey: ATTRIBUTE_KEYS.TIMER.LIGHT_1_OFF,
    onMethod: RPC_METHODS.TIMER.SET_LIGHT_1_ON_TIME,
    offMethod: RPC_METHODS.TIMER.SET_LIGHT_1_OFF_TIME,
  },
];

const MOTOR_TIMER_CONFIG = {
  key: 'motor',
  nameKey: 'timers.motor',
  icon: Cog,
  fwKey: ATTRIBUTE_KEYS.TIMER.GLOBAL_FW_TIME,
  reKey: ATTRIBUTE_KEYS.TIMER.GLOBAL_RE_TIME,
  fwMethod: RPC_METHODS.TIMER.SET_GLOBAL_FW_TIME,
  reMethod: RPC_METHODS.TIMER.SET_GLOBAL_RE_TIME,
};

export function TimersTab({ project, gh, isReady, isOnline, userRole }: TimersTabProps) {
  const { t } = useT();
  const { addToast } = useToast();

  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState<Record<string, boolean>>({});

  const { data, isLoading, refetch, lastUpdated } = useAttributes({
    project,
    gh,
    keys: TIMER_ATTRIBUTE_KEYS,
    enabled: isReady,
    pollInterval: 10000,
  });

  const rpc = useRpc({
    project,
    gh,
    onSuccess: (method) => {
      addToast({ type: 'success', message: t('timers.saveSuccess') });
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

  useEffect(() => {
    if (!isLoading && data) {
      const newValues: Record<string, string> = {};
      for (const key of TIMER_ATTRIBUTE_KEYS) {
        const value = data[key];
        newValues[key] = typeof value === 'string' ? value : value ? String(value) : '';
      }
      setEditValues(prev => {
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

  const canControl = userRole === 'superadmin' || userRole === 'admin' || userRole === 'operator';
  const controlsDisabled = !isReady || !isOnline || !canControl;

  const handleTimeChange = (key: string, value: string) => {
    setEditValues(prev => ({ ...prev, [key]: value }));
    setIsDirty(prev => ({ ...prev, [key]: true }));
  };

  const handleSave = async (method: string, key: string) => {
    const value = editValues[key];
    if (!value || !isValidTimeFormat(value)) {
      addToast({ type: 'error', message: t('timers.invalidFormat') });
      return;
    }
    await rpc.sendCommand(method, value, value);
  };

  return (
    <div className="space-y-6">
      {/* Warning */}
      {!canControl && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            {t('timers.noPermission')}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Clock className="w-4 h-4" />
          <span>{t('dashboard.lastUpdate')}: {lastUpdated ? formatDateTime(new Date(lastUpdated)) : '--'}</span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          {t('timers.infoNote')}
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
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t(config.nameKey)}</h3>
                </div>

                <div className="space-y-3">
                  {/* On time */}
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">{t('timers.onTime')}</label>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={onValue}
                        onChange={(e) => handleTimeChange(config.onKey, e.target.value)}
                        disabled={controlsDisabled}
                        className={cn(
                          'flex-1 px-3 py-2 border rounded-lg text-sm',
                          'dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100',
                          'focus:outline-none focus:ring-2 focus:ring-primary/50',
                          'disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed',
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
                    <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">{t('timers.offTime')}</label>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={offValue}
                        onChange={(e) => handleTimeChange(config.offKey, e.target.value)}
                        disabled={controlsDisabled}
                        className={cn(
                          'flex-1 px-3 py-2 border rounded-lg text-sm',
                          'dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100',
                          'focus:outline-none focus:ring-2 focus:ring-primary/50',
                          'disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed',
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
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Cog className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t(MOTOR_TIMER_CONFIG.nameKey)}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('timers.motorDesc')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Forward time */}
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">{t('timers.forwardTime')}</label>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={editValues[MOTOR_TIMER_CONFIG.fwKey] || ''}
                  onChange={(e) => handleTimeChange(MOTOR_TIMER_CONFIG.fwKey, e.target.value)}
                  disabled={controlsDisabled}
                  className={cn(
                    'flex-1 px-3 py-2 border rounded-lg text-sm',
                    'dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50',
                    'disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed',
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
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">{t('timers.reverseTime')}</label>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={editValues[MOTOR_TIMER_CONFIG.reKey] || ''}
                  onChange={(e) => handleTimeChange(MOTOR_TIMER_CONFIG.reKey, e.target.value)}
                  disabled={controlsDisabled}
                  className={cn(
                    'flex-1 px-3 py-2 border rounded-lg text-sm',
                    'dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50',
                    'disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed',
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