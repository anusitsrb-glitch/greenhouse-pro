import { useEffect, useState } from 'react';
import { useT } from '@/i18n';
import { AirSensorCard } from './AirSensorCard';
import { SoilNodeCard } from './SoilNodeCard';
import { SystemInfoCard } from './SystemInfoCard';
import { useTelemetry } from '@/hooks/useTelemetry';
import {
  AIR_TELEMETRY_KEYS,
  SYSTEM_TELEMETRY_KEYS,
  getSoilKeysArray,
} from '@/config/dataKeys';
import { RefreshCw, Clock } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface SoilTabProps {
  project: string;
  gh: string;
  isReady: boolean;
}

const DEFAULT_NODE_COUNT = 10;

function getNodeIndices(sensors: { sensor_key: string; sensor_type: string; is_active: number }[]): number[] {
  const indices = new Set<number>();
  for (const s of sensors) {
    if (s.sensor_type !== 'soil' || !s.is_active) continue;
    const match = s.sensor_key.match(/^soil(\d+)_/);
    if (match) indices.add(Number(match[1]));
  }
  return Array.from(indices).sort((a, b) => a - b);
}

export function SoilTab({ project, gh, isReady }: SoilTabProps) {
  const { t } = useT();

  // ---- Dynamic node count จาก DB ----
  const [nodeIndices, setNodeIndices] = useState<number[]>(
    Array.from({ length: DEFAULT_NODE_COUNT }, (_, i) => i + 1)
  );

  useEffect(() => {
    if (!project || !gh) return;
    fetch(`/api/admin/sensors/${project}/${gh}`)
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (!json?.data?.sensors?.length) return; // fallback
        const indices = getNodeIndices(json.data.sensors);
        if (indices.length > 0) setNodeIndices(indices);
      })
      .catch(() => {
        // เงียบ — ใช้ fallback 10 node
      });
  }, [project, gh]);

  // สร้าง soil keys ตาม node ที่มีจริง
  const allSoilKeys = nodeIndices.flatMap((i) => getSoilKeysArray(i));

  const airData = useTelemetry({
    project, gh, keys: AIR_TELEMETRY_KEYS, enabled: isReady, pollInterval: 60000,
  });
  const soilData = useTelemetry({
    project, gh, keys: allSoilKeys, enabled: isReady, pollInterval: 60000,
  });
  const systemData = useTelemetry({
    project, gh, keys: SYSTEM_TELEMETRY_KEYS, enabled: isReady, pollInterval: 60000,
  });

  const handleRefresh = () => {
    airData.refetch();
    soilData.refetch();
    systemData.refetch();
  };

  const isLoading = airData.isLoading || soilData.isLoading;
  const lastUpdated = airData.lastUpdated || soilData.lastUpdated;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Clock className="w-4 h-4" />
          <span>{t('dashboard.lastUpdate')}: {lastUpdated ? formatDateTime(new Date(lastUpdated)) : '--'}</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </button>
      </div>

      {/* Air Sensors */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-accent rounded-full"></span>
          {t('soil.airSection')}
        </h2>
        <AirSensorCard
          data={airData.data}
          timestamps={airData.timestamps}
          isLoading={airData.isLoading}
          isReady={isReady}
        />
      </section>

      {/* Soil Sensors */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-soil-600 rounded-full"></span>
          {t('soil.soilSection')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {nodeIndices.map((nodeIndex) => (
            <SoilNodeCard
              key={nodeIndex}
              nodeIndex={nodeIndex}
              data={soilData.data}
              timestamps={soilData.timestamps}
              isLoading={soilData.isLoading}
              isReady={isReady}
            />
          ))}
        </div>
      </section>

      {/* System Info */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-gray-400 rounded-full"></span>
          {t('soil.systemSection')}
        </h2>
        <SystemInfoCard
          data={systemData.data}
          isLoading={systemData.isLoading}
          isReady={isReady}
        />
      </section>
    </div>
  );
}