import { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, X } from 'lucide-react';
import { exportApi } from '@/lib/exportApi';
import { useToast } from '@/hooks/useToast';
import { AIR_TELEMETRY_KEYS, getSoilKeys, DISPLAY_NAMES } from '@/config/dataKeys';
import { useT } from '@/i18n';

interface EnhancedExportButtonProps {
  projectKey: string;
  ghKey: string;
  disabled?: boolean;
}

export function EnhancedExportButton({ projectKey, ghKey, disabled }: EnhancedExportButtonProps) {
  const { t } = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');

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
      addToast({ type: 'error', message: t('export.errNoDate') });
      return;
    }
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    if (start >= end) {
      addToast({ type: 'error', message: t('export.errStartEnd') });
      return;
    }
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 365) {
      addToast({ type: 'error', message: t('export.errMax1Year') });
      return;
    }
    if (selectedAirSensors.length === 0 && selectedSoilNodes.length === 0) {
      addToast({ type: 'error', message: t('export.errNoSensor') });
      return;
    }

    setIsExporting(true);
    const telemetryKeys = [
      ...selectedAirSensors,
      ...selectedSoilNodes.flatMap(node => {
        const soilKeys = getSoilKeys(node);
        return selectedSoilParams.map(param => soilKeys[param.toUpperCase() as keyof typeof soilKeys]);
      }),
    ];

    try {
      const params = { projectKey, ghKey, keys: telemetryKeys, startTs: start.getTime(), endTs: end.getTime() };
      if (exportFormat === 'excel') {
        await exportApi.toExcel(params);
      } else {
        await exportApi.toCSV(params);
      }
      addToast({ type: 'success', message: t('export.successMsg').replace('{n}', String(Math.ceil(diffDays))) });
      setIsOpen(false);
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : t('export.errFailed') });
    } finally {
      setIsExporting(false);
    }
  };

  const toggleAirSensor = (key: string) =>
    setSelectedAirSensors(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const toggleSoilNode = (node: number) =>
    setSelectedSoilNodes(prev => prev.includes(node) ? prev.filter(n => n !== node) : [...prev, node].sort());

  const toggleSoilParam = (param: string) =>
    setSelectedSoilParams(prev => prev.includes(param) ? prev.filter(p => p !== param) : [...prev, param]);

  const makePreset = (days: number) => () => {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && !isExporting && setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={t('export.title')}
      >
        {isExporting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="hidden sm:inline">{t('export.downloading')}</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{t('export.btnLabel')}</span>
          </>
        )}
      </button>

      {isOpen && !isExporting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('export.title')}</h3>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Format */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('export.format')}</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setExportFormat('excel')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${exportFormat === 'excel' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:text-gray-300'}`}
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                    <span>Excel (.xlsx)</span>
                  </button>
                  <button
                    onClick={() => setExportFormat('csv')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${exportFormat === 'csv' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:text-gray-300'}`}
                  >
                    <FileText className="w-5 h-5" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              {/* Date Range */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('export.dateRange')}</label>
                <div className="flex gap-2">
                  <button onClick={makePreset(7)} className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 dark:text-gray-300 rounded-lg transition-colors">{t('export.last7')}</button>
                  <button onClick={makePreset(30)} className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 dark:text-gray-300 rounded-lg transition-colors">{t('export.last30')}</button>
                  <button onClick={makePreset(90)} className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 dark:text-gray-300 rounded-lg transition-colors">{t('export.last90')}</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-gray-600 dark:text-gray-400">{t('export.startDate')}</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} max={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-gray-600 dark:text-gray-400">{t('export.endDate')}</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} max={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('export.maxNote')}</p>
              </div>

              {/* Air Sensors */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('export.airSensors')}</label>
                <div className="flex flex-wrap gap-2">
                  {AIR_TELEMETRY_KEYS.map(key => (
                    <button key={key} onClick={() => toggleAirSensor(key)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${selectedAirSensors.includes(key) ? 'bg-blue-100 text-blue-700 border-2 border-blue-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                      {DISPLAY_NAMES[key] || key}
                    </button>
                  ))}
                </div>
              </div>

              {/* Soil Nodes */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('export.soilNodes')}</label>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(node => (
                    <button key={node} onClick={() => toggleSoilNode(node)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${selectedSoilNodes.includes(node) ? 'bg-green-100 text-green-700 border-2 border-green-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                      {t('export.soilNode').replace('{n}', String(node))}
                    </button>
                  ))}
                </div>
              </div>

              {/* Soil Params */}
              {selectedSoilNodes.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('export.soilParams')}</label>
                  <div className="flex flex-wrap gap-2">
                    {['moisture', 'temp', 'ec', 'ph', 'n', 'p', 'k'].map(param => (
                      <button key={param} onClick={() => toggleSoilParam(param)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${selectedSoilParams.includes(param) ? 'bg-green-100 text-green-700 border-2 border-green-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                        {DISPLAY_NAMES[param] || param}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button onClick={handleExport} className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                  {t('export.downloadBtn')}
                </button>
                <button onClick={() => setIsOpen(false)} className="px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}