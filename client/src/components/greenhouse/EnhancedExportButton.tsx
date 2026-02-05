import { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, X } from 'lucide-react';
import { exportApi } from '@/lib/exportApi';
import { useToast } from '@/hooks/useToast';
import { AIR_TELEMETRY_KEYS, getSoilKeys, DISPLAY_NAMES } from '@/config/dataKeys';

interface EnhancedExportButtonProps {
  projectKey: string;
  ghKey: string;
  disabled?: boolean;
}

export function EnhancedExportButton({ projectKey, ghKey, disabled }: EnhancedExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  // Export settings
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');

  // Sensor selection
  const [selectedAirSensors, setSelectedAirSensors] = useState<string[]>(AIR_TELEMETRY_KEYS);
  const [selectedSoilNodes, setSelectedSoilNodes] = useState<number[]>([1]);
  const [selectedSoilParams, setSelectedSoilParams] = useState<string[]>(['moisture', 'temp']);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleExport = async () => {
    if (!startDate || !endDate) {
      addToast({
        type: 'error',
        message: 'กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด',
      });
      return;
    }

    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    
    if (start >= end) {
      addToast({
        type: 'error',
        message: 'วันที่เริ่มต้นต้องน้อยกว่าวันที่สิ้นสุด',
      });
      return;
    }

    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 365) {
      addToast({
        type: 'error',
        message: 'สามารถ Export ได้สูงสุด 1 ปี',
      });
      return;
    }

    if (selectedAirSensors.length === 0 && selectedSoilNodes.length === 0) {
      addToast({
        type: 'error',
        message: 'กรุณาเลือกเซนเซอร์อย่างน้อย 1 ตัว',
      });
      return;
    }

    setIsExporting(true);

    const telemetryKeys = [
      ...selectedAirSensors,
      ...selectedSoilNodes.flatMap(node => {
        const soilKeys = getSoilKeys(node);
        return selectedSoilParams.map(param => soilKeys[param.toUpperCase() as keyof typeof soilKeys]);
      })
    ];

    const params = {
      projectKey,
      ghKey,
      keys: telemetryKeys,
      startTs: start.getTime(),
      endTs: end.getTime(),
    };

    try {
      if (exportFormat === 'excel') {
        await exportApi.toExcel(params);
      } else {
        await exportApi.toCSV(params);
      }
      
      addToast({
        type: 'success',
        message: `ดาวน์โหลดข้อมูลสำเร็จ (${Math.ceil(diffDays)} วัน)`,
      });
      setIsOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'ไม่สามารถ Export ได้',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const toggleAirSensor = (key: string) => {
    setSelectedAirSensors(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleSoilNode = (node: number) => {
    setSelectedSoilNodes(prev =>
      prev.includes(node) ? prev.filter(n => n !== node) : [...prev, node].sort()
    );
  };

  const toggleSoilParam = (param: string) => {
    setSelectedSoilParams(prev =>
      prev.includes(param) ? prev.filter(p => p !== param) : [...prev, param]
    );
  };

  // Quick presets
  const setPreset7Days = () => {
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const setPreset30Days = () => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const setPreset90Days = () => {
    const end = new Date();
    const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && !isExporting && setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Export ข้อมูล"
      >
        {isExporting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="hidden sm:inline">กำลังดาวน์โหลด...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </>
        )}
      </button>

      {/* Export Modal */}
      {isOpen && !isExporting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Export ข้อมูล</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Format Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">รูปแบบไฟล์</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setExportFormat('excel')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
                      exportFormat === 'excel'
                        ? 'border-green-600 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                    <span>Excel (.xlsx)</span>
                  </button>
                  <button
                    onClick={() => setExportFormat('csv')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
                      exportFormat === 'csv'
                        ? 'border-green-600 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              {/* Date Range */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">ช่วงเวลา</label>
                
                {/* Quick Presets */}
                <div className="flex gap-2">
                  <button
                    onClick={setPreset7Days}
                    className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    7 วันล่าสุด
                  </button>
                  <button
                    onClick={setPreset30Days}
                    className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    30 วันล่าสุด
                  </button>
                  <button
                    onClick={setPreset90Days}
                    className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    90 วันล่าสุด
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-gray-600">วันที่เริ่มต้น</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs text-gray-600">วันที่สิ้นสุด</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">* สามารถเลือกได้สูงสุด 1 ปี</p>
              </div>

              {/* Air Sensors */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">เซนเซอร์อากาศ</label>
                <div className="flex flex-wrap gap-2">
                  {AIR_TELEMETRY_KEYS.map(key => (
                    <button
                      key={key}
                      onClick={() => toggleAirSensor(key)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        selectedAirSensors.includes(key)
                          ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {DISPLAY_NAMES[key] || key}
                    </button>
                  ))}
                </div>
              </div>

              {/* Soil Nodes */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">จุดดิน</label>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(node => (
                    <button
                      key={node}
                      onClick={() => toggleSoilNode(node)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        selectedSoilNodes.includes(node)
                          ? 'bg-green-100 text-green-700 border-2 border-green-500'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      จุดที่ {node}
                    </button>
                  ))}
                </div>
              </div>

              {/* Soil Parameters */}
              {selectedSoilNodes.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">พารามิเตอร์ดิน</label>
                  <div className="flex flex-wrap gap-2">
                    {['moisture', 'temp', 'ec', 'ph', 'n', 'p', 'k'].map(param => (
                      <button
                        key={param}
                        onClick={() => toggleSoilParam(param)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          selectedSoilParams.includes(param)
                            ? 'bg-green-100 text-green-700 border-2 border-green-500'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {DISPLAY_NAMES[param] || param}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Export Button */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleExport}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  ดาวน์โหลด
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}