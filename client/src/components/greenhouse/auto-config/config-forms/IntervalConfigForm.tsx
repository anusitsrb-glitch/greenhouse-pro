/**
 * IntervalConfigForm Component
 * Form for interval loop control
 */

import { cn } from '@/lib/utils';
import type { IntervalConfig } from '@/types/autoConfig';

interface IntervalConfigFormProps {
  config: IntervalConfig;
  disabled: boolean;
  onChange: (config: Partial<IntervalConfig>) => void;
}

export function IntervalConfigForm({ config, disabled, onChange }: IntervalConfigFormProps) {
  const totalCycleMinutes = config.onMinutes + config.offMinutes;
  const totalTimeMinutes = totalCycleMinutes * config.maxCycles;
  const hours = Math.floor(totalTimeMinutes / 60);
  const minutes = totalTimeMinutes % 60;

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">การทำงานเป็นรอบ</h4>
      
      {/* Time Window */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            เริ่มทำงาน
          </label>
          <input
            type="time"
            value={config.startTime}
            onChange={(e) => onChange({ startTime: e.target.value })}
            disabled={disabled}
            className={cn(
              'w-full px-3 py-2 border rounded-lg text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/50',
              'disabled:bg-gray-100 disabled:cursor-not-allowed'
            )}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            สิ้นสุดการทำงาน
          </label>
          <input
            type="time"
            value={config.endTime}
            onChange={(e) => onChange({ endTime: e.target.value })}
            disabled={disabled}
            className={cn(
              'w-full px-3 py-2 border rounded-lg text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/50',
              'disabled:bg-gray-100 disabled:cursor-not-allowed'
            )}
          />
        </div>
      </div>

      {/* Interval Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            เวลาเปิด (นาที)
          </label>
          <input
            type="number"
            value={config.onMinutes}
            onChange={(e) => onChange({ onMinutes: parseInt(e.target.value) || 0 })}
            disabled={disabled}
            min="1"
            className={cn(
              'w-full px-3 py-2 border rounded-lg text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/50',
              'disabled:bg-gray-100 disabled:cursor-not-allowed'
            )}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            เวลาปิด (นาที)
          </label>
          <input
            type="number"
            value={config.offMinutes}
            onChange={(e) => onChange({ offMinutes: parseInt(e.target.value) || 0 })}
            disabled={disabled}
            min="1"
            className={cn(
              'w-full px-3 py-2 border rounded-lg text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/50',
              'disabled:bg-gray-100 disabled:cursor-not-allowed'
            )}
          />
        </div>
      </div>

      {/* Max Cycles */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          จำนวนรอบสูงสุด
        </label>
        <input
          type="number"
          value={config.maxCycles}
          onChange={(e) => onChange({ maxCycles: parseInt(e.target.value) || 0 })}
          disabled={disabled}
          min="1"
          className={cn(
            'w-full px-3 py-2 border rounded-lg text-sm',
            'focus:outline-none focus:ring-2 focus:ring-primary/50',
            'disabled:bg-gray-100 disabled:cursor-not-allowed'
          )}
        />
      </div>

      {/* Preview */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
        <p className="text-sm text-blue-800">
          💡 <strong>การทำงาน:</strong>
        </p>
        <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
          <li>
            ทำงานระหว่าง <strong>{config.startTime}</strong> ถึง <strong>{config.endTime}</strong>
          </li>
          <li>
            เปิด <strong>{config.onMinutes}</strong> นาที พัก <strong>{config.offMinutes}</strong> นาที
          </li>
          <li>
            ทำซ้ำ <strong>{config.maxCycles}</strong> รอบ
          </li>
          <li className="font-medium">
            รวมเวลา: <strong>{hours > 0 ? `${hours} ชั่วโมง ` : ''}{minutes} นาที</strong>
          </li>
        </ul>
      </div>
    </div>
  );
}