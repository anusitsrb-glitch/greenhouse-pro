import { useState, useEffect } from 'react';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { tbApi } from '@/lib/tbApi';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts';
import { RefreshCw, TrendingUp, BarChart3, Layers } from 'lucide-react';

interface EnhancedChartsProps {
  projectKey: string;
  ghKey: string;
}

// All available sensor types
const SENSOR_TYPES = {
  air: [
    { key: 'air_temp', name: 'อุณหภูมิอากาศ', unit: '°C', color: '#ef4444' },
    { key: 'air_humidity', name: 'ความชื้นอากาศ', unit: '%', color: '#3b82f6' },
    { key: 'air_co2', name: 'CO₂', unit: 'ppm', color: '#8b5cf6' },
    { key: 'air_light', name: 'แสง', unit: 'lux', color: '#f59e0b' },
  ],
  soil: [
    { key: 'moisture', name: 'ความชื้นดิน', unit: '%', color: '#3b82f6' },
    { key: 'temp', name: 'อุณหภูมิดิน', unit: '°C', color: '#ef4444' },
    { key: 'n', name: 'ไนโตรเจน (N)', unit: 'mg/kg', color: '#22c55e' },
    { key: 'p', name: 'ฟอสฟอรัส (P)', unit: 'mg/kg', color: '#f97316' },
    { key: 'k', name: 'โพแทสเซียม (K)', unit: 'mg/kg', color: '#a855f7' },
    { key: 'ec', name: 'ค่า EC', unit: 'mS/cm', color: '#06b6d4' },
    { key: 'ph', name: 'ค่า pH', unit: '', color: '#ec4899' },
  ],
};

const TIME_RANGES = [
  { value: '1h', label: '1 ชั่วโมง', ms: 60 * 60 * 1000 },
  { value: '6h', label: '6 ชั่วโมง', ms: 6 * 60 * 60 * 1000 },
  { value: '24h', label: '24 ชั่วโมง', ms: 24 * 60 * 60 * 1000 },
  { value: '7d', label: '7 วัน', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: '30d', label: '30 วัน', ms: 30 * 24 * 60 * 60 * 1000 },
];

const CHART_TYPES = [
  { value: 'line', label: 'เส้น', icon: TrendingUp },
  { value: 'area', label: 'พื้นที่', icon: Layers },
  { value: 'bar', label: 'แท่ง', icon: BarChart3 },
];

const SOIL_POINTS = Array.from({ length: 10 }, (_, i) => i + 1);

function toNumberOrNull(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  }
  // boolean หรืออย่างอื่น
  return null;
}

