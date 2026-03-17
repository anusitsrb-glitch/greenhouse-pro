import { Card } from '@/components/ui';
import { ToggleLeft, ToggleRight, Bot, Fan, Droplets, Lightbulb, Cog } from 'lucide-react';
import { cn, normalizeBoolean } from '@/lib/utils';
import { RPC_METHODS } from '@/config/dataKeys';
import { useT } from '@/i18n';

interface AutoModeCardProps {
  data: Record<string, unknown>;
  isLoading: boolean;
  isReady: boolean;
  disabled: boolean;
  onToggle: (method: string, value: boolean) => void;
  isPending: (method: string) => boolean;
}

export function AutoModeCard({ data, isLoading, isReady, disabled, onToggle, isPending }: AutoModeCardProps) {
  const { t } = useT();

  const AUTO_MODES = [
    { key: 'fan_1_auto',         name: t('autoMode.fan1'),   icon: Fan,      method: RPC_METHODS.AUTO.SET_FAN_1_AUTO },
    { key: 'fan_2_auto',         name: t('autoMode.fan2'),   icon: Fan,      method: RPC_METHODS.AUTO.SET_FAN_2_AUTO },
    { key: 'valve_1_auto',       name: t('autoMode.valve1'), icon: Droplets, method: RPC_METHODS.AUTO.SET_VALVE_1_AUTO },
    { key: 'valve_2_auto',       name: t('autoMode.valve2'), icon: Droplets, method: RPC_METHODS.AUTO.SET_VALVE_2_AUTO },
    { key: 'valve_3_auto',       name: t('autoMode.valve3'), icon: Droplets, method: RPC_METHODS.AUTO.SET_VALVE_3_AUTO },
    { key: 'valve_4_auto',       name: t('autoMode.valve4'), icon: Droplets, method: RPC_METHODS.AUTO.SET_VALVE_4_AUTO },
    { key: 'light_1_auto',       name: t('autoMode.light1'), icon: Lightbulb,method: RPC_METHODS.AUTO.SET_LIGHT_1_AUTO },
    { key: 'global_motor_auto',  name: t('autoMode.motor'),  icon: Cog,      method: RPC_METHODS.AUTO.SET_GLOBAL_MOTOR_AUTO },
  ];

  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
            <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('autoMode.title')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('autoMode.subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
          {AUTO_MODES.map((mode) => {
            const Icon = mode.icon;
            const isOn = isReady && !isLoading && normalizeBoolean(data[mode.key]);
            const pending = isPending(mode.method);

            return (
              <button
                key={mode.key}
                onClick={() => onToggle(mode.method, !isOn)}
                disabled={disabled || pending}
                className={cn(
                  'p-4 rounded-xl border-2 transition-all',
                  'flex flex-col items-center gap-2',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  isOn
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500',
                  pending && 'animate-pulse'
                )}
              >
                <Icon className={cn('w-6 h-6', isOn ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500')} />
                <span className={cn('text-sm font-medium', isOn ? 'text-purple-700 dark:text-purple-300' : 'text-gray-600 dark:text-gray-400')}>
                  {mode.name}
                </span>
                <div className={cn('flex items-center gap-1 text-xs', isOn ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500')}>
                  {isOn ? (
                    <><ToggleRight className="w-5 h-5" /><span>{t('autoMode.on')}</span></>
                  ) : (
                    <><ToggleLeft className="w-5 h-5" /><span>{t('autoMode.off')}</span></>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
          {t('autoMode.infoText')}
        </p>
      </div>
    </Card>
  );
}