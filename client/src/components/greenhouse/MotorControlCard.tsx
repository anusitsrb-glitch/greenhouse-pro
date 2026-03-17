import { Card } from '@/components/ui';
import { Sun, Moon, Square, Lock, Cog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MOTOR_COMMANDS } from '@/config/dataKeys';
import { useT } from '@/i18n';

interface MotorControlCardProps {
  name: string;
  isFw: boolean;
  isRe: boolean;
  isAuto: boolean;
  isLoading: boolean;
  isReady: boolean;
  disabled: boolean;
  isPending: boolean;
  optimisticCmd?: number | null;
  onCommand: (cmd: number) => void;
}

export function MotorControlCard({
  name,
  isFw,
  isRe,
  isAuto,
  isLoading,
  isReady,
  disabled,
  optimisticCmd,
  onCommand,
}: MotorControlCardProps) {
  const { t } = useT();

  const realCmd =
    isFw && !isRe ? MOTOR_COMMANDS.FORWARD :
    !isFw && isRe ? MOTOR_COMMANDS.REVERSE :
    MOTOR_COMMANDS.STOP;

  const effectiveCmd = optimisticCmd ?? realCmd;

  const effIsShading    = isReady && !isLoading && effectiveCmd === MOTOR_COMMANDS.FORWARD;
  const effIsNotShading = isReady && !isLoading && effectiveCmd === MOTOR_COMMANDS.REVERSE;
  const effIsStopped    = isReady && !isLoading && effectiveCmd === MOTOR_COMMANDS.STOP;

  const getStatusText = () => {
    if (!isReady)         return t('motor.notReady');
    if (isLoading)        return t('common.loading');
    if (effIsShading)     return t('motor.shading');
    if (effIsNotShading)  return t('motor.notShading');
    return t('motor.stopped');
  };

  const btnDisabled = disabled || !isReady || isLoading;

  return (
    <Card className={cn(
      'overflow-hidden transition-all duration-300 hover:shadow-lg dark:bg-gray-800',
      (effIsShading || effIsNotShading) && 'ring-2 ring-orange-400 ring-offset-2 shadow-orange-100'
    )}>
      {/* Status bar */}
      <div className={cn(
        'h-2 transition-all duration-500',
        effIsShading    ? 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600' :
        effIsNotShading ? 'bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600' :
        'bg-gray-200 dark:bg-gray-700'
      )} />

      <div className="p-5">
        {/* Icon */}
        <div className="flex items-center justify-between mb-4">
          <div className={cn(
            'w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-md',
            (effIsShading || effIsNotShading)
              ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white scale-110'
              : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-400'
          )}>
            <Cog className={cn('w-7 h-7', (effIsShading || effIsNotShading) && 'animate-spin-slow')} />
          </div>

          {isAuto && (
            <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm">
              <Lock className="w-3.5 h-3.5" />
              Auto
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className={cn(
          'font-bold mb-4 text-base dark:text-gray-100',
          effIsShading || effIsNotShading ? 'text-orange-700' : 'text-gray-900'
        )}>
          {name}
        </h3>

        {/* Buttons */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {/* FORWARD */}
          <button
            onClick={() => onCommand(MOTOR_COMMANDS.FORWARD)}
            disabled={btnDisabled || effIsShading}
            className={cn(
              'py-4 rounded-xl font-bold text-sm transition-all duration-300 shadow-md',
              'flex flex-col items-center justify-center gap-2',
              'disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95',
              effIsShading
                ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-200 scale-105'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-2 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700'
            )}
          >
            <Moon className={cn('w-6 h-6', effIsShading && 'animate-pulse')} />
            <span className="text-xs">{t('motor.shade')}</span>
          </button>

          {/* STOP */}
          <button
            onClick={() => onCommand(MOTOR_COMMANDS.STOP)}
            disabled={btnDisabled || effIsStopped}
            className={cn(
              'py-4 rounded-xl font-bold text-sm transition-all duration-300 shadow-md',
              'flex flex-col items-center justify-center gap-2',
              'disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95',
              'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600'
            )}
          >
            <Square className="w-6 h-6" />
            <span className="text-xs">{t('control.stop')}</span>
          </button>

          {/* REVERSE */}
          <button
            onClick={() => onCommand(MOTOR_COMMANDS.REVERSE)}
            disabled={btnDisabled || effIsNotShading}
            className={cn(
              'py-4 rounded-xl font-bold text-sm transition-all duration-300 shadow-md',
              'flex flex-col items-center justify-center gap-2',
              'disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95',
              effIsNotShading
                ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-orange-200 scale-105'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-2 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700'
            )}
          >
            <Sun className={cn('w-6 h-6', effIsNotShading && 'animate-pulse')} />
            <span className="text-xs">{t('motor.unshade')}</span>
          </button>
        </div>

        {/* Status */}
        <div className="text-center">
          <div className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold',
            !isReady || isLoading ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' :
            effIsShading    ? 'bg-blue-50 text-blue-700 shadow-sm' :
            effIsNotShading ? 'bg-orange-50 text-orange-700 shadow-sm' :
            'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          )}>
            <div className={cn(
              'w-2.5 h-2.5 rounded-full',
              !isReady || isLoading ? 'bg-gray-400' :
              effIsShading    ? 'bg-blue-500 animate-pulse shadow-lg shadow-blue-500/50' :
              effIsNotShading ? 'bg-orange-500 animate-pulse shadow-lg shadow-orange-500/50' :
              'bg-gray-400'
            )} />
            <span>{getStatusText()}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}