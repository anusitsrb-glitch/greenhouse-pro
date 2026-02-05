/**
 * DeviceAutoConfigCard Component
 * Configuration card for individual devices (fan1, fan2, light1)
 */

import { useState } from 'react';
import { Card, Button } from '@/components/ui';
import { 
  Fan, 
  Lightbulb, 
  Calendar, 
  Gauge, 
  Repeat,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { 
  DeviceAutoConfig, 
  AutoMode,
  DailyConfig,
  ConditionConfig,
  IntervalConfig,
} from '@/types/autoConfig';
import {
  getModeName,
  SENSOR_OPTIONS,
  OPERATOR_OPTIONS,
  ACTION_OPTIONS,
  validateDailyConfig,
  validateConditionConfig,
  validateIntervalConfig,
} from '@/types/autoConfig';
import { DailyConfigForm } from './config-forms/DailyConfigForm';
import { ConditionConfigForm } from './config-forms/ConditionConfigForm';
import { IntervalConfigForm } from './config-forms/IntervalConfigForm';

interface DeviceAutoConfigCardProps {
  deviceKey: 'fan1' | 'fan2' | 'light1';
  deviceName: string;
  config: DeviceAutoConfig;
  disabled: boolean;
  onChange: (config: DeviceAutoConfig) => void;
}

const DEVICE_ICONS = {
  fan1: Fan,
  fan2: Fan,
  light1: Lightbulb,
};

export function DeviceAutoConfigCard({
  deviceKey,
  deviceName,
  config,
  disabled,
  onChange,
}: DeviceAutoConfigCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const Icon = DEVICE_ICONS[deviceKey];

  // Handle mode change
  const handleModeChange = (mode: AutoMode) => {
    onChange({ ...config, mode });
    setValidationErrors([]);
  };

  // Handle daily config change
  const handleDailyChange = (daily: Partial<DailyConfig>) => {
    const newDaily = { ...config.daily, ...daily };
    onChange({ ...config, daily: newDaily });
    
    if (config.mode === 'daily') {
      const errors = validateDailyConfig(newDaily);
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
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-gray-900">{deviceName}</h3>
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
            onClick={() => handleModeChange('daily')}
            disabled={disabled}
            className={cn(
              'p-3 rounded-lg border-2 transition-all text-center',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              config.mode === 'daily'
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            <Calendar className="w-5 h-5 mx-auto mb-1" />
            <div className="text-xs">ตั้งเวลา</div>
          </button>

          <button
            onClick={() => handleModeChange('condition')}
            disabled={disabled}
            className={cn(
              'p-3 rounded-lg border-2 transition-all text-center',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              config.mode === 'condition'
                ? 'border-primary bg-primary/10 text-primary font-medium'
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
                ? 'border-primary bg-primary/10 text-primary font-medium'
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
            {config.mode === 'daily' && (
              <DailyConfigForm
                config={config.daily}
                disabled={disabled}
                onChange={handleDailyChange}
              />
            )}

            {config.mode === 'condition' && (
              <ConditionConfigForm
                config={config.condition}
                disabled={disabled}
                onChange={handleConditionChange}
              />
            )}

            {config.mode === 'interval' && (
              <IntervalConfigForm
                config={config.interval}
                disabled={disabled}
                onChange={handleIntervalChange}
              />
            )}
          </div>
        )}
      </div>
    </Card>
  );
}