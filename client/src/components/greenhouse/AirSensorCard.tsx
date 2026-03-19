import { Card } from '@/components/ui';
import { Thermometer, Droplets, Wind, Sun, AlertCircle } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { TELEMETRY_KEYS } from '@/config/dataKeys';
import { useT } from '@/i18n';

interface AirSensorCardProps {
  data: Record<string, number | null>;
  timestamps: Record<string, number>;
  isLoading: boolean;
  isReady: boolean;
  offsets?: Record<string, number>; // data_key → offset
}

interface SensorDisplayProps {
  icon: typeof Thermometer;
  label: string;
  value: number | null;
  timestamp: number;
  unit: string;
  colorClass: string;
  bgClass: string;
  isLoading: boolean;
  isReady: boolean;
  decimals?: number;
  warningThresholds?: {
    min?: number;
    max?: number;
    message?: string;
  };
}

function SensorDisplay({
  icon: Icon,
  label,
  value,
  timestamp,
  unit,
  colorClass,
  bgClass,
  isLoading,
  isReady,
  decimals = 1,
  warningThresholds,
}: SensorDisplayProps) {
  const { t } = useT();

  const displayValue = !isReady ? '--' : 
    isLoading ? '...' : 
    value !== null ? formatNumber(value, decimals) : '--';

  const isDataStale = () => {
    if (!isReady || !timestamp) return false;
    const now = Date.now();
    const maxAge = 5 * 60 * 1000;
    return (now - timestamp) > maxAge;
  };

  const isOutOfRange = () => {
    if (!warningThresholds || value === null) return false;
    if (warningThresholds.min !== undefined && value < warningThresholds.min) return true;
    if (warningThresholds.max !== undefined && value > warningThresholds.max) return true;
    return false;
  };

  const showWarning = isDataStale() || isOutOfRange();
  const warningMessage = isDataStale()
    ? t('air.staleData')
    : warningThresholds?.message || t('air.outOfRange');

  return (
    <div className={cn(
      'flex items-center gap-3 p-4 rounded-xl transition-all',
      showWarning ? 'bg-red-50 border-2 border-red-300 dark:bg-red-950 dark:border-red-700' : 'bg-gray-50 dark:bg-gray-700'
    )}>
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', bgClass)}>
        <Icon className={cn('w-6 h-6', colorClass)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {displayValue}
          </span>
          {displayValue !== '--' && displayValue !== '...' && (
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 flex-shrink-0">{unit}</span>
          )}
        </div>
        {showWarning && value !== null && (
          <div className="flex items-center gap-1 mt-1">
            <AlertCircle className="w-3 h-3 text-red-600" />
            <span className="text-xs text-red-600 font-medium truncate">{warningMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function AirSensorCard({ data, timestamps, isLoading, isReady, offsets = {} }: AirSensorCardProps) {
  const { t } = useT();

  // apply offset: ค่าจริง = raw + offset
  const applyOffset = (key: string, raw: number | null): number | null => {
    if (raw === null) return null;
    const offset = offsets[key] ?? 0;
    return raw + offset;
  };

  const sensors = [
    {
      key: TELEMETRY_KEYS.AIR.TEMP,
      icon: Thermometer,
      label: t('air.temperature'),
      unit: '°C',
      colorClass: 'text-red-500',
      bgClass: 'bg-red-100',
      decimals: 1,
      warningThresholds: {
        min: 15,
        max: 40,
        message: t('air.tempWarning'),
      },
    },
    {
      key: TELEMETRY_KEYS.AIR.HUMIDITY,
      icon: Droplets,
      label: t('air.humidity'),
      unit: '%RH',
      colorClass: 'text-blue-500',
      bgClass: 'bg-blue-100',
      decimals: 1,
      warningThresholds: {
        min: 20,
        max: 95,
        message: t('air.humidityWarning'),
      },
    },
    {
      key: TELEMETRY_KEYS.AIR.CO2,
      icon: Wind,
      label: 'CO₂',
      unit: 'ppm',
      colorClass: 'text-purple-500',
      bgClass: 'bg-purple-100',
      decimals: 0,
      warningThresholds: {
        max: 2000,
        message: t('air.co2Warning'),
      },
    },
    {
      key: TELEMETRY_KEYS.AIR.LIGHT,
      icon: Sun,
      label: t('air.light'),
      unit: 'lux',
      colorClass: 'text-yellow-500',
      bgClass: 'bg-yellow-100',
      decimals: 0,
    },
  ];

  return (
    <Card className="overflow-hidden dark:bg-gray-800">
      <div className="h-1 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500" />
      <div className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {sensors.map((sensor) => (
            <SensorDisplay
              key={sensor.key}
              icon={sensor.icon}
              label={sensor.label}
              value={applyOffset(sensor.key, data[sensor.key] ?? null)}
              timestamp={timestamps[sensor.key] || 0}
              unit={sensor.unit}
              colorClass={sensor.colorClass}
              bgClass={sensor.bgClass}
              isLoading={isLoading}
              isReady={isReady}
              decimals={sensor.decimals}
              warningThresholds={sensor.warningThresholds}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}