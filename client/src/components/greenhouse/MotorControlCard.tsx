import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui';
import { Sun, Moon, Square, Lock, Cog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MOTOR_COMMANDS } from '@/config/dataKeys';

interface MotorControlCardProps {
  name: string;

  // สถานะจริงจาก attributes
  isFw: boolean;
  isRe: boolean;

  isAuto: boolean;
  isLoading: boolean;
  isReady: boolean;
  disabled: boolean;

  // pending จาก hook ฝั่ง parent (ยังแสดงได้ แต่ไม่ใช้เป็นตัวหลัก)
  isPending: boolean;

  // ✅ NEW: (optional) optimistic state ที่ parent ส่งมา
  // 0=STOP, 1=FORWARD, 2=REVERSE, null/undefined=ไม่ใช้ optimistic
  optimisticCmd?: number | null;

  // รองรับ async (parent อาจ return Promise)
  onCommand: (cmd: number) => void | Promise<void>;
}

const SEND_PHASE_MS = 450;   // แสดง "กำลังส่ง..." สั้นๆ
const SYNC_TTL_MS = 12000;   // กันค้าง: 12s แล้วหยุดซิงค์เอง

export function MotorControlCard({
  name,
  isFw,
  isRe,
  isAuto,
  isLoading,
  isReady,
  disabled,
  isPending,
  optimisticCmd,
  onCommand,
}: MotorControlCardProps) {
  // ===== real cmd from attributes =====
  const realCmd =
    isFw && !isRe
      ? MOTOR_COMMANDS.FORWARD
      : !isFw && isRe
      ? MOTOR_COMMANDS.REVERSE
      : MOTOR_COMMANDS.STOP;

  // ===== local phase (optimistic UX) =====
  const [phase, setPhase] = useState<'idle' | 'sending' | 'syncing'>('idle');
  const [targetCmd, setTargetCmd] = useState<number | null>(null);

  const ttlRef = useRef<number | null>(null);
  const phaseRef = useRef<number | null>(null);

  const cleanup = () => {
    setPhase('idle');
    setTargetCmd(null);

    if (ttlRef.current) window.clearTimeout(ttlRef.current);
    if (phaseRef.current) window.clearTimeout(phaseRef.current);
    ttlRef.current = null;
    phaseRef.current = null;
  };

  // ✅ effective cmd = optimistic (จาก parent) หรือ real
  const effectiveCmd = optimisticCmd ?? realCmd;

  const effIsShading = isReady && !isLoading && effectiveCmd === MOTOR_COMMANDS.FORWARD;
  const effIsNotShading = isReady && !isLoading && effectiveCmd === MOTOR_COMMANDS.REVERSE;
  const effIsStopped = isReady && !isLoading && effectiveCmd === MOTOR_COMMANDS.STOP;

  const getStatusText = () => {
    if (!isReady) return 'ไม่พร้อม';
    if (isLoading) return 'กำลังโหลด...';
    if (effIsShading) return '🌥️ กำลังพรางแสง';
    if (effIsNotShading) return '☀️ ไม่พรางแสง';
    return '⏸️ หยุด';
  };

  // ✅ เคลียร์ phase เมื่อสถานะจริง match เป้าหมาย
  useEffect(() => {
    if (phase === 'idle' || targetCmd === null) return;
    if (realCmd === targetCmd) cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realCmd]);

  // cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (ttlRef.current) window.clearTimeout(ttlRef.current);
      if (phaseRef.current) window.clearTimeout(phaseRef.current);
    };
  }, []);

  const handleCommand = (cmd: number) => {
    if (disabled || !isReady || isLoading) return;

    setTargetCmd(cmd);
    setPhase('sending');

    // เปลี่ยนเป็น syncing หลังส่งสั้นๆ
    if (phaseRef.current) window.clearTimeout(phaseRef.current);
    phaseRef.current = window.setTimeout(() => setPhase('syncing'), SEND_PHASE_MS);

    // TTL กันค้าง
    if (ttlRef.current) window.clearTimeout(ttlRef.current);
    ttlRef.current = window.setTimeout(() => cleanup(), SYNC_TTL_MS);

    try {
      const p = onCommand(cmd);
      if (p && typeof (p as any).then === 'function') {
        (p as Promise<void>).catch(() => cleanup());
      }
    } catch {
      cleanup();
    }
  };

  // ✅ กันกดซ้ำระหว่าง sending/syncing เพื่อให้ UX ลื่น
  const btnDisabled = disabled || !isReady || isLoading || phase !== 'idle';

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-300 hover:shadow-lg',
        (effIsShading || effIsNotShading) && 'ring-2 ring-orange-400 ring-offset-2 shadow-orange-100'
      )}
    >
      <div
        className={cn(
          'h-2 transition-all duration-500',
          effIsShading
            ? 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600'
            : effIsNotShading
            ? 'bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600'
            : 'bg-gray-200'
        )}
      />

      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div
            className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-md',
              (effIsShading || effIsNotShading)
                ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white scale-110'
                : 'bg-gray-100 text-gray-400'
            )}
          >
            <Cog className={cn('w-7 h-7', (effIsShading || effIsNotShading) && 'animate-spin-slow')} />
          </div>

          {isAuto && (
            <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm">
              <Lock className="w-3.5 h-3.5" />
              Auto
            </span>
          )}
        </div>

        <h3
          className={cn(
            'font-bold text-gray-900 mb-4 text-base',
            (effIsShading || effIsNotShading) && 'text-orange-700'
          )}
        >
          {name}
        </h3>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {/* FORWARD / Shading */}
          <button
            onClick={() => handleCommand(MOTOR_COMMANDS.FORWARD)}
            disabled={btnDisabled || effIsShading}
            className={cn(
              'py-4 rounded-xl font-bold text-sm transition-all duration-300 shadow-md',
              'flex flex-col items-center justify-center gap-2',
              'disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95',
              effIsShading
                ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-200 scale-105'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-2 border-blue-200'
            )}
          >
            <Moon className={cn('w-6 h-6', effIsShading && 'animate-pulse')} />
            <span className="text-xs">พรางแสง</span>
          </button>

          {/* STOP */}
          <button
            onClick={() => handleCommand(MOTOR_COMMANDS.STOP)}
            disabled={btnDisabled || effIsStopped}
            className={cn(
              'py-4 rounded-xl font-bold text-sm transition-all duration-300 shadow-md',
              'flex flex-col items-center justify-center gap-2',
              'disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95',
              'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-gray-200'
            )}
          >
            <Square className="w-6 h-6" />
            <span className="text-xs">หยุด</span>
          </button>

          {/* REVERSE / Not shading */}
          <button
            onClick={() => handleCommand(MOTOR_COMMANDS.REVERSE)}
            disabled={btnDisabled || effIsNotShading}
            className={cn(
              'py-4 rounded-xl font-bold text-sm transition-all duration-300 shadow-md',
              'flex flex-col items-center justify-center gap-2',
              'disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95',
              effIsNotShading
                ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-orange-200 scale-105'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-2 border-orange-200'
            )}
          >
            <Sun className={cn('w-6 h-6', effIsNotShading && 'animate-pulse')} />
            <span className="text-xs">ไม่พราง</span>
          </button>
        </div>

        <div className="text-center">
          <div
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold',
              !isReady || isLoading
                ? 'bg-gray-100 text-gray-500'
                : effIsShading
                ? 'bg-blue-50 text-blue-700 shadow-sm'
                : effIsNotShading
                ? 'bg-orange-50 text-orange-700 shadow-sm'
                : 'bg-gray-50 text-gray-600'
            )}
          >
            <div
              className={cn(
                'w-2.5 h-2.5 rounded-full',
                !isReady || isLoading
                  ? 'bg-gray-400'
                  : effIsShading
                  ? 'bg-blue-500 animate-pulse shadow-lg shadow-blue-500/50'
                  : effIsNotShading
                  ? 'bg-orange-500 animate-pulse shadow-lg shadow-orange-500/50'
                  : 'bg-gray-400'
              )}
            />
            <span>
              {phase === 'sending'
                ? 'กำลังส่งคำสั่ง...'
                : phase === 'syncing'
                ? 'ส่งแล้ว กำลังซิงค์สถานะ...'
                : isPending
                ? 'กำลังส่งคำสั่ง...'
                : getStatusText()}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
