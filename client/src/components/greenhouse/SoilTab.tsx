import { useState } from 'react';
import { AirSensorCard } from './AirSensorCard';
import { SoilNodeCard } from './SoilNodeCard';
import { SystemInfoCard } from './SystemInfoCard';
import { useTelemetry } from '@/hooks/useTelemetry';
import { 
  AIR_TELEMETRY_KEYS, 
  SYSTEM_TELEMETRY_KEYS,
  getSoilKeysArray 
} from '@/config/dataKeys';
import { RefreshCw, Clock } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface SoilTabProps {
  project: string;
  gh: string;
  isReady: boolean;
}

// Generate all soil keys for nodes 1-10
const ALL_SOIL_KEYS = Array.from({ length: 10 }, (_, i) => getSoilKeysArray(i + 1)).flat();

export function SoilTab({ project, gh, isReady }: SoilTabProps) {
  // Fetch air telemetry
  const airData = useTelemetry({
    project,
    gh,
    keys: AIR_TELEMETRY_KEYS,
    enabled: isReady,
    pollInterval: 60000, // 60 seconds
  });

  // Fetch soil telemetry
  const soilData = useTelemetry({
    project,
    gh,
    keys: ALL_SOIL_KEYS,
    enabled: isReady,
    pollInterval: 60000,
  });

  // Fetch system info
  const systemData = useTelemetry({
    project,
    gh,
    keys: SYSTEM_TELEMETRY_KEYS,
    enabled: isReady,
    pollInterval: 60000,
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
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>
            อัปเดตล่าสุด: {lastUpdated ? formatDateTime(new Date(lastUpdated)) : '--'}
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          รีเฟรช
        </button>
      </div>

      {/* Air Sensors Section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-accent rounded-full"></span>
          ค่าอากาศ
        </h2>
        <AirSensorCard
          data={airData.data}
          isLoading={airData.isLoading}
          isReady={isReady}
        />
      </section>

      {/* Soil Sensors Section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-soil-600 rounded-full"></span>
          ค่าดิน (10 จุด)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }, (_, i) => (
            <SoilNodeCard
              key={i + 1}
              nodeIndex={i + 1}
              data={soilData.data}
              isLoading={soilData.isLoading}
              isReady={isReady}
            />
          ))}
        </div>
      </section>

      {/* System Info Section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-gray-400 rounded-full"></span>
          ข้อมูลระบบ
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
