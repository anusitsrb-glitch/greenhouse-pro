import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui';
import { tbApi, TelemetryResponse } from '@/lib/tbApi';
import { AIR_TELEMETRY_KEYS, getSoilKeysArray, DISPLAY_NAMES, UNITS } from '@/config/dataKeys';
import { formatNumber } from '@/lib/utils';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';
import { Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { ExportButton } from './ExportButton'; // ← เพิ่มบรรทัดนี้

interface ChartsTabProps {
  project: string;
  gh: string;
  isReady: boolean;
}

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

const TIME_RANGES: { key: TimeRange; label: string; ms: number }[] = [
  { key: '1h', label: '1 ชั่วโมง', ms: 60 * 60 * 1000 },
  { key: '6h', label: '6 ชั่วโมง', ms: 6 * 60 * 60 * 1000 },
  { key: '24h', label: '24 ชั่วโมง', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', label: '7 วัน', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: '30d', label: '30 วัน', ms: 30 * 24 * 60 * 60 * 1000 },
];

const CHART_COLORS = {
  air_temp: '#ef4444',      // red
  air_humidity: '#3b82f6',  // blue
  air_co2: '#8b5cf6',       // purple
  air_light: '#eab308',     // yellow
  soil_moisture: '#22c55e', // green
  soil_temp: '#f97316',     // orange
};

export function ChartsTab({ project, gh, isReady }: ChartsTabProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('6h');
  const [airData, setAirData] = useState<any[]>([]);
  const [soilData, setSoilData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSoilNode, setSelectedSoilNode] = useState(1);

  const fetchChartData = async () => {
    if (!isReady) return;

    setIsLoading(true);
    setError(null);

    const range = TIME_RANGES.find(r => r.key === timeRange)!;
    const endTs = Date.now();
    const startTs = endTs - range.ms;

    // Determine aggregation based on time range
    let interval: number | undefined;
    let agg: string | undefined;
    let limit = 100;

    if (timeRange === '1h') {
      interval = 60000; // 1 min
      agg = 'AVG';
    } else if (timeRange === '6h') {
      interval = 300000; // 5 min
      agg = 'AVG';
    } else if (timeRange === '24h') {
      interval = 900000; // 15 min
      agg = 'AVG';
    } else if (timeRange === '7d') {
      interval = 3600000; // 1 hour
      agg = 'AVG';
    } else {
      interval = 86400000; // 1 day
      agg = 'AVG';
    }

    try {
      // Fetch air data
      const airResponse = await tbApi.getTimeseries(
        project, gh, AIR_TELEMETRY_KEYS, startTs, endTs,
        { interval, agg, limit }
      );

      // Fetch soil data for selected node
      const soilKeys = getSoilKeysArray(selectedSoilNode);
      const soilResponse = await tbApi.getTimeseries(
        project, gh, soilKeys.slice(0, 2), startTs, endTs, // Only moisture & temp
        { interval, agg, limit }
      );

      // Transform air data for recharts
      const airChartData = transformToChartData(airResponse, AIR_TELEMETRY_KEYS);
      setAirData(airChartData);

      // Transform soil data
      const soilChartData = transformToChartData(soilResponse, soilKeys.slice(0, 2));
      setSoilData(soilChartData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลกราฟได้');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();
  }, [project, gh, timeRange, selectedSoilNode, isReady]);

  // Transform telemetry response to recharts format
  function transformToChartData(response: TelemetryResponse, keys: string[]): any[] {
    const dataMap = new Map<number, any>();

    for (const key of keys) {
      const values = response[key] || [];
      for (const point of values) {
        if (!dataMap.has(point.ts)) {
          dataMap.set(point.ts, { timestamp: point.ts });
        }
        const entry = dataMap.get(point.ts);
        entry[key] = typeof point.value === 'number' ? point.value : parseFloat(String(point.value));
      }
    }

    return Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    if (timeRange === '1h' || timeRange === '6h') {
      return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    } else if (timeRange === '24h') {
      return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-white shadow-lg rounded-lg p-3 border border-gray-200">
        <p className="text-sm text-gray-600 mb-2">
          {new Date(label).toLocaleString('th-TH')}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }} 
            />
            <span className="text-gray-600">{DISPLAY_NAMES[entry.dataKey] || entry.dataKey}:</span>
            <span className="font-semibold">
              {formatNumber(entry.value, 1)} {UNITS[entry.dataKey] || ''}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // ← เพิ่มส่วนนี้: รวม telemetry keys สำหรับ export
  const exportTelemetryKeys = useMemo(() => {
    const soilKeys = getSoilKeysArray(selectedSoilNode);
    return [...AIR_TELEMETRY_KEYS, ...soilKeys];
  }, [selectedSoilNode]);

  if (!isReady) {
    return (
      <Card className="p-6 text-center text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>โรงเรือนนี้ยังไม่พร้อมแสดงกราฟ</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">ช่วงเวลา:</span>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {TIME_RANGES.map((range) => (
              <button
                key={range.key}
                onClick={() => setTimeRange(range.key)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  timeRange === range.key
                    ? 'bg-white text-primary font-medium shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* ← เพิ่มส่วนนี้: ปุ่ม Export และ Refresh */}
        <div className="flex items-center gap-2">
          <ExportButton 
            projectKey={project}
            ghKey={gh}
            telemetryKeys={exportTelemetryKeys}
            disabled={isLoading || !isReady}
          />
          
          <button
            onClick={fetchChartData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Air Chart */}
      <Card>
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">📊 กราฟค่าอากาศ</h3>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-gray-400">
              กำลังโหลด...
            </div>
          ) : airData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400">
              ไม่มีข้อมูล
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={airData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatXAxis}
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <YAxis 
                  yAxisId="temp"
                  orientation="left"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  label={{ value: '°C / %', angle: -90, position: 'insideLeft', fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="co2"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  label={{ value: 'ppm', angle: 90, position: 'insideRight', fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  yAxisId="temp"
                  type="monotone" 
                  dataKey="air_temp" 
                  name="อุณหภูมิ"
                  stroke={CHART_COLORS.air_temp} 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  yAxisId="temp"
                  type="monotone" 
                  dataKey="air_humidity" 
                  name="ความชื้น"
                  stroke={CHART_COLORS.air_humidity} 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  yAxisId="co2"
                  type="monotone" 
                  dataKey="air_co2" 
                  name="CO₂"
                  stroke={CHART_COLORS.air_co2} 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Soil Chart */}
      <Card>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">🌱 กราฟค่าดิน</h3>
          <select
            value={selectedSoilNode}
            onChange={(e) => setSelectedSoilNode(parseInt(e.target.value))}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i + 1} value={i + 1}>จุดที่ {i + 1}</option>
            ))}
          </select>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-gray-400">
              กำลังโหลด...
            </div>
          ) : soilData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400">
              ไม่มีข้อมูล
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={soilData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatXAxis}
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey={`soil${selectedSoilNode}_moisture`}
                  name="ความชื้นดิน (%)"
                  stroke={CHART_COLORS.soil_moisture} 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey={`soil${selectedSoilNode}_temp`}
                  name="อุณหภูมิดิน (°C)"
                  stroke={CHART_COLORS.soil_temp} 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}