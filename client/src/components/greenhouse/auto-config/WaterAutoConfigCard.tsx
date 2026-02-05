/**
 * WaterAutoConfigCard Component
 * Configuration card for water system (4 zones)
 */

import { useState } from 'react';
import { Card } from '@/components/ui';
import { 
  Droplets, 
  Calendar, 
  Repeat,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { 
  WaterAutoConfig, 
  WaterMode,
  DailyConfig,
  IntervalConfig,
} from '@/types/autoConfig';
import { getModeName, validateDailyConfig, validateIntervalConfig } from '@/types/autoConfig';
import { DailyConfigForm } from './config-forms/DailyConfigForm';
import { IntervalConfigForm } from './config-forms/IntervalConfigForm';

interface WaterAutoConfigCardProps {
  config: WaterAutoConfig;
  disabled: boolean;
  onChange: (config: WaterAutoConfig) => void;
}

export function WaterAutoConfigCard({
  config,
  disabled,
  onChange,
}: WaterAutoConfigCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Handle mode change
  const handleModeChange = (mode: WaterMode) => {
    onChange({ ...config, mode });
    setValidationErrors([]);
  };

  // Handle valve daily config change
  const handleValveDailyChange = (zone: 1 | 2 | 3 | 4, daily: Partial<DailyConfig>) => {
    const valveKey = `valve${zone}` as 'valve1' | 'valve2' | 'valve3' | 'valve4';
    const newValveDaily = {
      ...config.valve_daily,
      [valveKey]: { ...config.valve_daily[valveKey], ...daily },
    };
    onChange({ ...config, valve_daily: newValveDaily });
  };

  // Handle interval config change
  const handleIntervalChange = (interval: Partial<IntervalConfig>) => {
    const newInterval = { ...config.interval, ...interval };
    onChange({ ...config, interval: newInterval });
    
    if (config.mode === 'interval') {
      const errors = validateIntervalConfig(newInterval);
      setValidationErrors(errors);
    }
  };

  return (
    <Card>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Droplets className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-gray-900">ระบบน้ำ (4 โซน)</h3>
              <p className="text-sm text-gray-500">
                โหมด: <span className="font-medium text-gray-700">{getModeName(config.mode)}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        {/* Mode Selection */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button
            onClick={() => handleModeChange('off')}
            disabled={disabled}
            className={cn(
              'p-3 rounded-lg border-2 transition-all text-center',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              config.mode === 'off'
                ? 'border-gray-400 bg-gray-50 text-gray-900 font-medium'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            <div className="text-sm">ปิด</div>
          </button>

          <button
            onClick={() => handleModeChange('valve_daily')}
            disabled={disabled}
            className={cn(
              'p-3 rounded-lg border-2 transition-all text-center',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              config.mode === 'valve_daily'
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            <Calendar className="w-5 h-5 mx-auto mb-1" />
            <div className="text-xs">ตั้งเวลาแยกโซน</div>
          </button>

          <button
            onClick={() => handleModeChange('interval')}
            disabled={disabled}
            className={cn(
              'p-3 rounded-lg border-2 transition-all text-center',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              config.mode === 'interval'
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            <Repeat className="w-5 h-5 mx-auto mb-1" />
            <div className="text-xs">รอบหมุนเวียน</div>
          </button>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <ul className="text-sm text-red-700 space-y-1">
              {validationErrors.map((error, i) => (
                <li key={i}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Configuration Forms */}
        {isExpanded && config.mode !== 'off' && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            {config.mode === 'valve_daily' && (
              <div className="space-y-6">
                <h4 className="font-medium text-gray-900">ตั้งเวลาแต่ละโซน</h4>
                
                {/* Valve 1 */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h5 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                    <Droplets className="w-4 h-4" />
                    โซน 1
                  </h5>
                  <DailyConfigForm
                    config={config.valve_daily.valve1}
                    disabled={disabled}
                    onChange={(updates) => handleValveDailyChange(1, updates)}
                  />
                </div>

                {/* Valve 2 */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h5 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                    <Droplets className="w-4 h-4" />
                    โซน 2
                  </h5>
                  <DailyConfigForm
                    config={config.valve_daily.valve2}
                    disabled={disabled}
                    onChange={(updates) => handleValveDailyChange(2, updates)}
                  />
                </div>

                {/* Valve 3 */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h5 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                    <Droplets className="w-4 h-4" />
                    โซน 3
                  </h5>
                  <DailyConfigForm
                    config={config.valve_daily.valve3}
                    disabled={disabled}
                    onChange={(updates) => handleValveDailyChange(3, updates)}
                  />
                </div>

                {/* Valve 4 */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h5 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                    <Droplets className="w-4 h-4" />
                    โซน 4
                  </h5>
                  <DailyConfigForm
                    config={config.valve_daily.valve4}
                    disabled={disabled}
                    onChange={(updates) => handleValveDailyChange(4, updates)}
                  />
                </div>
              </div>
            )}

            {config.mode === 'interval' && (
              <div className="space-y-4">
                <IntervalConfigForm
                  config={config.interval}
                  disabled={disabled}
                  onChange={handleIntervalChange}
                />
                
                {/* Sequential Info */}
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    🔄 <strong>การทำงานแบบหมุนเวียน:</strong> น้ำจะเปิดทีละโซน (1→2→3→4) 
                    โดยแต่ละโซนจะเปิด {config.interval.onMinutes} นาที ก่อนเปลี่ยนไปโซนถัดไป
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}