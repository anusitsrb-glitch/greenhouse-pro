/**
 * DailyConfigForm Component
 * Form for daily schedule (on/off time)
 */

import { cn } from '@/lib/utils';
import type { DailyConfig } from '@/types/autoConfig';

interface DailyConfigFormProps {
  config: DailyConfig;
  disabled: boolean;
  onChange: (config: Partial<DailyConfig>) => void;
}

export function DailyConfigForm({ config, disabled, onChange }: DailyConfigFormProps) {
  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">การตั้งเวลา</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* On Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            เวลาเปิด
          </label>
          <input
            type="time"
            value={config.onTime}
            onChange={(e) => onChange({ onTime: e.target.value })}
            disabled={disabled}
            className={cn(
              'w-full px-3 py-2 border rounded-lg text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/50',
              'disabled:bg-gray-100 disabled:cursor-not-allowed'
            )}
          />
        </div>

        {/* Off Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            เวลาปิด
          </label>
          <input
            type="time"
            value={config.offTime}
            onChange={(e) => onChange({ offTime: e.target.value })}
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
          💡 อุปกรณ์จะเปิดทำงานระหว่าง <strong>{config.onTime}</strong> ถึง <strong>{config.offTime}</strong> ทุกวัน
        </p>
      </div>
    </div>
  );
}