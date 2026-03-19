import { Card } from '@/components/ui';
import {
  Droplets,
  Thermometer,
  Zap,
  FlaskConical,
  Leaf,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { getSoilKeys } from '@/config/dataKeys';
import { useT } from '@/i18n';

interface SoilNodeCardProps {
  nodeIndex: number;
  data: Record<string, number | null>;
  timestamps: Record<string, number>;
  isLoading: boolean;
  isReady: boolean;
  offsets?: Record<string, number>; // data_key → offset
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
  const displayValue = !isReady
    ? '--'
    : isLoading
      ? '...'
      : value !== null
        ? formatNumber(value, decimals)
        : '--';

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={cn('w-4 h-4 shrink-0', colorClass)} />
        <span className="text-sm text-slate-600 dark:text-slate-400 truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums truncate">
          {displayValue}
        </span>
        {displayValue !== '--' && displayValue !== '...' && unit && (
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400 flex-shrink-0">{unit}</span>
        )}
      </div>
    </div>
  );
}

export function SoilNodeCard({
  nodeIndex,
  data,
  timestamps,
  isLoading,
  isReady,
  offsets = {},
}: SoilNodeCardProps) {
  const { t } = useT();
  const keys = getSoilKeys(nodeIndex);

  // apply offset: ค่าจริง = raw + offset
  const applyOffset = (dataKey: string, raw: number | null): number | null => {
    if (raw === null) return null;
    const offset = offsets[dataKey] ?? 0;
    return raw + offset;
  };

  const moisture = applyOffset(keys.MOISTURE, data[keys.MOISTURE] ?? null);
  const temp     = applyOffset(keys.TEMP,     data[keys.TEMP]     ?? null);
  const ec       = applyOffset(keys.EC,       data[keys.EC]       ?? null);
  const ph       = applyOffset(keys.PH,       data[keys.PH]       ?? null);
  const n        = applyOffset(keys.N,        data[keys.N]        ?? null);
  const p        = applyOffset(keys.P,        data[keys.P]        ?? null);
  const k        = applyOffset(keys.K,        data[keys.K]        ?? null);

  const checkNodeOnlineStatus = () => {
    if (!isReady) return false;
    const now = Date.now();
    const maxAge = 5 * 60 * 1000;
    const moistureTs = timestamps[keys.MOISTURE] || 0;
    const tempTs     = timestamps[keys.TEMP]     || 0;
    // ใช้ raw data สำหรับตรวจสอบ online status (ไม่ใช้ค่าหลัง offset)
    const rawMoisture = data[keys.MOISTURE] ?? null;
    const rawTemp     = data[keys.TEMP]     ?? null;
    const hasRecentData = now - moistureTs < maxAge || now - tempTs < maxAge;
    const hasValue = rawMoisture !== null || rawTemp !== null;
    return hasRecentData && hasValue;
  };

  const isNodeOnline = checkNodeOnlineStatus();

  const getMoistureColor = (val: number | null) => {
    if (val === null) return 'bg-slate-50 border-slate-200';
    if (val < 30)     return 'bg-rose-50 border-rose-200';
    if (val < 60)     return 'bg-emerald-50 border-emerald-200';
    return 'bg-sky-50 border-sky-200';
  };

  const displayMoisture = !isReady ? '--' : isLoading ? '...' : moisture !== null ? formatNumber(moisture, 1) : '--';
  const displayTemp     = !isReady ? '--' : isLoading ? '...' : temp     !== null ? formatNumber(temp, 1)     : '--';

  return (
    <Card className={cn(
      'group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm',
      'hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200',
      'hover:ring-4 hover:ring-soil-50',
      'dark:bg-gray-800 dark:border-gray-700'
    )}>
      {/* Accent line + shimmer */}
      <div className="relative h-1 bg-soil-600 overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 opacity-40">
            <div className="h-full w-1/2 bg-white/70 animate-shimmer" />
          </div>
        )}
      </div>

      {/* Soft glow */}
      <div className="pointer-events-none absolute -top-6 -right-6 h-20 w-20 rounded-full bg-soil-100/40 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Header */}
      <div className="px-3 sm:px-4 pt-4 pb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-soil-50 ring-1 ring-soil-200 transition-transform duration-200 group-hover:scale-[1.04]">
            <span className="text-sm font-extrabold text-soil-800 tabular-nums">
              {nodeIndex}
            </span>
          </div>
          <span className="text-slate-900 dark:text-slate-100 font-semibold text-sm">
            {t('charts.node')} <span className="tabular-nums">{nodeIndex}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isReady && (
            isNodeOnline ? (
              <div className="flex items-center gap-1.5 border border-emerald-200 bg-emerald-50 px-2.5 py-1 rounded-full">
                <span className="relative w-2 h-2 rounded-full bg-emerald-500">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-pulse-soft opacity-70" />
                </span>
                <Wifi className="w-3.5 h-3.5 text-emerald-700" />
                <span className="text-xs font-medium text-emerald-700">{t('page.online')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 border border-rose-200 bg-rose-50 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <WifiOff className="w-3.5 h-3.5 text-rose-700" />
                <span className="text-xs font-medium text-rose-700">{t('page.offline')}</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 sm:px-4 pb-4">
        {/* Primary metrics */}
        <div className="grid grid-cols-2 gap-1 mb-4">

          {/* Moisture */}
          <div className={cn(
            'p-2 rounded-xl border transition-colors flex flex-col justify-between',
            'min-h-[96px] sm:min-h-[104px]',
            getMoistureColor(moisture)
          )}>
            <div className="flex items-center justify-center gap-1.5 mb-1 opacity-80">
              <Droplets className="w-3.5 h-3.5 text-sky-700" />
              <span className="text-[11px] font-medium text-slate-700">{t('dashboard.moisture')}</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center -mt-1">
              <span className="font-extrabold text-slate-900 tabular-nums leading-none text-2xl sm:text-3xl tracking-tight">
                {displayMoisture}
              </span>
              {displayMoisture !== '--' && displayMoisture !== '...' && (
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 mt-1">%RH</span>
              )}
            </div>
          </div>

          {/* Temperature */}
          <div className={cn(
            'p-2 rounded-xl border border-slate-200 bg-slate-50 transition-colors flex flex-col justify-between',
            'min-h-[96px] sm:min-h-[104px]',
            'dark:bg-gray-700 dark:border-gray-600'
          )}>
            <div className="flex items-center justify-center gap-1.5 mb-1 opacity-80">
              <Thermometer className="w-3.5 h-3.5 text-orange-700" />
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{t('dashboard.temperature')}</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center -mt-1">
              <span className="font-extrabold text-slate-900 dark:text-slate-100 tabular-nums leading-none text-2xl sm:text-3xl tracking-tight">
                {displayTemp}
              </span>
              {displayTemp !== '--' && displayTemp !== '...' && (
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-1">°C</span>
              )}
            </div>
          </div>
        </div>

        {/* Secondary metrics */}
        <div className="space-y-1 border-t border-slate-200 dark:border-gray-600 pt-2">
          <MiniSensor icon={Zap}          label="EC" value={ec} unit="µS/cm" colorClass="text-amber-600"  isLoading={isLoading} isReady={isReady} decimals={2} />
          <div className="border-t border-slate-100 dark:border-gray-700" />
          <MiniSensor icon={FlaskConical} label="pH" value={ph} unit=""       colorClass="text-violet-600" isLoading={isLoading} isReady={isReady} decimals={2} />

          {/* Nutrients */}
          <div className="pt-3 mt-2 border-t border-slate-200 dark:border-gray-600">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
              <Leaf className="w-4 h-4 text-slate-500" />
              {t('soil.nutrients')}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-2 border border-emerald-200 dark:border-emerald-700 transition-transform duration-200 group-hover:translate-y-[-1px]">
                <p className="text-xs text-slate-600 dark:text-slate-400">N</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {!isReady ? '--' : isLoading ? '...' : n !== null ? formatNumber(n, 0) : '--'}
                </p>
              </div>
              <div className="bg-sky-50 dark:bg-sky-900/30 rounded-xl p-2 border border-sky-200 dark:border-sky-700 transition-transform duration-200 group-hover:translate-y-[-1px]">
                <p className="text-xs text-slate-600 dark:text-slate-400">P</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {!isReady ? '--' : isLoading ? '...' : p !== null ? formatNumber(p, 0) : '--'}
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-2 border border-amber-200 dark:border-amber-700 transition-transform duration-200 group-hover:translate-y-[-1px]">
                <p className="text-xs text-slate-600 dark:text-slate-400">K</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {!isReady ? '--' : isLoading ? '...' : k !== null ? formatNumber(k, 0) : '--'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}