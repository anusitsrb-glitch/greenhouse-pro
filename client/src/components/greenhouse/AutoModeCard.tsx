import { Card } from '@/components/ui';
import { ToggleLeft, ToggleRight, Bot, Fan, Droplets, Waves, Lightbulb, Cog } from 'lucide-react';
import { cn, normalizeBoolean } from '@/lib/utils';
import { RPC_METHODS, ATTRIBUTE_KEYS } from '@/config/dataKeys';

interface AutoModeCardProps {
  data: Record<string, unknown>;
  isLoading: boolean;
  isReady: boolean;
  disabled: boolean;
  onToggle: (method: string, value: boolean) => void;
  isPending: (method: string) => boolean;
}

const AUTO_MODES = [
  { key: 'fan_1_auto', name: 'พัดลมใหญ่', icon: Fan, method: RPC_METHODS.AUTO.SET_FAN_1_AUTO },
  { key: 'fan_2_auto', name: 'พัดลมกวนอากาศ', icon: Fan, method: RPC_METHODS.AUTO.SET_FAN_2_AUTO },
  { key: 'valve_1_auto', name: 'น้ำโซน 1', icon: Droplets, method: RPC_METHODS.AUTO.SET_VALVE_1_AUTO },
  { key: 'valve_2_auto', name: 'น้ำโซน 2', icon: Droplets, method: RPC_METHODS.AUTO.SET_VALVE_2_AUTO },
  { key: 'valve_3_auto', name: 'น้ำโซน 3', icon: Droplets, method: RPC_METHODS.AUTO.SET_VALVE_3_AUTO },
  { key: 'valve_4_auto', name: 'น้ำโซน 4', icon: Droplets, method: RPC_METHODS.AUTO.SET_VALVE_4_AUTO },
  { key: 'light_1_auto', name: 'แสงเสริม', icon: Lightbulb, method: RPC_METHODS.AUTO.SET_LIGHT_1_AUTO },
  { key: 'global_motor_auto', name: 'มอเตอร์ทั้งหมด', icon: Cog, method: RPC_METHODS.AUTO.SET_GLOBAL_MOTOR_AUTO },
];

export function AutoModeCard({ data, isLoading, isReady, disabled, onToggle, isPending }: AutoModeCardProps) {
  return (
    <Card>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">โหมดทำงานตามเวลาอัตโนมัติ</h3>
            <p className="text-sm text-gray-500">เปิด/ปิดการควบคุมการทำงานตามเวลาแบบอัตโนมัติ</p>
          </div>
        </div>

        {/* Auto mode toggles */}
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
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 bg-white hover:border-gray-300',
                  pending && 'animate-pulse'
                )}
              >
                <Icon className={cn(
                  'w-6 h-6',
                  isOn ? 'text-purple-600' : 'text-gray-400'
                )} />
                <span className={cn(
                  'text-sm font-medium',
                  isOn ? 'text-purple-700' : 'text-gray-600'
                )}>
                  {mode.name}
                </span>
                
                {/* Toggle indicator */}
                <div className={cn(
                  'flex items-center gap-1 text-xs',
                  isOn ? 'text-purple-600' : 'text-gray-400'
                )}>
                  {isOn ? (
                    <>
                      <ToggleRight className="w-5 h-5" />
                      <span>เปิด</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-5 h-5" />
                      <span>ปิด</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Info text */}
        <p className="mt-4 text-xs text-gray-500 text-center">
          เมื่อเปิดโหมดอัตโนมัติ อุปกรณ์จะทำงานตามตัวจับเวลาและเงื่อนไขที่ตั้งไว้
        </p>
      </div>
    </Card>
  );
}