export function EnhancedCharts({ projectKey, ghKey }: EnhancedChartsProps) {
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);

  // View mode: 'single' or 'compare'
  const [viewMode, setViewMode] = useState<'single' | 'compare'>('single');

  // Selected options
  const [timeRange, setTimeRange] = useState('24h');
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>('line');
  const [selectedAirSensors, setSelectedAirSensors] = useState<string[]>(['air_temp', 'air_humidity']);
  const [selectedSoilType, setSelectedSoilType] = useState('moisture');
  const [selectedSoilPoints, setSelectedSoilPoints] = useState<number[]>([1, 2, 3]);

  // Compare mode options
  const [compareSensorType, setCompareSensorType] = useState('moisture');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const range = TIME_RANGES.find((r) => r.value === timeRange);
      const endTime = Date.now();
      const startTime = endTime - (range?.ms || 24 * 60 * 60 * 1000);

      // Build keys to fetch
      let keys: string[] = [];

      if (viewMode === 'single') {
        keys = [...selectedAirSensors];
        selectedSoilPoints.forEach((point) => {
          keys.push(`soil${point}_${selectedSoilType}`);
        });
      } else {
        // Compare mode: all 10 points of selected sensor type
        SOIL_POINTS.forEach((point) => {
          keys.push(`soil${point}_${compareSensorType}`);
        });
      }

      const data = await tbApi.getTimeseries(projectKey, ghKey, keys, startTime, endTime);

      if (data) {
        // Transform data for recharts
        const timestamps = new Set<number>();
        Object.values(data).forEach((values: any) => {
          (values || []).forEach((v: any) => timestamps.add(v.ts));
        });

        const sortedTimestamps = Array.from(timestamps).sort((a, b) => a - b);

        const rows = sortedTimestamps.map((ts) => {
          const row: any = {
            timestamp: ts,
            time: new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
            date: new Date(ts).toLocaleDateString('th-TH'),
          };

          keys.forEach((k) => {
            const v = data[k]?.find((x: any) => x.ts === ts);
            // v.value อาจเป็น string|number|boolean
            row[k] = v ? toNumberOrNull(v.value) : null;
          });

          return row;
        });

        setChartData(rows);
      } else {
        setChartData([]);
      }
    } catch (error) {
      addToast('error', 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey, ghKey, timeRange, viewMode, selectedAirSensors, selectedSoilType, selectedSoilPoints, compareSensorType]);

  const toggleAirSensor = (key: string) => {
    setSelectedAirSensors((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const toggleSoilPoint = (point: number) => {
    setSelectedSoilPoints((prev) => (prev.includes(point) ? prev.filter((p) => p !== point) : [...prev, point]));
  };

  const renderChart = () => {
    if (chartData.length === 0) {
      return <div className="h-80 flex items-center justify-center text-gray-500">ไม่มีข้อมูล</div>;
    }

    // Determine which keys to show
    let keysToShow: { key: string; name: string; color: string }[] = [];

    if (viewMode === 'single') {
      // Air sensors
      selectedAirSensors.forEach((k) => {
        const sensor = SENSOR_TYPES.air.find((s) => s.key === k);
        if (sensor) keysToShow.push({ key: k, name: sensor.name, color: sensor.color });
      });
      // Soil sensors
      selectedSoilPoints.forEach((point) => {
        const soilType = SENSOR_TYPES.soil.find((s) => s.key === selectedSoilType);
        if (soilType) {
          keysToShow.push({
            key: `soil${point}_${selectedSoilType}`,
            name: `${soilType.name} จุด ${point}`,
            color: `hsl(${(point - 1) * 36}, 70%, 50%)`,
          });
        }
      });
    } else {
      // Compare mode: all 10 points
      SOIL_POINTS.forEach((point) => {
        keysToShow.push({
          key: `soil${point}_${compareSensorType}`,
          name: `จุด ${point}`,
          color: `hsl(${(point - 1) * 36}, 70%, 50%)`,
        });
      });
    }

    const common = {
      data: chartData,
    };

    return (
      <ResponsiveContainer width="100%" height={400}>
        {chartType === 'area' ? (
          <AreaChart {...common}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip
              labelFormatter={(value, payload) => {
                if (payload && payload[0]) {
                  return new Date(payload[0].payload.timestamp).toLocaleString('th-TH');
                }
                return String(value);
              }}
            />
            <Legend />
            {keysToShow.map(({ key, name, color }) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={name}
                stroke={color}
                fill={color}
                fillOpacity={0.3}
                dot={false}
                connectNulls
              />
            ))}
          </AreaChart>
        ) : chartType === 'bar' ? (
          <BarChart {...common}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip
              labelFormatter={(value, payload) => {
                if (payload && payload[0]) {
                  return new Date(payload[0].payload.timestamp).toLocaleString('th-TH');
                }
                return String(value);
              }}
            />
            <Legend />
            {keysToShow.map(({ key, name, color }) => (
              <Bar key={key} dataKey={key} name={name} fill={color} />
            ))}
          </BarChart>
        ) : (
          <LineChart {...common}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip
              labelFormatter={(value, payload) => {
                if (payload && payload[0]) {
                  return new Date(payload[0].payload.timestamp).toLocaleString('th-TH');
                }
                return String(value);
              }}
            />
            <Legend />
            {keysToShow.map(({ key, name, color }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={name}
                stroke={color}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          {/* View Mode */}
          <div className="flex gap-2">
            <Button variant={viewMode === 'single' ? 'primary' : 'outline'} size="sm" onClick={() => setViewMode('single')}>
              เลือก Sensor
            </Button>
            <Button
              variant={viewMode === 'compare' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setViewMode('compare')}
            >
              เปรียบเทียบ 10 จุด
            </Button>
          </div>

          {/* Time Range */}
          <div className="flex gap-1 flex-wrap">
            {TIME_RANGES.map((range) => (
              <Button
                key={range.value}
                variant={timeRange === range.value ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setTimeRange(range.value)}
              >
                {range.label}
              </Button>
            ))}
          </div>

          {/* Chart Type */}
          <div className="flex gap-1">
            {CHART_TYPES.map((type) => (
              <Button
                key={type.value}
                variant={chartType === type.value ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setChartType(type.value as 'line' | 'area' | 'bar')}
              >
                <type.icon className="w-4 h-4" />
              </Button>
            ))}
          </div>

          {/* Refresh */}
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </Card>

      {/* Sensor Selection */}
      {viewMode === 'single' ? (
        <Card className="p-4">
          <div className="space-y-4">
            {/* Air Sensors */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Sensor อากาศ</h4>
              <div className="flex flex-wrap gap-2">
                {SENSOR_TYPES.air.map((sensor) => (
                  <button
                    key={sensor.key}
                    onClick={() => toggleAirSensor(sensor.key)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      selectedAirSensors.includes(sensor.key)
                        ? 'text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    style={{
                      backgroundColor: selectedAirSensors.includes(sensor.key) ? sensor.color : undefined,
                    }}
                  >
                    {sensor.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Soil Sensor Type */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">ประเภทค่าดิน</h4>
              <div className="flex flex-wrap gap-2">
                {SENSOR_TYPES.soil.map((sensor) => (
                  <button
                    key={sensor.key}
                    onClick={() => setSelectedSoilType(sensor.key)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      selectedSoilType === sensor.key ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    style={{
                      backgroundColor: selectedSoilType === sensor.key ? sensor.color : undefined,
                    }}
                  >
                    {sensor.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Soil Points */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">จุดวัดดิน</h4>
              <div className="flex flex-wrap gap-2">
                {SOIL_POINTS.map((point) => (
                  <button
                    key={point}
                    onClick={() => toggleSoilPoint(point)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                      selectedSoilPoints.includes(point) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {point}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">เปรียบเทียบค่า (ทั้ง 10 จุด)</h4>
          <div className="flex flex-wrap gap-2">
            {SENSOR_TYPES.soil.map((sensor) => (
              <button
                key={sensor.key}
                onClick={() => setCompareSensorType(sensor.key)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  compareSensorType === sensor.key ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={{
                  backgroundColor: compareSensorType === sensor.key ? sensor.color : undefined,
                }}
              >
                {sensor.name}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Chart */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">
          {viewMode === 'compare'
            ? `เปรียบเทียบ ${SENSOR_TYPES.soil.find((s) => s.key === compareSensorType)?.name} ทั้ง 10 จุด`
            : 'กราฟข้อมูล Sensor'}
        </h3>
        {isLoading ? (
          <div className="h-80 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          renderChart()
        )}
      </Card>
    </div>
  );
}
