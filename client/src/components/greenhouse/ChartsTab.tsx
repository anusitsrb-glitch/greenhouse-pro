import { useState, useEffect } from 'react';
import { Card } from '@/components/ui';
import { tbApi, TelemetryResponse } from '@/lib/tbApi';
import { AIR_TELEMETRY_KEYS, getSoilKeys, DISPLAY_NAMES, UNITS } from '@/config/dataKeys';
import { formatNumber } from '@/lib/utils';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend 
} from 'recharts';
import { 
  Clock, RefreshCw, AlertCircle, Maximize2, X, Eye, EyeOff
} from 'lucide-react';
import { EnhancedExportButton } from './EnhancedExportButton';

interface ChartsTabProps {
  project: string;
  gh: string;
  isReady: boolean;
}

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d' | 'custom';

const TIME_RANGES: { key: TimeRange; label: string; ms: number }[] = [
  { key: '1h', label: '1 ชั่วโมง', ms: 60 * 60 * 1000 },
  { key: '6h', label: '6 ชั่วโมง', ms: 6 * 60 * 60 * 1000 },
  { key: '24h', label: '24 ชั่วโมง', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', label: '7 วัน', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: '30d', label: '30 วัน', ms: 30 * 24 * 60 * 60 * 1000 },
  { key: 'custom', label: 'กำหนดเอง', ms: 0 },
];

const CHART_COLORS = {
  air_temp: '#ef4444',
  air_humidity: '#3b82f6',
  air_co2: '#8b5cf6',
  air_light: '#eab308',
};

const SOIL_COLORS = {
  moisture: '#22c55e', temp: '#f97316', ec: '#06b6d4',
  ph: '#ec4899', n: '#8b5cf6', p: '#f59e0b', k: '#14b8a6',
};

export function ChartsTab({ project, gh, isReady }: ChartsTabProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('6h');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customStartTime, setCustomStartTime] = useState('00:00');
  const [customEndTime, setCustomEndTime] = useState('23:59');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  const [airData, setAirData] = useState<any[]>([]);
  const [soilData, setSoilData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [visibleAirSensors, setVisibleAirSensors] = useState<Record<string, boolean>>({
    air_temp: true, air_humidity: true, air_co2: true, air_light: true,
  });

  const [visibleSoilParams, setVisibleSoilParams] = useState<Record<string, boolean>>({
    moisture: true, temp: true, ec: false, ph: false, n: false, p: false, k: false,
  });

  const [selectedSoilNodes, setSelectedSoilNodes] = useState<number[]>([1]);
  const [showAllNodes, setShowAllNodes] = useState(false);
  const [fullscreenChart, setFullscreenChart] = useState<'air' | 'soil' | null>(null);

  const applyCustomRange = () => {
    if (!customStartDate || !customEndDate) {
      setError('กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด');
      return;
    }
    
    const start = new Date(`${customStartDate}T${customStartTime}`);
    const end = new Date(`${customEndDate}T${customEndTime}`);
    
    if (start >= end) {
      setError('วันที่เริ่มต้นต้องน้อยกว่าวันที่สิ้นสุด');
      return;
    }

    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 90) {
      setError('สามารถเลือกข้อมูลได้สูงสุด 90 วัน');
      return;
    }

    setTimeRange('custom');
    setShowCustomDatePicker(false);
    setError(null);
  };

  const fetchChartData = async () => {
    if (!isReady) return;
    setIsLoading(true);
    setError(null);

    let startTs: number, endTs: number;

    if (timeRange === 'custom') {
      if (!customStartDate || !customEndDate) {
        setError('กรุณาเลือกช่วงเวลา');
        setIsLoading(false);
        return;
      }
      startTs = new Date(`${customStartDate}T${customStartTime}`).getTime();
      endTs = new Date(`${customEndDate}T${customEndTime}`).getTime();
    } else {
      const range = TIME_RANGES.find(r => r.key === timeRange)!;
      endTs = Date.now();
      startTs = endTs - range.ms;
    }

    const diffHours = (endTs - startTs) / (1000 * 60 * 60);
    let interval: number, agg = 'AVG', limit = 1000;

    if (diffHours <= 1) interval = 60000;
    else if (diffHours <= 6) interval = 300000;
    else if (diffHours <= 24) interval = 900000;
    else if (diffHours <= 168) interval = 3600000;
    else interval = 86400000;

    try {
      const visibleAirKeys = AIR_TELEMETRY_KEYS.filter(key => visibleAirSensors[key]);
      let airResponse: TelemetryResponse = {};
      
      if (visibleAirKeys.length > 0) {
        airResponse = await tbApi.getTimeseries(
          project, gh, visibleAirKeys, startTs, endTs, { interval, agg, limit }
        );
      }

      const nodesToFetch = showAllNodes ? Array.from({ length: 10 }, (_, i) => i + 1) : selectedSoilNodes;
      const visibleSoilParamKeys = Object.keys(visibleSoilParams).filter(key => visibleSoilParams[key]);
      
      let allSoilResponses: TelemetryResponse = {};
      
      for (const node of nodesToFetch) {
        const soilKeys = getSoilKeys(node);
        const keysToFetch = visibleSoilParamKeys.map(param => 
          soilKeys[param.toUpperCase() as keyof typeof soilKeys]
        );
        
        if (keysToFetch.length > 0) {
          const soilResponse = await tbApi.getTimeseries(
            project, gh, keysToFetch, startTs, endTs, { interval, agg, limit }
          );
          allSoilResponses = { ...allSoilResponses, ...soilResponse };
        }
      }

      setAirData(transformToChartData(airResponse, visibleAirKeys));
      
      const allSoilKeys = nodesToFetch.flatMap(node => {
        const soilKeys = getSoilKeys(node);
        return visibleSoilParamKeys.map(param => 
          soilKeys[param.toUpperCase() as keyof typeof soilKeys]
        );
      });
      setSoilData(transformToChartData(allSoilResponses, allSoilKeys));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลกราฟได้');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();
  }, [project, gh, timeRange, selectedSoilNodes, showAllNodes, isReady, visibleAirSensors, visibleSoilParams]);

  function transformToChartData(response: TelemetryResponse, keys: string[]): any[] {
    const dataMap = new Map<number, any>();
    for (const key of keys) {
      const values = response[key] || [];
      for (const point of values) {
        if (!dataMap.has(point.ts)) dataMap.set(point.ts, { timestamp: point.ts });
        const entry = dataMap.get(point.ts);
        entry[key] = typeof point.value === 'number' ? point.value : parseFloat(String(point.value));
      }
    }
    return Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    const diffMs = timeRange === 'custom' && customStartDate && customEndDate
      ? new Date(`${customEndDate}T${customEndTime}`).getTime() - new Date(`${customStartDate}T${customStartTime}`).getTime()
      : TIME_RANGES.find(r => r.key === timeRange)?.ms || 0;
    
    return (diffMs / (1000 * 60 * 60) <= 24)
      ? date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="bg-white shadow-lg rounded-lg p-3 border border-gray-200 max-w-xs">
        <p className="text-xs text-gray-600 mb-2 font-medium">
          {new Date(label).toLocaleString('th-TH')}
        </p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => {
            const key = entry.dataKey;
            let displayName = DISPLAY_NAMES[key] || key;
            
            if (key.startsWith('soil')) {
              const match = key.match(/soil(\d+)_(\w+)/);
              if (match) {
                const [, nodeNum, param] = match;
                const paramMap: Record<string, string> = {
                  moisture: 'ความชื้น', temp: 'อุณหภูมิ', ec: 'EC',
                  ph: 'pH', n: 'N', p: 'P', k: 'K',
                };
                displayName = `${paramMap[param] || param} (จุดที่ ${nodeNum})`;
              }
            }

            return (
              <div key={index} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                     style={{ backgroundColor: entry.color }} />
                <span className="text-gray-600 truncate">{displayName}:</span>
                <span className="font-semibold ml-auto">
                  {formatNumber(entry.value, 1)} {UNITS[key.replace(/soil\d+_/, '')] || ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const toggleAirSensor = (key: string) => {
    setVisibleAirSensors(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSoilParam = (key: string) => {
    setVisibleSoilParams(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSoilNode = (node: number) => {
    setSelectedSoilNodes(prev =>
      prev.includes(node) ? prev.filter(n => n !== node) : [...prev, node].sort((a, b) => a - b)
    );
  };

  const toggleAllSoilNodes = () => {
    setShowAllNodes(!showAllNodes);
    if (!showAllNodes) setSelectedSoilNodes([]);
  };

  const renderAirLines = () => {
    const lines = [];
    if (visibleAirSensors.air_temp) lines.push(
      <Line key="air_temp" yAxisId="left" type="monotone" dataKey="air_temp" name="อุณหภูมิ"
            stroke={CHART_COLORS.air_temp} strokeWidth={2} dot={false} connectNulls />
    );
    if (visibleAirSensors.air_humidity) lines.push(
      <Line key="air_humidity" yAxisId="left" type="monotone" dataKey="air_humidity" name="ความชื้น"
            stroke={CHART_COLORS.air_humidity} strokeWidth={2} dot={false} connectNulls />
    );
    if (visibleAirSensors.air_co2) lines.push(
      <Line key="air_co2" yAxisId="right" type="monotone" dataKey="air_co2" name="CO₂"
            stroke={CHART_COLORS.air_co2} strokeWidth={2} dot={false} connectNulls />
    );
    if (visibleAirSensors.air_light) lines.push(
      <Line key="air_light" yAxisId="right" type="monotone" dataKey="air_light" name="แสง"
            stroke={CHART_COLORS.air_light} strokeWidth={2} dot={false} connectNulls />
    );
    return lines;
  };

  const renderSoilLines = () => {
    const lines: JSX.Element[] = [];
    const nodesToShow = showAllNodes ? Array.from({ length: 10 }, (_, i) => i + 1) : selectedSoilNodes;
    
    for (const node of nodesToShow) {
      const soilKeys = getSoilKeys(node);
      Object.entries(visibleSoilParams).forEach(([param, isVisible]) => {
        if (!isVisible) return;
        const key = soilKeys[param.toUpperCase() as keyof typeof soilKeys];
        const color = SOIL_COLORS[param as keyof typeof SOIL_COLORS];
        const opacity = nodesToShow.length > 1 ? 0.6 + (node / nodesToShow.length) * 0.4 : 1;
        const adjustedColor = color + Math.round(opacity * 255).toString(16).padStart(2, '0');
        const paramMap: Record<string, string> = {
          moisture: 'ความชื้น', temp: 'อุณหภูมิ', ec: 'EC',
          ph: 'pH', n: 'N', p: 'P', k: 'K',
        };
        lines.push(
          <Line key={key} type="monotone" dataKey={key}
                name={`${paramMap[param]} (จุดที่ ${node})`}
                stroke={nodesToShow.length > 1 ? adjustedColor : color}
                strokeWidth={2} dot={false} connectNulls />
        );
      });
    }
    return lines;
  };

  if (!isReady) {
    return (
      <Card className="p-6 text-center text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>โรงเรือนนี้ยังไม่พร้อมแสดงกราฟ</p>
      </Card>
    );
  }

  const ChartComponent = ({ type }: { type: 'air' | 'soil' }) => {
    const data = type === 'air' ? airData : soilData;
    const isFullscreen = fullscreenChart === type;

    return (
      <Card className={isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900">
              {type === 'air' ? '📊 กราฟค่าอากาศ' : '🌱 กราฟค่าดิน'}
            </h3>
            {!isFullscreen && (
              <button onClick={() => setFullscreenChart(type)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      title="ขยายเต็มจอ">
                <Maximize2 className="w-4 h-4 text-gray-600" />
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {type === 'soil' && !isFullscreen && (
              <button onClick={toggleAllSoilNodes}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                        showAllNodes ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}>
                {showAllNodes ? 'ทั้ง 10 จุด' : 'เลือกจุด'}
              </button>
            )}
            {isFullscreen && (
              <button onClick={() => setFullscreenChart(null)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* Sensor toggles */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          {type === 'air' ? (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-gray-600 font-medium mr-2">แสดง:</span>
              {Object.entries(visibleAirSensors).map(([key, isVisible]) => (
                <button key={key} onClick={() => toggleAirSensor(key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                          isVisible ? 'bg-white border-2 text-gray-900 shadow-sm' : 'bg-gray-200 text-gray-500'
                        }`}
                        style={isVisible ? { borderColor: CHART_COLORS[key as keyof typeof CHART_COLORS] } : {}}>
                  {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {DISPLAY_NAMES[key]}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-600 font-medium mr-2">พารามิเตอร์:</span>
                {Object.entries(visibleSoilParams).map(([key, isVisible]) => (
                  <button key={key} onClick={() => toggleSoilParam(key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                            isVisible ? 'bg-white border-2 text-gray-900 shadow-sm' : 'bg-gray-200 text-gray-500'
                          }`}
                          style={isVisible ? { borderColor: SOIL_COLORS[key as keyof typeof SOIL_COLORS] } : {}}>
                    {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {DISPLAY_NAMES[key]}
                  </button>
                ))}
              </div>
              {!showAllNodes && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-gray-600 font-medium mr-2">จุดที่:</span>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(node => (
                    <button key={node} onClick={() => toggleSoilNode(node)}
                            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                              selectedSoilNodes.includes(node)
                                ? 'bg-primary text-white'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}>
                      {node}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`p-4 ${isFullscreen ? 'h-[calc(100vh-180px)]' : ''}`}>
          {isLoading ? (
            <div className={`flex items-center justify-center text-gray-400 ${isFullscreen ? 'h-full' : 'h-64'}`}>
              กำลังโหลด...
            </div>
          ) : data.length === 0 ? (
            <div className={`flex items-center justify-center text-gray-400 ${isFullscreen ? 'h-full' : 'h-64'}`}>
              ไม่มีข้อมูล
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={isFullscreen ? '100%' : 300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="timestamp" tickFormatter={formatXAxis}
                       tick={{ fontSize: 12 }} stroke="#9ca3af" />
                {type === 'air' ? (
                  <>
                    <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 12 }} stroke="#9ca3af"
                           label={{ value: '°C / %', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="#9ca3af"
                           label={{ value: 'ppm / lux', angle: 90, position: 'insideRight', fontSize: 12 }} />
                  </>
                ) : (
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                )}
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} iconType="line" />
                {type === 'air' ? renderAirLines() : renderSoilLines()}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">ช่วงเวลา:</span>
          <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1">
            {TIME_RANGES.map((range) => (
              <button key={range.key}
                      onClick={() => {
                        if (range.key === 'custom') setShowCustomDatePicker(true);
                        else { setTimeRange(range.key); setShowCustomDatePicker(false); }
                      }}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
                        timeRange === range.key
                          ? 'bg-white text-primary font-medium shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}>
                {range.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <EnhancedExportButton projectKey={project} ghKey={gh} disabled={isLoading || !isReady} />
          <button onClick={fetchChartData} disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>
        </div>
      </div>

      {/* Custom date picker */}
      {showCustomDatePicker && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 text-sm">กำหนดช่วงเวลาเอง (สูงสุด 90 วัน)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-600 font-medium">วันที่เริ่มต้น</label>
                <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)}
                       max={new Date().toISOString().split('T')[0]}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <input type="time" value={customStartTime} onChange={(e) => setCustomStartTime(e.target.value)}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-600 font-medium">วันที่สิ้นสุด</label>
                <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)}
                       max={new Date().toISOString().split('T')[0]}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <input type="time" value={customEndTime} onChange={(e) => setCustomEndTime(e.target.value)}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={applyCustomRange}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium">
                ยืนยัน
              </button>
              <button onClick={() => { setShowCustomDatePicker(false); setTimeRange('6h'); }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium">
                ยกเลิก
              </button>
            </div>
          </div>
        </Card>
      )}

      {timeRange === 'custom' && customStartDate && customEndDate && (
        <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-2">
          แสดงข้อมูล: {new Date(`${customStartDate}T${customStartTime}`).toLocaleString('th-TH')}
          {' '} ถึง {' '}
          {new Date(`${customEndDate}T${customEndTime}`).toLocaleString('th-TH')}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {fullscreenChart ? (
        <>
          {fullscreenChart === 'air' ? <ChartComponent type="air" /> : <ChartComponent type="soil" />}
        </>
      ) : (
        <>
          <ChartComponent type="air" />
          <ChartComponent type="soil" />
        </>
      )}
    </div>
  );
}