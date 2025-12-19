import { Card } from '@/components/ui';
import { ArrowDown, ArrowUp, Square, Lock, Cog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MOTOR_COMMANDS } from '@/config/dataKeys';

interface MotorControlCardProps {
  name: string;
  isFw: boolean;
  isRe: boolean;
  isAuto: boolean;
  isLoading: boolean;
  isReady: boolean;
  disabled: boolean;
  isPending: boolean;
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
  isPending,
  onCommand,
}: MotorControlCardProps) {
  // Determine current state
  const isMovingDown = isReady && !isLoading && isFw && !isRe;
  const isMovingUp = isReady && !isLoading && !isFw && isRe;
  const isStopped = isReady && !isLoading && !isFw && !isRe;

  const getStatusText = () => {
    if (!isReady) return 'ไม่พร้อม';
    if (isLoading) return 'กำลังโหลด...';
    if (isMovingDown) return '▼ กำลังลง';
    if (isMovingUp) return '▲ กำลังขึ้น';
    return '■ หยุด';
  };

  const getStatusColor = () => {
    if (!isReady || isLoading) return 'text-gray-400';
    if (isMovingDown) return 'text-blue-600';
    if (isMovingUp) return 'text-orange-600';
    return 'text-gray-500';
  };

  return (
    <Card className={cn(
      'overflow-hidden transition-all duration-300',
      (isMovingDown || isMovingUp) && 'ring-2 ring-orange-400 ring-offset-2'
    )}>
      {/* Status bar */}
      <div className={cn(
        'h-1.5 transition-colors',
        isMovingDown ? 'bg-blue-500' :
        isMovingUp ? 'bg-orange-500' : 'bg-gray-200'
      )} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
            isMovingDown || isMovingUp ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'
          )}>
            <Cog className={cn(
              'w-6 h-6',
              (isMovingDown || isMovingUp) && 'animate-spin-slow'
            )} />
          </div>

          {/* Auto badge */}
          {isAuto && (
            <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Auto
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className="font-semibold text-gray-900 mb-3">{name}</h3>

        {/* Control buttons */}
        <div className="grid grid-cols-3 gap-2">
          {/* Down button */}
          <button
            onClick={() => onCommand(MOTOR_COMMANDS.FORWARD)}
            disabled={disabled || isPending || isMovingDown}
            className={cn(
              'py-3 rounded-xl font-medium text-sm transition-all',
              'flex flex-col items-center justify-center gap-1',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isMovingDown
                ? 'bg-blue-500 text-white'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            )}
          >
            <ArrowDown className="w-5 h-5" />
            <span className="text-xs">ลง</span>
          </button>

          {/* Stop button */}
          <button
            onClick={() => onCommand(MOTOR_COMMANDS.STOP)}
            disabled={disabled || isPending || isStopped}
            className={cn(
              'py-3 rounded-xl font-medium text-sm transition-all',
              'flex flex-col items-center justify-center gap-1',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            <Square className="w-5 h-5" />
            <span className="text-xs">หยุด</span>
          </button>

          {/* Up button */}
          <button
            onClick={() => onCommand(MOTOR_COMMANDS.REVERSE)}
            disabled={disabled || isPending || isMovingUp}
            className={cn(
              'py-3 rounded-xl font-medium text-sm transition-all',
              'flex flex-col items-center justify-center gap-1',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isMovingUp
                ? 'bg-orange-500 text-white'
                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
            )}
          >
            <ArrowUp className="w-5 h-5" />
            <span className="text-xs">ขึ้น</span>
          </button>
        </div>

        {/* Status text */}
        <div className="mt-3 text-center">
          <span className={cn('text-sm font-medium', getStatusColor())}>
            {isPending ? 'กำลังส่งคำสั่ง...' : getStatusText()}
          </span>
        </div>
      </div>
    </Card>
  );
}
