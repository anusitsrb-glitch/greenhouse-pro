import { useState, useEffect } from 'react';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { tbApi } from '@/lib/tbApi';
import { RefreshCw, Settings } from 'lucide-react';

interface HeatmapProps {
  projectKey: string;
  ghKey: string;
}

interface ColorRange {
  min: number;
  max: number;
  color: string;
  label: string;
}

const DEFAULT_MOISTURE_RANGES: ColorRange[] = [
  { min: 0, max: 30, color: '#ef4444', label: 'แห้งมาก' },
  { min: 30, max: 50, color: '#f97316', label: 'แห้ง' },
  { min: 50, max: 70, color: '#eab308', label: 'ปานกลาง' },
  { min: 70, max: 85, color: '#22c55e', label: 'ดี' },
  { min: 85, max: 100, color: '#3b82f6', label: 'ชื้นมาก' },
];

const DEFAULT_TEMP_RANGES: ColorRange[] = [
  { min: 0, max: 20, color: '#3b82f6', label: 'เย็น' },
  { min: 20, max: 25, color: '#22c55e', label: 'เหมาะสม' },
  { min: 25, max: 30, color: '#eab308', label: 'อุ่น' },
  { min: 30, max: 35, color: '#f97316', label: 'ร้อน' },
  { min: 35, max: 50, color: '#ef4444', label: 'ร้อนมาก' },
];

const DEFAULT_PH_RANGES: ColorRange[] = [
  { min: 0, max: 5.5, color: '#ef4444', label: 'เป็นกรดมาก' },
  { min: 5.5, max: 6.0, color: '#f97316', label: 'เป็นกรด' },
  { min: 6.0, max: 7.0, color: '#22c55e', label: 'เป็นกลาง' },
  { min: 7.0, max: 7.5, color: '#3b82f6', label: 'เป็นด่าง' },
  { min: 7.5, max: 14, color: '#8b5cf6', label: 'เป็นด่างมาก' },
];

const SENSOR_OPTIONS = [
  { key: 'moisture', name: 'ความชื้นดิน', unit: '%', ranges: DEFAULT_MOISTURE_RANGES },
  { key: 'temp', name: 'อุณหภูมิดิน', unit: '°C', ranges: DEFAULT_TEMP_RANGES },
  { key: 'ph', name: 'ค่า pH', unit: '', ranges: DEFAULT_PH_RANGES },
  { key: 'ec', name: 'ค่า EC', unit: 'mS/cm', ranges: DEFAULT_MOISTURE_RANGES },
  { key: 'n', name: 'ไนโตรเจน (N)', unit: 'mg/kg', ranges: DEFAULT_MOISTURE_RANGES },
  { key: 'p', name: 'ฟอสฟอรัส (P)', unit: 'mg/kg', ranges: DEFAULT_MOISTURE_RANGES },
  { key: 'k', name: 'โพแทสเซียม (K)', unit: 'mg/kg', ranges: DEFAULT_MOISTURE_RANGES },
];

// Grid layout for 10 sensors (2 rows x 5 columns)
const GRID_LAYOUT = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
];

