import { useState } from 'react';
import { Card } from '@/components/ui';
import { 
  Droplets, 
  Thermometer, 
  Zap, 
  FlaskConical,
  Leaf,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { getSoilKeys } from '@/config/dataKeys';

interface SoilNodeCardProps {
  nodeIndex: number;
  data: Record<string, number | null>;
  isLoading: boolean;
  isReady: boolean;
}

interface MiniSensorProps {
  icon: typeof Droplets;
  label: string;
  value: number | null;
  unit: string;
  colorClass: string;
  isLoading: boolean;
  isReady: boolean;
  decimals?: number;
}

function MiniSensor({
  icon: Icon,
  label,
  value,
  unit,
  colorClass,
  isLoading,
  isReady,
  decimals = 1,
}: MiniSensorProps) {
  const displayValue = !isReady ? '--' :
    isLoading ? '...' :
    value !== null ? formatNumber(value, decimals) : '--';

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Icon className={cn('w-4 h-4', colorClass)} />
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <div className="text-sm font-semibold text-gray-900">
        {displayValue}
        {displayValue !== '--' && displayValue !== '...' && (
          <span className="font-normal text-gray-500 ml-0.5">{unit}</span>
        )}
      </div>
    </div>
  );
}

export function SoilNodeCard({ nodeIndex, data, isLoading, isReady }: SoilNodeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const keys = getSoilKeys(nodeIndex);

  // Primary values (always shown)
  const moisture = data[keys.MOISTURE] ?? null;
  const temp = data[keys.TEMP] ?? null;

  // Secondary values (shown when expanded)
  const ec = data[keys.EC] ?? null;
  const ph = data[keys.PH] ?? null;
  const n = data[keys.N] ?? null;
  const p = data[keys.P] ?? null;
  const k = data[keys.K] ?? null;

  // Determine moisture status color
  const getMoistureColor = (val: number | null) => {
    if (val === null) return 'bg-gray-100';
    if (val < 30) return 'bg-red-100'; // Too dry
    if (val < 60) return 'bg-green-100'; // Optimal
    return 'bg-blue-100'; // Too wet
  };

  const displayMoisture = !isReady ? '--' :
    isLoading ? '...' :
    moisture !== null ? formatNumber(moisture, 1) : '--';

  const displayTemp = !isReady ? '--' :
    isLoading ? '...' :
    temp !== null ? formatNumber(temp, 1) : '--';

  return (
    <Card className="overflow-hidden">
      {/* Header with node number */}
      <div className="bg-soil-600 px-4 py-2 flex items-center justify-between">
        <span className="text-white font-semibold">จุดที่ {nodeIndex}</span>
        <div className={cn(
          'w-2 h-2 rounded-full',
          isReady && !isLoading && moisture !== null ? 'bg-green-400' : 'bg-gray-400'
        )} />
      </div>

      {/* Main content */}
      <div className="p-4">
        {/* Primary metrics */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Moisture */}
          <div className={cn('p-3 rounded-lg', getMoistureColor(moisture))}>
            <div className="flex items-center gap-1.5 mb-1">
              <Droplets className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-gray-600">ความชื้น</span>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {displayMoisture}
              {displayMoisture !== '--' && displayMoisture !== '...' && (
                <span className="text-sm font-normal text-gray-500">%</span>
              )}
            </p>
          </div>

          {/* Temperature */}
          <div className="p-3 rounded-lg bg-orange-50">
            <div className="flex items-center gap-1.5 mb-1">
              <Thermometer className="w-4 h-4 text-orange-600" />
              <span className="text-xs text-gray-600">อุณหภูมิ</span>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {displayTemp}
              {displayTemp !== '--' && displayTemp !== '...' && (
                <span className="text-sm font-normal text-gray-500">°C</span>
              )}
            </p>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center gap-1 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          {isExpanded ? (
            <>
              <span>ซ่อนรายละเอียด</span>
              <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              <span>ดูเพิ่มเติม</span>
              <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="pt-2 border-t border-gray-100 space-y-1">
            <MiniSensor
              icon={Zap}
              label="EC"
              value={ec}
              unit="mS/cm"
              colorClass="text-amber-500"
              isLoading={isLoading}
              isReady={isReady}
              decimals={2}
            />
            <MiniSensor
              icon={FlaskConical}
              label="pH"
              value={ph}
              unit=""
              colorClass="text-purple-500"
              isLoading={isLoading}
              isReady={isReady}
              decimals={2}
            />
            <div className="pt-2 mt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <Leaf className="w-3 h-3" />
                ธาตุอาหาร (mg/kg)
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500">N</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {!isReady ? '--' : isLoading ? '...' : n !== null ? formatNumber(n, 0) : '--'}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500">P</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {!isReady ? '--' : isLoading ? '...' : p !== null ? formatNumber(p, 0) : '--'}
                  </p>
                </div>
                <div className="bg-orange-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500">K</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {!isReady ? '--' : isLoading ? '...' : k !== null ? formatNumber(k, 0) : '--'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
