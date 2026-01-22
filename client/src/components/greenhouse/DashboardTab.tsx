import { useState, useCallback, useMemo } from 'react';
import { RelayControlCard } from './RelayControlCard';
import { MotorControlCard } from './MotorControlCard';
import { AutoModeCard } from './AutoModeCard';
import { useAttributes } from '@/hooks/useAttributes';
import { useRpc, useMotorRpc } from '@/hooks/useRpc';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useToast } from '@/hooks/useToast';
import {
  ALL_CONTROL_ATTRIBUTES,
  RELAY_CONFIG,
  MOTOR_CONFIG,
} from '@/config/dataKeys';
import { RefreshCw, Clock, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { formatDateTime, normalizeBoolean } from '@/lib/utils';

interface DashboardTabProps {
  project: string;
  gh: string;
  isReady: boolean;
  isOnline: boolean;
  userRole: string;
}

export function DashboardTab({ project, gh, isReady, isOnline, userRole }: DashboardTabProps) {
  const { addToast } = useToast();

  // ✅ Optimistic state for instant UI updates
  const [optimisticState, setOptimisticState] = useState<Record<string, any>>({});

  // Fetch attributes (control states) with adaptive polling
  const { data: serverData, isLoading, refetch, lastUpdated } = useAttributes({
    project,
    gh,
    keys: ALL_CONTROL_ATTRIBUTES,
    enabled: isReady,
  });

  // ✅ WebSocket for real-time updates
  const { isConnected: wsConnected } = useWebSocket({
    project,
    gh,
    enabled: isReady,
    onUpdate: (newData) => {
      // Clear optimistic state when server confirms
      setOptimisticState((prev) => {
        const updated = { ...prev };
        Object.keys(newData).forEach((key) => {
          delete updated[key];
        });
        return updated;
      });
    },
  });

  // Merge server data with optimistic state
  const data = useMemo(() => {
    return { ...serverData, ...optimisticState };
  }, [serverData, optimisticState]);

  // RPC hook for relays and auto modes
  const rpc = useRpc({
    project,
    gh,
    onSuccess: (method) => {
      addToast({ type: 'success', message: 'ส่งคำสั่งสำเร็จ' });
      refetch();
    },
    onTimeout: (method) => {
      addToast({ type: 'warning', message: 'รอการยืนยันนานเกินไป' });
      // Rollback optimistic state on timeout
      setOptimisticState({});
      refetch();
    },
    onError: (method, error) => {
      addToast({ type: 'error', message: error });
      // Rollback optimistic state on error
      setOptimisticState({});
    },
  });

  // Motor RPC hook
  const motorRpc = useMotorRpc({
    project,
    gh,
    onSuccess: (method) => {
      addToast({ type: 'success', message: 'ส่งคำสั่งมอเตอร์สำเร็จ' });
      refetch();
    },
    onTimeout: (method) => {
      addToast({ type: 'warning', message: 'รอการยืนยันมอเตอร์นานเกินไป' });
      setOptimisticState({});
      refetch();
    },
    onError: (method, error) => {
      addToast({ type: 'error', message: error });
      setOptimisticState({});
    },
  });

  // ✅ Optimistic command handler
  const handleRelayToggle = useCallback(
    (method: string, currentValue: boolean, attributeKey: string) => {
      const newValue = !currentValue;

      // 1. Update UI immediately (Optimistic)
      setOptimisticState((prev) => ({
        ...prev,
        [attributeKey]: newValue,
      }));

      // 2. Send command (background)
      rpc.sendCommand(method, newValue ? 1 : 0, newValue).catch(() => {
        // Rollback on error
        setOptimisticState((prev) => {
          const updated = { ...prev };
          delete updated[attributeKey];
          return updated;
        });
      });
    },
    [rpc]
  );

  // ✅ Optimistic motor command handler
  const handleMotorCommand = useCallback(
    (
      motorKey: string,
      method: string,
      command: number,
      fwKey: string,
      reKey: string
    ) => {
      // 1. Update UI immediately
      setOptimisticState((prev) => ({
        ...prev,
        [fwKey]: command === 1,
        [reKey]: command === 2,
      }));

      // 2. Send command
      motorRpc.sendMotorCommand(motorKey, method, command).catch(() => {
        // Rollback on error
        setOptimisticState((prev) => {
          const updated = { ...prev };
          delete updated[fwKey];
          delete updated[reKey];
          return updated;
        });
      });
    },
    [motorRpc]
  );

  // Check if user can control
  const canControl =
    userRole === 'superadmin' || userRole === 'admin' || userRole === 'operator';
  const controlsDisabled = !isReady || !isOnline || !canControl;

  return (
    <div className="space-y-6">
      {/* Warning if controls disabled */}
      {!canControl && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-800">
            คุณไม่มีสิทธิ์ควบคุมอุปกรณ์ (ต้องเป็น superadmin / operator / admin)
          </p>
        </div>
      )}

      {/* Header with refresh and connection status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Last updated */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span>
              อัปเดตล่าสุด: {lastUpdated ? formatDateTime(new Date(lastUpdated)) : '--'}
            </span>
          </div>

          {/* WebSocket status */}
          {isReady && (
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                wsConnected
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {wsConnected ? (
                <>
                  <Wifi className="w-3 h-3" />
                  <span>Real-time</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  <span>Polling</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Refresh button */}
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          รีเฟรช
        </button>
      </div>

      {/* Auto Mode Section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-purple-500 rounded-full"></span>
          โหมดอัตโนมัติ
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

      {/* Relay Controls Section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-accent rounded-full"></span>
          ควบคุมรีเลย์
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {RELAY_CONFIG.map((relay) => {
            const isOn = normalizeBoolean(data[relay.cmdKey]);
            const isAuto = normalizeBoolean(data[relay.autoKey]);

            return (
              <RelayControlCard
                key={relay.key}
                name={relay.name}
                icon={relay.icon}
                isOn={isOn}
                isAuto={isAuto}
                isLoading={isLoading}
                isReady={isReady}
                disabled={controlsDisabled || isAuto}
                isPending={rpc.isPending(relay.rpcMethod)}
                onToggle={() =>
                  handleRelayToggle(relay.rpcMethod, isOn, relay.cmdKey)
                }
              />
            );
          })}
        </div>
      </section>

      {/* Motor Controls Section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-orange-500 rounded-full"></span>
          ควบคุมมอเตอร์
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MOTOR_CONFIG.map((motor) => {
            const isFw = normalizeBoolean(data[motor.fwKey]);
            const isRe = normalizeBoolean(data[motor.reKey]);
            const globalAuto = normalizeBoolean(data['global_motor_auto']);

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
                onCommand={(cmd) =>
                  handleMotorCommand(
                    motor.key,
                    motor.rpcMethod,
                    cmd,
                    motor.fwKey,
                    motor.reKey
                  )
                }
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}