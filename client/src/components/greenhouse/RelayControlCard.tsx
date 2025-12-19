import { Card } from '@/components/ui';
import { Fan, Droplets, Waves, Lightbulb, Power, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS: Record<string, typeof Fan> = {
  Fan,
  Droplets,
  Waves,
  Lightbulb,
};

interface RelayControlCardProps {
  name: string;
  icon: string;
  isOn: boolean;
  isAuto: boolean;
  isLoading: boolean;
  isReady: boolean;
  disabled: boolean;
  isPending: boolean;
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
  isPending,
  onToggle,
}: RelayControlCardProps) {
  const Icon = ICONS[icon] || Power;
  
  const showOn = isReady && !isLoading && isOn;
  const showAuto = isReady && !isLoading && isAuto;

  return (
    <Card className={cn(
      'overflow-hidden transition-all duration-300',
      showOn && 'ring-2 ring-primary ring-offset-2'
    )}>
      {/* Status bar */}
      <div className={cn(
        'h-1.5 transition-colors',
        showOn ? 'bg-primary' : 'bg-gray-200'
      )} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
            showOn ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
          )}>
            <Icon className="w-6 h-6" />
          </div>

          {/* Auto badge */}
          {showAuto && (
            <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Auto
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className="font-semibold text-gray-900 mb-3">{name}</h3>

        {/* Toggle button */}
        <button
          onClick={onToggle}
          disabled={disabled || isPending}
          className={cn(
            'w-full py-3 rounded-xl font-medium text-sm transition-all',
            'flex items-center justify-center gap-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            showOn
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-green-100 text-green-700 hover:bg-green-200',
            isPending && 'animate-pulse'
          )}
        >
          <Power className="w-4 h-4" />
          {isPending ? 'กำลังส่ง...' : showOn ? 'ปิด' : 'เปิด'}
        </button>

        {/* Status text */}
        <div className="mt-3 text-center">
          <span className={cn(
            'text-sm font-medium',
            !isReady || isLoading ? 'text-gray-400' :
            showOn ? 'text-green-600' : 'text-gray-500'
          )}>
            {!isReady ? 'ไม่พร้อม' :
             isLoading ? 'กำลังโหลด...' :
             showOn ? '● กำลังทำงาน' : '○ หยุด'}
          </span>
        </div>
      </div>
    </Card>
  );
}
