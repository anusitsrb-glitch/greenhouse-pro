import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui';
import {
  Fan,
  Droplets,
  Waves,
  Lightbulb,
  Power,
  Lock,
  Zap,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS: Record<string, typeof Fan> = { Fan, Droplets, Waves, Lightbulb };

interface RelayControlCardProps {
  name: string;
  icon: string;
  isOn: boolean;
  isAuto: boolean;
  isLoading: boolean;
  isReady: boolean;
  disabled: boolean;
  isPending: boolean;
  onToggle: () => void | Promise<void>;
}

const SEND_PHASE_MS = 400; // แสดง "กำลังส่ง..." สั้นๆ แล้วกลับ idle ทันที

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

  // ---------- Optimistic UI ----------
  const [optimisticOn, setOptimisticOn] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<'idle' | 'sending'>('idle');
  const phaseTimer = useRef<number | null>(null);
  const ttlTimer = useRef<number | null>(null);

  const effectiveOn = optimisticOn ?? isOn;
  const showOn = isReady && !isLoading && effectiveOn;
  const showAuto = isReady && !isLoading && isAuto;

  // เคลียร์ optimistic เมื่อสถานะจริงอัปเดตแล้ว
  useEffect(() => {
    if (optimisticOn === null) return;
    if (isOn === optimisticOn) {
      setOptimisticOn(null);
      if (ttlTimer.current) window.clearTimeout(ttlTimer.current);
      ttlTimer.current = null;
    }
  }, [isOn, optimisticOn]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (phaseTimer.current) window.clearTimeout(phaseTimer.current);
      if (ttlTimer.current) window.clearTimeout(ttlTimer.current);
    };
  }, []);

  const handleToggle = () => {
    if (disabled || phase !== 'idle') return;

    const next = !(optimisticOn ?? isOn);
    setOptimisticOn(next);
    setPhase('sending');

    // ✅ กลับ idle หลัง SEND_PHASE_MS → ปุ่มตัวอื่นไม่ถูก block
    if (phaseTimer.current) window.clearTimeout(phaseTimer.current);
    phaseTimer.current = window.setTimeout(() => {
      setPhase('idle');
      phaseTimer.current = null;
    }, SEND_PHASE_MS);

    // TTL กันค้าง optimistic (6s)
    if (ttlTimer.current) window.clearTimeout(ttlTimer.current);
    ttlTimer.current = window.setTimeout(() => {
      setOptimisticOn(null);
      ttlTimer.current = null;
    }, 6000);

    try {
      const p = onToggle();
      if (p && typeof (p as any).then === 'function') {
        (p as Promise<void>).catch(() => {
          setOptimisticOn(null);
        });
      }
    } catch {
      setOptimisticOn(null);
    }
  };

  // ✅ ปุ่ม disable แค่ตอน 'sending' (400ms) ไม่ค้างนาน
  const btnDisabled = disabled || !isReady || isLoading || phase === 'sending';

  // ✅ Animation ตามประเภทอุปกรณ์
  const getIconAnimation = () => {
    if (!showOn) return '';
    if (icon === 'Fan') return 'animate-spin-slow';
    if (icon === 'Droplets' || icon === 'Waves') return 'animate-bounce-slow';
    if (icon === 'Lightbulb') return 'animate-flicker';
    return 'animate-pulse';
  };

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-300 hover:shadow-lg',
        showOn && 'ring-2 ring-green-400 ring-offset-2 shadow-green-100'
      )}
    >
      {/* Status bar */}
      <div
        className={cn(
          'h-2 transition-all duration-500',
          showOn
            ? 'bg-gradient-to-r from-green-400 via-green-500 to-green-600'
            : 'bg-gray-200'
        )}
      >
        {showOn && <div className="h-full w-1/3 bg-white/30 animate-shimmer" />}
      </div>

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div
            className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-md',
              showOn
                ? 'bg-gradient-to-br from-green-400 to-green-600 text-white scale-110'
                : 'bg-gray-100 text-gray-400'
            )}
          >
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
        <h3 className={cn('font-bold text-gray-900 mb-4 text-base transition-colors', showOn && 'text-green-700')}>
          {name}
        </h3>

        {/* Button */}
        <button
          onClick={handleToggle}
          disabled={btnDisabled}
          className={cn(
            'w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-300',
            'flex items-center justify-center gap-2 shadow-md',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transform active:scale-95',
            showOn
              ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-red-200'
              : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-green-200'
          )}
        >
          {phase === 'sending' ? (
            <>
              <Zap className="w-5 h-5 animate-bounce" />
              กำลังส่งคำสั่ง...
            </>
          ) : (
            <>
              <Power className="w-5 h-5" />
              {showOn ? 'ปิด' : 'เปิด'}
            </>
          )}
        </button>

        {/* Sync hint - แสดงเบาๆ จาก isPending ของ parent เท่านั้น */}
        {isPending && phase === 'idle' && (
          <div className="mt-2 text-xs text-gray-400 text-center flex items-center justify-center gap-1">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            กำลังซิงค์สถานะ...
          </div>
        )}

        {/* Status indicator */}
        <div className="mt-4 text-center">
          <div
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all',
              !isReady || isLoading
                ? 'bg-gray-100 text-gray-500'
                : showOn
                ? 'bg-green-50 text-green-700 shadow-sm'
                : 'bg-gray-50 text-gray-600'
            )}
          >
            <div
              className={cn(
                'w-2.5 h-2.5 rounded-full transition-all',
                !isReady || isLoading
                  ? 'bg-gray-400'
                  : showOn
                  ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50'
                  : 'bg-gray-400'
              )}
            />
            <span>
              {!isReady ? 'ไม่พร้อม' : isLoading ? 'กำลังโหลด...' : showOn ? 'กำลังทำงาน' : 'หยุด'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}