import { Card } from '@/components/ui';
import { Thermometer, Droplets, Wind, Sun } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { TELEMETRY_KEYS } from '@/config/dataKeys';

interface AirSensorCardProps {
  data: Record<string, number | null>;
  isLoading: boolean;
  isReady: boolean;
}

interface SensorDisplayProps {
  icon: typeof Thermometer;
  label: string;
  value: number | null;
  unit: string;
  colorClass: string;
  bgClass: string;
  isLoading: boolean;
  isReady: boolean;
  decimals?: number;
}

function SensorDisplay({
  icon: Icon,
  label,
  value,
  unit,
  colorClass,
  bgClass,
  isLoading,
  isReady,
  decimals = 1,
}: SensorDisplayProps) {
  const displayValue = !isReady ? '--' : 
    isLoading ? '...' : 
    value !== null ? formatNumber(value, decimals) : '--';

  return (
    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', bgClass)}>
        <Icon className={cn('w-6 h-6', colorClass)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900">
          {displayValue}
          {displayValue !== '--' && displayValue !== '...' && (
            <span className="text-base font-normal text-gray-500 ml-1">{unit}</span>
          )}
        </p>
      </div>
    </div>
  );
}

export function AirSensorCard({ data, isLoading, isReady }: AirSensorCardProps) {
  const sensors = [
    {
      key: TELEMETRY_KEYS.AIR.TEMP,
      icon: Thermometer,
      label: 'อุณหภูมิอากาศ',
      unit: '°C',
      colorClass: 'text-red-500',
      bgClass: 'bg-red-100',
      decimals: 1,
    },
    {
      key: TELEMETRY_KEYS.AIR.HUMIDITY,
      icon: Droplets,
      label: 'ความชื้นอากาศ',
      unit: '%',
      colorClass: 'text-blue-500',
      bgClass: 'bg-blue-100',
      decimals: 1,
    },
    {
      key: TELEMETRY_KEYS.AIR.CO2,
      icon: Wind,
      label: 'CO₂',
      unit: 'ppm',
      colorClass: 'text-purple-500',
      bgClass: 'bg-purple-100',
      decimals: 0,
    },
    {
      key: TELEMETRY_KEYS.AIR.LIGHT,
      icon: Sun,
      label: 'แสง',
      unit: 'lux',
      colorClass: 'text-yellow-500',
      bgClass: 'bg-yellow-100',
      decimals: 0,
    },
  ];

  return (
    <Card className="overflow-hidden">
      {/* Gradient accent */}
      <div className="h-1 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500" />
      
      <div className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {sensors.map((sensor) => (
            <SensorDisplay
              key={sensor.key}
              icon={sensor.icon}
              label={sensor.label}
              value={data[sensor.key] ?? null}
              unit={sensor.unit}
              colorClass={sensor.colorClass}
              bgClass={sensor.bgClass}
              isLoading={isLoading}
              isReady={isReady}
              decimals={sensor.decimals}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
