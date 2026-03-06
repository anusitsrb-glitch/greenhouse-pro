import { useEffect, useRef, useState } from 'react';
import { RelayControlCard } from './RelayControlCard';
import { MotorControlCard } from './MotorControlCard';
import { AutoModeCard } from './AutoModeCard';
import { useAttributes } from '@/hooks/useAttributes';
import { useRpc, useMotorRpc } from '@/hooks/useRpc';
import { useToast } from '@/hooks/useToast';
import {
  ALL_CONTROL_ATTRIBUTES,
  RELAY_CONFIG,
  MOTOR_CONFIG,
  MOTOR_COMMANDS,
} from '@/config/dataKeys';
import { RefreshCw, Clock, AlertTriangle, Moon, Sun } from 'lucide-react';
import { formatDateTime, normalizeBoolean, cn } from '@/lib/utils';

interface DashboardTabProps {
  project: string;
  gh: string;
  isReady: boolean;
  isOnline: boolean;
  userRole: string;
}

type MotorCmd = number;
type OptimisticMotorState = Record<string, MotorCmd | null>;
type OptimisticRelayState = Record<string, boolean | null>;

const OPTIMISTIC_RELAY_TTL_MS = 8000;
const OPTIMISTIC_MOTOR_TTL_MS = 12000;

