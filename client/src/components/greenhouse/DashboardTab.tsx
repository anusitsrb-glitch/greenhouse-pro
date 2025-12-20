import { useState, useCallback } from 'react';
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
} from '@/config/dataKeys';
import { RefreshCw, Clock, AlertTriangle } from 'lucide-react';
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
  
  // Fetch attributes (control states)
  const { data, isLoading, refetch, lastUpdated } = useAttributes({
    project,
    gh,
    keys: ALL_CONTROL_ATTRIBUTES,
    enabled: isReady,
    pollInterval: 3000, // 3 seconds
  });

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
    },
    onError: (method, error) => {
      addToast({ type: 'error', message: error });
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
    },
    onError: (method, error) => {
      addToast({ type: 'error', message: error });
    },
  });

  // Check if user can control (operator or admin)
  const canControl = userRole === 'superadmin' || userRole === 'admin' || userRole === 'operator' ;
  const controlsDisabled = !isReady || !isOnline || !canControl;

  return (
    <div className="space-y-6">
      {/* Warning if controls disabled */}
      {!canControl && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-800">
            คุณไม่มีสิทธิ์ควบคุมอุปกรณ์ (ต้องเป็น superadmin / operator / admin )
          </p>
        </div>
      )}

      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>
            อัปเดตล่าสุด: {lastUpdated ? formatDateTime(new Date(lastUpdated)) : '--'}
          </span>
        </div>
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
                onToggle={() => rpc.sendCommand(relay.rpcMethod, isOn ? 0 : 1, !isOn)}
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
                onCommand={(cmd) => motorRpc.sendMotorCommand(motor.key, motor.rpcMethod, cmd)}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
