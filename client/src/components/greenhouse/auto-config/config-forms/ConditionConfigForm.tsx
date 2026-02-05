/**
 * ConditionConfigForm Component
 * Form for condition-based control
 */

import { cn } from '@/lib/utils';
import type { ConditionConfig } from '@/types/autoConfig';
import { SENSOR_OPTIONS, OPERATOR_OPTIONS, ACTION_OPTIONS } from '@/types/autoConfig';

interface ConditionConfigFormProps {
  config: ConditionConfig;
  disabled: boolean;
  onChange: (config: Partial<ConditionConfig>) => void;
}

export function ConditionConfigForm({ config, disabled, onChange }: ConditionConfigFormProps) {
  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">การควบคุมตามเงื่อนไข</h4>
      
      {/* Sensor Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          เซ็นเซอร์
        </label>
        <select
          value={config.sensorKey}
          onChange={(e) => onChange({ sensorKey: e.target.value })}
          disabled={disabled}
          className={cn(
            'w-full px-3 py-2 border rounded-lg text-sm',
            'focus:outline-none focus:ring-2 focus:ring-primary/50',
            'disabled:bg-gray-100 disabled:cursor-not-allowed'
          )}
        >
          {SENSOR_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Operator and Threshold */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            เงื่อนไข
          </label>
          <select
            value={config.operator}
            onChange={(e) => onChange({ operator: e.target.value as '>' | '<' | '>=' | '<=' })}
            disabled={disabled}
            className={cn(
              'w-full px-3 py-2 border rounded-lg text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/50',
              'disabled:bg-gray-100 disabled:cursor-not-allowed'
            )}
          >
            {OPERATOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ค่าเกณฑ์
          </label>
          <input
            type="number"
            value={config.threshold}
            onChange={(e) => onChange({ threshold: parseFloat(e.target.value) })}
            disabled={disabled}
            step="0.1"
            className={cn(
              'w-full px-3 py-2 border rounded-lg text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/50',
              'disabled:bg-gray-100 disabled:cursor-not-allowed'
            )}
          />
        </div>
      </div>

      {/* Action */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          การทำงานเมื่อเงื่อนไขเป็นจริง
        </label>
        <div className="grid grid-cols-2 gap-2">
          {ACTION_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onChange({ action: option.value })}
              disabled={disabled}
              className={cn(
                'p-3 rounded-lg border-2 transition-all text-center text-sm',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                config.action === option.value
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 เมื่อ <strong>{SENSOR_OPTIONS.find(s => s.value === config.sensorKey)?.label}</strong>{' '}
          <strong>{OPERATOR_OPTIONS.find(o => o.value === config.operator)?.label}</strong>{' '}
          <strong>{config.threshold}</strong> อุปกรณ์จะ{' '}
          <strong>{ACTION_OPTIONS.find(a => a.value === config.action)?.label}</strong>
        </p>
      </div>
    </div>
  );
}