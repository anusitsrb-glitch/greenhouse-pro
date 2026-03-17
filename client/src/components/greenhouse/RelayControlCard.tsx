import { Card } from '@/components/ui';
import { Fan, Droplets, Waves, Lightbulb, Power, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';

const ICONS: Record<string, typeof Fan> = { Fan, Droplets, Waves, Lightbulb };

interface RelayControlCardProps {
  name: string;
  icon: string;
  isOn: boolean;
  isAuto: boolean;
  isLoading: boolean;
  isReady: boolean;
  disabled: boolean;
  onToggle: () => void;
}

export function RelayControlCard({
  name,
  icon,
  isOn,
  isAuto,
  isLoading,
  isReady,
  disabled,
  onToggle,
}: RelayControlCardProps) {
  const { t } = useT();
  const Icon = ICONS[icon] || Power;

  const showOn   = isReady && !isLoading && isOn;
  const showAuto = isReady && !isLoading && isAuto;

  const getIconAnimation = () => {
    if (!showOn) return '';
    if (icon === 'Fan')                          return 'animate-spin-slow';
    if (icon === 'Droplets' || icon === 'Waves') return 'animate-bounce-slow';
    if (icon === 'Lightbulb')                    return 'animate-flicker';
    return 'animate-pulse';
  };

  const btnDisabled = disabled || !isReady || isLoading;

  return (
    <Card className={cn(
      'overflow-hidden transition-all duration-300 hover:shadow-lg dark:bg-gray-800',
      showOn && 'ring-2 ring-green-400 ring-offset-2 shadow-green-100'
    )}>
      {/* Status bar */}
      <div className={cn(
        'h-2 transition-all duration-500',
        showOn ? 'bg-gradient-to-r from-green-400 via-green-500 to-green-600' : 'bg-gray-200 dark:bg-gray-700'
      )}>
        {showOn && <div className="h-full w-1/3 bg-white/30 animate-shimmer" />}
      </div>

      <div className="p-5">
        {/* Icon */}
        <div className="flex items-center justify-between mb-4">
          <div className={cn(
            'w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-md',
            showOn
              ? 'bg-gradient-to-br from-green-400 to-green-600 text-white scale-110'
              : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-400'
          )}>
            <Icon className={cn('w-7 h-7 transition-all duration-300', getIconAnimation())} />
          </div>

          {showAuto && (
            <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm">
              <Lock className="w-3.5 h-3.5" />
              Auto
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className={cn(
          'font-bold mb-4 text-base transition-colors dark:text-gray-100',
          showOn ? 'text-green-700' : 'text-gray-900'
        )}>
          {name}
        </h3>

        {/* Button */}
        <button
          onClick={onToggle}
          disabled={btnDisabled}
          className={cn(
            'w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-300',
            'flex items-center justify-center gap-2 shadow-md',
            'disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95',
            showOn
              ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-red-200'
              : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-green-200'
          )}
        >
          <Power className="w-5 h-5" />
          {showOn ? t('control.off') : t('control.on')}
        </button>

        {/* Status indicator */}
        <div className="mt-4 text-center">
          <div className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all',
            !isReady || isLoading
              ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              : showOn
              ? 'bg-green-50 text-green-700 shadow-sm'
              : 'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          )}>
            <div className={cn(
              'w-2.5 h-2.5 rounded-full transition-all',
              !isReady || isLoading ? 'bg-gray-400' :
              showOn ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50' : 'bg-gray-400'
            )} />
            <span>
              {!isReady
                ? t('motor.notReady')
                : isLoading
                ? t('common.loading')
                : showOn
                ? t('relay.working')
                : t('relay.idle')}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}