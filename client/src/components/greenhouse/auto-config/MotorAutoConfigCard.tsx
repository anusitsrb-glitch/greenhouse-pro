/**
 * MotorAutoConfigCard Component
 * Configuration card for motor system (shade control)
 */

import { useState } from 'react';
import { Card } from '@/components/ui';
import { 
  Cog, 
  Clock,
  Gauge, 
  Repeat,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { 
  MotorAutoConfig, 
  MotorMode,
  ConditionConfig,
  IntervalConfig,
} from '@/types/autoConfig';
import { 
  getModeName, 
  validateConditionConfig, 
  validateIntervalConfig,
  isValidTime,
} from '@/types/autoConfig';
import { ConditionConfigForm } from './config-forms/ConditionConfigForm';
import { IntervalConfigForm } from './config-forms/IntervalConfigForm';

interface MotorAutoConfigCardProps {
  config: MotorAutoConfig;
  disabled: boolean;
  onChange: (config: MotorAutoConfig) => void;
}

export function MotorAutoConfigCard({
  config,
  disabled,
  onChange,
}: MotorAutoConfigCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Handle mode change
  const handleModeChange = (mode: MotorMode) => {
    onChange({ ...config, mode });
    setValidationErrors([]);
  };

  // Handle global config change
  const handleGlobalChange = (updates: Partial<typeof config.global>) => {
    const newGlobal = { ...config.global, ...updates };
    onChange({ ...config, global: newGlobal });
    
    if (config.mode === 'global') {
      const errors: string[] = [];
      if (!isValidTime(newGlobal.fwTime)) {
        errors.push('เวลา Forward ไม่ถูกต้อง');
      }
      if (!isValidTime(newGlobal.reTime)) {
        errors.push('เวลา Reverse ไม่ถูกต้อง');
      }
      setValidationErrors(errors);
    }
  };

  // Handle condition config change
  const handleConditionChange = (condition: Partial<ConditionConfig>) => {
    const newCondition = { ...config.condition, ...condition };
    onChange({ ...config, condition: newCondition });
    
    if (config.mode === 'condition') {
      const errors = validateConditionConfig(newCondition);
      setValidationErrors(errors);
    }
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
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
              <Cog className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-gray-900">มอเตอร์พรางแสง (4 ตัว)</h3>
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
        <div className="grid grid-cols-4 gap-2 mb-4">
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
            onClick={() => handleModeChange('global')}
            disabled={disabled}
            className={cn(
              'p-3 rounded-lg border-2 transition-all text-center',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              config.mode === 'global'
                ? 'border-orange-500 bg-orange-50 text-orange-700 font-medium'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            <Clock className="w-5 h-5 mx-auto mb-1" />
            <div className="text-xs">ควบคุมพร้อมกัน</div>
          </button>

          <button
            onClick={() => handleModeChange('condition')}
            disabled={disabled}
            className={cn(
              'p-3 rounded-lg border-2 transition-all text-center',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              config.mode === 'condition'
                ? 'border-orange-500 bg-orange-50 text-orange-700 font-medium'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            <Gauge className="w-5 h-5 mx-auto mb-1" />
            <div className="text-xs">ตามเงื่อนไข</div>
          </button>

          <button
            onClick={() => handleModeChange('interval')}
            disabled={disabled}
            className={cn(
              'p-3 rounded-lg border-2 transition-all text-center',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              config.mode === 'interval'
                ? 'border-orange-500 bg-orange-50 text-orange-700 font-medium'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            <Repeat className="w-5 h-5 mx-auto mb-1" />
            <div className="text-xs">รอบเวลา</div>
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
            {config.mode === 'global' && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">ควบคุมพร้อมกัน (4 มอเตอร์)</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Forward Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      เวลา Forward (ปิดพราง/ลง)
                    </label>
                    <input
                      type="time"
                      value={config.global.fwTime}
                      onChange={(e) => handleGlobalChange({ fwTime: e.target.value })}
                      disabled={disabled}
                      className={cn(
                        'w-full px-3 py-2 border rounded-lg text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-primary/50',
                        'disabled:bg-gray-100 disabled:cursor-not-allowed'
                      )}
                    />
                  </div>

                  {/* Reverse Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      เวลา Reverse (เปิดพราง/ขึ้น)
                    </label>
                    <input
                      type="time"
                      value={config.global.reTime}
                      onChange={(e) => handleGlobalChange({ reTime: e.target.value })}
                      disabled={disabled}
                      className={cn(
                        'w-full px-3 py-2 border rounded-lg text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-primary/50',
                        'disabled:bg-gray-100 disabled:cursor-not-allowed'
                      )}
                    />
                  </div>
                </div>

                {/* Preview */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    💡 มอเตอร์ทั้ง 4 ตัวจะเคลื่อนที่พร้อมกัน:<br />
                    • Forward (ลง) เวลา <strong>{config.global.fwTime}</strong><br />
                    • Reverse (ขึ้น) เวลา <strong>{config.global.reTime}</strong>
                  </p>
                </div>
              </div>
            )}

            {config.mode === 'condition' && (
              <div className="space-y-4">
                <ConditionConfigForm
                  config={config.condition}
                  disabled={disabled}
                  onChange={handleConditionChange}
                />
                
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    ℹ️ เมื่อเงื่อนไขเป็นจริง มอเตอร์ทั้ง 4 ตัวจะทำงานพร้อมกัน
                  </p>
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
                
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    ℹ️ มอเตอร์ทั้ง 4 ตัวจะเคลื่อนที่พร้อมกันตามรอบเวลาที่ตั้งไว้
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