import { Card } from '@/components/ui';
import { Wifi, Signal, Cpu, Timer } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { TELEMETRY_KEYS } from '@/config/dataKeys';

interface SystemInfoCardProps {
  data: Record<string, number | null>;
  isLoading: boolean;
  isReady: boolean;
}

export function SystemInfoCard({ data, isLoading, isReady }: SystemInfoCardProps) {
  const wifiSsid = data[TELEMETRY_KEYS.SYSTEM.WIFI_SSID];
  const rssi = data[TELEMETRY_KEYS.SYSTEM.RSSI];
  const firmware = data[TELEMETRY_KEYS.SYSTEM.FIRMWARE_VERSION];
  const readTime = data[TELEMETRY_KEYS.SYSTEM.STATS_READ_TIME_MS];

  // RSSI signal strength indicator
  const getSignalStrength = (rssiVal: number | null): { bars: number; label: string; color: string } => {
    if (rssiVal === null) return { bars: 0, label: 'ไม่ทราบ', color: 'text-gray-400' };
    if (rssiVal >= -50) return { bars: 4, label: 'ดีมาก', color: 'text-green-500' };
    if (rssiVal >= -60) return { bars: 3, label: 'ดี', color: 'text-green-500' };
    if (rssiVal >= -70) return { bars: 2, label: 'ปานกลาง', color: 'text-yellow-500' };
    if (rssiVal >= -80) return { bars: 1, label: 'อ่อน', color: 'text-orange-500' };
    return { bars: 1, label: 'อ่อนมาก', color: 'text-red-500' };
  };

  const signal = getSignalStrength(rssi);

  const formatValue = (val: number | null, decimals = 0): string => {
    if (!isReady) return '--';
    if (isLoading) return '...';
    if (val === null) return '--';
    return formatNumber(val, decimals);
  };

  const formatString = (val: number | null): string => {
    if (!isReady) return '--';
    if (isLoading) return '...';
    if (val === null) return '--';
    return String(val);
  };

  return (
    <Card>
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* WiFi SSID */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">WiFi</p>
              <p className="text-sm font-medium text-gray-900 truncate">
                {formatString(wifiSsid)}
              </p>
            </div>
          </div>

          {/* Signal Strength */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Signal className={cn('w-5 h-5', signal.color)} />
            </div>
            <div>
              <p className="text-xs text-gray-500">สัญญาณ</p>
              <div className="flex items-center gap-2">
                {/* Signal bars */}
                <div className="flex items-end gap-0.5 h-4">
                  {[1, 2, 3, 4].map((bar) => (
                    <div
                      key={bar}
                      className={cn(
                        'w-1 rounded-full transition-all',
                        bar <= signal.bars ? signal.color.replace('text-', 'bg-') : 'bg-gray-200',
                        bar === 1 && 'h-1',
                        bar === 2 && 'h-2',
                        bar === 3 && 'h-3',
                        bar === 4 && 'h-4',
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {rssi !== null && isReady && !isLoading ? `${rssi} dBm` : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* Firmware */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Firmware</p>
              <p className="text-sm font-medium text-gray-900">
                {formatString(firmware)}
              </p>
            </div>
          </div>

          {/* Read Time */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Timer className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">เวลาอ่านข้อมูล</p>
              <p className="text-sm font-medium text-gray-900">
                {formatValue(readTime, 0)} ms
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