export function DashboardTab({ project, gh, isReady, isOnline, userRole }: DashboardTabProps) {
  const { addToast } = useToast();

  const { data, isLoading, refetch, lastUpdated } = useAttributes({
    project,
    gh,
    keys: ALL_CONTROL_ATTRIBUTES,
    enabled: isReady && isOnline,
    pollInterval: 5000,
  });

  // -------------------------
  // Refetch — ใช้เฉพาะปุ่ม "รีเฟรช" เท่านั้น
  // -------------------------
  const refetchTimerRef = useRef<number | null>(null);
  const scheduleRefetch = (delayMs = 0) => {
    if (refetchTimerRef.current) window.clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = window.setTimeout(() => {
      refetch();
      refetchTimerRef.current = null;
    }, delayMs);
  };
  useEffect(() => {
    return () => { if (refetchTimerRef.current) window.clearTimeout(refetchTimerRef.current); };
  }, []);

  // -------------------------
  // Optimistic UI — Relays
  // -------------------------
  const [optimisticRelays, setOptimisticRelays] = useState<OptimisticRelayState>({});
  const relayTtlRef = useRef<Record<string, number>>({});

  const clearRelayOptimistic = (relayKey: string) => {
    const t = relayTtlRef.current[relayKey];
    if (t) window.clearTimeout(t);
    delete relayTtlRef.current[relayKey];
    setOptimisticRelays((prev) => {
      if (!(relayKey in prev)) return prev;
      const next = { ...prev };
      next[relayKey] = null;
      return next;
    });
  };

  const setRelayOptimistic = (relayKey: string, value: boolean) => {
    setOptimisticRelays((prev) => ({ ...prev, [relayKey]: value }));
    const old = relayTtlRef.current[relayKey];
    if (old) window.clearTimeout(old);
    relayTtlRef.current[relayKey] = window.setTimeout(
      () => clearRelayOptimistic(relayKey),
      OPTIMISTIC_RELAY_TTL_MS
    );
  };

  // เคลียร์ optimistic เมื่อ polling ดึงค่าจริงมาตรงกันแล้ว
  useEffect(() => {
    for (const relay of RELAY_CONFIG) {
      const opt = optimisticRelays[relay.key];
      if (opt === null || opt === undefined) continue;
      const real = normalizeBoolean(data[relay.cmdKey]);
      if (real === opt) clearRelayOptimistic(relay.key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (isReady && isOnline) return;
    setOptimisticRelays({});
    Object.values(relayTtlRef.current).forEach((t) => window.clearTimeout(t));
    relayTtlRef.current = {};
  }, [isReady, isOnline]);

  useEffect(() => {
    return () => {
      Object.values(relayTtlRef.current).forEach((t) => window.clearTimeout(t));
      relayTtlRef.current = {};
    };
  }, []);

  // -------------------------
  // Optimistic UI — Motors
  // -------------------------
  const [optimisticMotors, setOptimisticMotors] = useState<OptimisticMotorState>({});
  const motorTtlRef = useRef<Record<string, number>>({});

  const clearMotorOptimistic = (motorKey: string) => {
    const t = motorTtlRef.current[motorKey];
    if (t) window.clearTimeout(t);
    delete motorTtlRef.current[motorKey];
    setOptimisticMotors((prev) => {
      if (!(motorKey in prev)) return prev;
      const next = { ...prev };
      next[motorKey] = null;
      return next;
    });
  };

  const setMotorOptimistic = (motorKey: string, cmd: MotorCmd) => {
    setOptimisticMotors((prev) => ({ ...prev, [motorKey]: cmd }));
    const old = motorTtlRef.current[motorKey];
    if (old) window.clearTimeout(old);
    motorTtlRef.current[motorKey] = window.setTimeout(
      () => clearMotorOptimistic(motorKey),
      OPTIMISTIC_MOTOR_TTL_MS
    );
  };

  useEffect(() => {
    for (const motor of MOTOR_CONFIG) {
      const opt = optimisticMotors[motor.key];
      if (opt === null || opt === undefined) continue;
      const realFw = normalizeBoolean(data[motor.fwKey]);
      const realRe = normalizeBoolean(data[motor.reKey]);
      let realCmd = MOTOR_COMMANDS.STOP;
      if (realFw && !realRe) realCmd = MOTOR_COMMANDS.FORWARD as 0;
      else if (!realFw && realRe) realCmd = MOTOR_COMMANDS.REVERSE as 0;
      if (realCmd === opt) clearMotorOptimistic(motor.key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (isReady && isOnline) return;
    setOptimisticMotors({});
    Object.values(motorTtlRef.current).forEach((t) => window.clearTimeout(t));
    motorTtlRef.current = {};
  }, [isReady, isOnline]);

  useEffect(() => {
    return () => {
      Object.values(motorTtlRef.current).forEach((t) => window.clearTimeout(t));
      motorTtlRef.current = {};
    };
  }, []);

  // -------------------------
  // RPC hooks
  // ✅ onSuccess แค่ toast ไม่ refetch
  // ✅ polling 5 วินาที sync สถานะจริงเอง
  // -------------------------
  const rpc = useRpc({
    project,
    gh,
    onSuccess: () => addToast({ type: 'success', message: 'ส่งคำสั่งแล้ว' }),
    onError: (_method, error) => addToast({ type: 'error', message: error }),
  });

  const motorRpc = useMotorRpc({
    project,
    gh,
    onSuccess: () => addToast({ type: 'success', message: 'ส่งคำสั่งมอเตอร์แล้ว' }),
    onError: (_method, error) => addToast({ type: 'error', message: error }),
  });

  const canControl = userRole === 'superadmin' || userRole === 'admin' || userRole === 'operator';
  const controlsDisabled = !isReady || !isOnline || !canControl;
  const globalAuto = normalizeBoolean(data['global_motor_auto']);

  // -------------------------
  // Relay toggle handler
  // ✅ set optimistic ทันที → ส่ง RPC fire-and-forget
  // ✅ ถ้า error → rollback optimistic + toast
  // -------------------------
  const handleRelayToggle = (relayKey: string, rpcMethod: string, relayName: string, next: boolean) => {
    setRelayOptimistic(relayKey, next);
    rpc.sendCommand(rpcMethod, next ? 1 : 0, next).then((ok) => {
      if (!ok) {
        clearRelayOptimistic(relayKey);
        addToast({ type: 'error', message: `ส่งคำสั่ง ${relayName} ไม่สำเร็จ กรุณาลองใหม่` });
      }
    });
  };

  // -------------------------
  // Motor command handler
  // ✅ set optimistic ทันที → ส่ง RPC fire-and-forget
  // ✅ ถ้า error → rollback optimistic + toast
  // -------------------------
  const handleMotorCommand = (motorKey: string, rpcMethod: string, motorName: string, cmd: number) => {
    setMotorOptimistic(motorKey, cmd);
    motorRpc.sendMotorCommand(motorKey, rpcMethod, cmd).then((ok) => {
      if (!ok) {
        clearMotorOptimistic(motorKey);
        addToast({ type: 'error', message: `ส่งคำสั่ง ${motorName} ไม่สำเร็จ กรุณาลองใหม่` });
      }
    });
  };

  return (
    <div className="space-y-6">
      {!canControl && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-800">
            คุณไม่มีสิทธิ์ควบคุมอุปกรณ์ (ต้องเป็น superadmin / operator / admin)
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>อัปเดตล่าสุด: {lastUpdated ? formatDateTime(new Date(lastUpdated)) : '--'}</span>
        </div>
        <button
          onClick={() => scheduleRefetch(0)}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          รีเฟรช
        </button>
      </div>

      {/* Auto Mode */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-purple-500 rounded-full"></span>
          เปิดใช้งานโหมดทำงานตามเวลาอัตโนมัติ
        </h2>
        <AutoModeCard
          data={data}
          isLoading={isLoading}
          isReady={isReady}
          disabled={controlsDisabled}
          onToggle={(method, value) => rpc.sendCommand(method, value ? 1 : 0, value)}
          isPending={rpc.isPending}
        />
      </section>

      {/* Relays */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-accent rounded-full"></span>
          ควบคุมรีเลย์
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {RELAY_CONFIG.map((relay) => {
            const realIsOn = normalizeBoolean(data[relay.cmdKey]);
            const isAuto = normalizeBoolean(data[relay.autoKey]);
            const effectiveIsOn = optimisticRelays[relay.key] ?? realIsOn;

            return (
              <RelayControlCard
                key={relay.key}
                name={relay.name}
                icon={relay.icon}
                isOn={effectiveIsOn}
                isAuto={isAuto}
                isLoading={isLoading}
                isReady={isReady}
                disabled={controlsDisabled || isAuto}
                onToggle={() => handleRelayToggle(
                  relay.key,
                  relay.rpcMethod,
                  relay.name,
                  !effectiveIsOn
                )}
              />
            );
          })}
        </div>
      </section>

      {/* Motors */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-orange-500 rounded-full"></span>
          ระบบพรางแสง
        </h2>

        {/* Control All */}
        <div className="mb-4 flex gap-3">
          <button
            onClick={() => MOTOR_CONFIG.forEach((motor) =>
              handleMotorCommand(motor.key, motor.rpcMethod, motor.name, MOTOR_COMMANDS.FORWARD)
            )}
            disabled={controlsDisabled || globalAuto}
            className={cn(
              'flex-1 py-4 px-6 rounded-xl font-bold text-base transition-all duration-300 shadow-lg',
              'flex items-center justify-center gap-3',
              'disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95',
              'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-blue-200'
            )}
          >
            <Moon className="w-6 h-6" />
            <span>พรางแสงทั้ง 4 โซน</span>
          </button>

          <button
            onClick={() => MOTOR_CONFIG.forEach((motor) =>
              handleMotorCommand(motor.key, motor.rpcMethod, motor.name, MOTOR_COMMANDS.REVERSE)
            )}
            disabled={controlsDisabled || globalAuto}
            className={cn(
              'flex-1 py-4 px-6 rounded-xl font-bold text-base transition-all duration-300 shadow-lg',
              'flex items-center justify-center gap-3',
              'disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95',
              'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-orange-200'
            )}
          >
            <Sun className="w-6 h-6" />
            <span>ไม่พรางแสงทั้ง 4 โซน</span>
          </button>
        </div>

        {/* Per motor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MOTOR_CONFIG.map((motor) => {
            const isFw = normalizeBoolean(data[motor.fwKey]);
            const isRe = normalizeBoolean(data[motor.reKey]);

            return (
              <MotorControlCard
                key={motor.key}
                name={motor.name}
                isFw={isFw}
                isRe={isRe}
                isAuto={globalAuto}
                isLoading={isLoading}
                isReady={isReady}
                disabled={controlsDisabled || globalAuto}
                isPending={motorRpc.isMotorPending(motor.key)}
                optimisticCmd={optimisticMotors[motor.key] ?? null}
                onCommand={(cmd) => handleMotorCommand(motor.key, motor.rpcMethod, motor.name, cmd)}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}