export function SoilHeatmap({ projectKey, ghKey }: HeatmapProps) {
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [sensorData, setSensorData] = useState<Record<number, number | null>>({});
  const [selectedSensor, setSelectedSensor] = useState('moisture');
  const [showSettings, setShowSettings] = useState(false);
  const [customRanges, setCustomRanges] = useState<ColorRange[]>(DEFAULT_MOISTURE_RANGES);

  const currentSensorOption = SENSOR_OPTIONS.find(s => s.key === selectedSensor);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Build keys for all 10 soil points
      const keys = Array.from({ length: 10 }, (_, i) => `soil${i + 1}_${selectedSensor}`).join(',');
      
      const data = await tbApi.getTelemetryLatest(projectKey, ghKey, keys);

      if (data) {
        const newSensorData: Record<number, number | null> = {};
        for (let i = 1; i <= 10; i++) {
          const key = `soil${i}_${selectedSensor}`;
          const value = data[key]?.[0]?.value;
          newSensorData[i] = value !== undefined ? parseFloat(value) : null;
        }
        setSensorData(newSensorData);
      }
    } catch (error) {
      addToast({ type: 'error', message: 'ไม่สามารถโหลดข้อมูลได้' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [projectKey, ghKey, selectedSensor]);

  useEffect(() => {
    const option = SENSOR_OPTIONS.find(s => s.key === selectedSensor);
    if (option) {
      setCustomRanges(option.ranges);
    }
  }, [selectedSensor]);

  const getColorForValue = (value: number | null): string => {
    if (value === null) return '#e5e7eb'; // Gray for no data
    
    for (const range of customRanges) {
      if (value >= range.min && value < range.max) {
        return range.color;
      }
    }
    return customRanges[customRanges.length - 1]?.color || '#e5e7eb';
  };

  const getLabelForValue = (value: number | null): string => {
    if (value === null) return 'ไม่มีข้อมูล';
    
    for (const range of customRanges) {
      if (value >= range.min && value < range.max) {
        return range.label;
      }
    }
    return customRanges[customRanges.length - 1]?.label || '-';
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          {/* Sensor Type Selection */}
          <div className="flex flex-wrap gap-2">
            {SENSOR_OPTIONS.map(option => (
              <Button
                key={option.key}
                variant={selectedSensor === option.key ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setSelectedSensor(option.key)}
              >
                {option.name}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </Card>

      {/* Color Range Settings */}
      {showSettings && (
        <Card className="p-4">
          <h4 className="font-medium mb-3">ตั้งค่าช่วงสี</h4>
          <div className="space-y-2">
            {customRanges.map((range, index) => (
              <div key={index} className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded"
                  style={{ backgroundColor: range.color }}
                />
                <input
                  type="number"
                  value={range.min}
                  onChange={(e) => {
                    const newRanges = [...customRanges];
                    newRanges[index].min = parseFloat(e.target.value);
                    setCustomRanges(newRanges);
                  }}
                  className="w-20 px-2 py-1 border rounded text-sm"
                />
                <span>-</span>
                <input
                  type="number"
                  value={range.max}
                  onChange={(e) => {
                    const newRanges = [...customRanges];
                    newRanges[index].max = parseFloat(e.target.value);
                    setCustomRanges(newRanges);
                  }}
                  className="w-20 px-2 py-1 border rounded text-sm"
                />
                <input
                  type="text"
                  value={range.label}
                  onChange={(e) => {
                    const newRanges = [...customRanges];
                    newRanges[index].label = e.target.value;
                    setCustomRanges(newRanges);
                  }}
                  className="flex-1 px-2 py-1 border rounded text-sm"
                />
                <input
                  type="color"
                  value={range.color}
                  onChange={(e) => {
                    const newRanges = [...customRanges];
                    newRanges[index].color = e.target.value;
                    setCustomRanges(newRanges);
                  }}
                  className="w-10 h-8 rounded cursor-pointer"
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Heatmap Grid */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          Heatmap: {currentSensorOption?.name}
        </h3>

        {isLoading ? (
          <div className="h-48 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Grid */}
            <div className="flex flex-col gap-3">
              {GRID_LAYOUT.map((row, rowIndex) => (
                <div key={rowIndex} className="flex gap-3 justify-center">
                  {row.map(point => {
                    const value = sensorData[point];
                    const color = getColorForValue(value);
                    const label = getLabelForValue(value);

                    return (
                      <div
                        key={point}
                        className="w-24 h-24 rounded-xl flex flex-col items-center justify-center text-white shadow-lg transition-transform hover:scale-105 cursor-pointer"
                        style={{ backgroundColor: color }}
                        title={`จุด ${point}: ${value !== null ? value : '-'} ${currentSensorOption?.unit || ''}`}
                      >
                        <span className="text-xs opacity-80">จุด {point}</span>
                        <span className="text-2xl font-bold">
                          {value !== null ? value.toFixed(1) : '-'}
                        </span>
                        <span className="text-xs">{currentSensorOption?.unit}</span>
                        <span className="text-xs opacity-80">{label}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-3 pt-4 border-t">
              {customRanges.map((range, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: range.color }}
                  />
                  <span className="text-sm text-gray-600">
                    {range.label} ({range.min}-{range.max})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Statistics */}
      <Card className="p-4">
        <h4 className="font-medium mb-3">สถิติ</h4>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-500">ค่าต่ำสุด</p>
            <p className="text-xl font-bold text-blue-600">
              {Object.values(sensorData).filter(v => v !== null).length > 0
                ? Math.min(...Object.values(sensorData).filter((v): v is number => v !== null)).toFixed(1)
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">ค่าสูงสุด</p>
            <p className="text-xl font-bold text-red-600">
              {Object.values(sensorData).filter(v => v !== null).length > 0
                ? Math.max(...Object.values(sensorData).filter((v): v is number => v !== null)).toFixed(1)
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">ค่าเฉลี่ย</p>
            <p className="text-xl font-bold text-green-600">
              {Object.values(sensorData).filter(v => v !== null).length > 0
                ? (Object.values(sensorData).filter((v): v is number => v !== null).reduce((a, b) => a + b, 0) / Object.values(sensorData).filter(v => v !== null).length).toFixed(1)
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">จุดที่มีข้อมูล</p>
            <p className="text-xl font-bold">
              {Object.values(sensorData).filter(v => v !== null).length}/10
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
