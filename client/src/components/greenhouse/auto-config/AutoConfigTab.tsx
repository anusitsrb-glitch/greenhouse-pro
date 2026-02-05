/**
 * AutoConfigTab Component
 * WebApp-based Advanced Auto Configuration
 */

import { useState } from 'react';
import { Card, Button } from '@/components/ui';
import { useAutoConfig } from '@/hooks/useAutoConfig';
import { 
  AlertTriangle, 
  Settings, 
  Clock, 
  Zap, 
  RefreshCw,
  Save,
  Info,
} from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import { DeviceAutoConfigCard } from './DeviceAutoConfigCard';
import { WaterAutoConfigCard } from './WaterAutoConfigCard';
import { MotorAutoConfigCard } from './MotorAutoConfigCard';
import type { AutoConfig } from '@/types/autoConfig';

interface AutoConfigTabProps {
  project: string;
  gh: string;
  isReady: boolean;
  isOnline: boolean;
  userRole: string;
}

export function AutoConfigTab({ 
  project, 
  gh, 
  isReady, 
  isOnline, 
  userRole 
}: AutoConfigTabProps) {
  const {
    config,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    updateConfig,
    refetch,
  } = useAutoConfig({
    project,
    gh,
    enabled: isReady,
    pollInterval: 10000, // Poll every 10 seconds
  });

  const [localChanges, setLocalChanges] = useState<Partial<AutoConfig>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const canControl = userRole === 'superadmin' || userRole === 'admin' || userRole === 'operator';
  const controlsDisabled = !isReady || !isOnline || !canControl || isSaving;

  // Handle local changes
  const handleChange = (updates: Partial<AutoConfig>) => {
    setLocalChanges(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

  // Save all changes
  const handleSave = async () => {
    try {
      await updateConfig(localChanges);
      setLocalChanges({});
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  // Discard changes
  const handleDiscard = () => {
    setLocalChanges({});
    setHasUnsavedChanges(false);
  };

  // Merge config with local changes for display
  const displayConfig: AutoConfig = {
    ...config,
    ...localChanges,
  };

  return (
    <div className="space-y-6">
      {/* Warning if controls disabled */}
      {!canControl && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-800">
            คุณไม่มีสิทธิ์ตั้งค่าระบบอัตโนมัติ (ต้องเป็น superadmin / admin / operator)
          </p>
        </div>
      )}

      {/* Header with status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            ระบบทำงานอัตโนมัติ
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            ตั้งค่าการทำงานอัตโนมัติของอุปกรณ์ทั้งหมด
          </p>
        </div>

        <div className="flex items-center gap-2">
          {lastUpdated && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>อัปเดตล่าสุด: {formatDateTime(new Date(lastUpdated))}</span>
            </div>
          )}
          
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 space-y-1">
          <p className="font-medium">การตั้งค่าใหม่ (WebApp-based):</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>การตั้งค่าทั้งหมดจะถูกเก็บไว้ที่ ThingsBoard</li>
            <li>ESP32 จะอ่านและทำตามการตั้งค่าโดยอัตโนมัติ</li>
            <li>แต่ละอุปกรณ์สามารถเลือกได้เพียง 1 โหมด: ตั้งเวลา / ตามเงื่อนไข / รอบเวลา</li>
            <li>กด "บันทึกการตั้งค่าทั้งหมด" เพื่อบันทึกการเปลี่ยนแปลง</li>
          </ul>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Save/Discard buttons */}
      {hasUnsavedChanges && (
        <Card className="bg-orange-50 border-orange-200">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">
                มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscard}
                disabled={isSaving}
              >
                ยกเลิก
              </Button>
              
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    บันทึกการตั้งค่าทั้งหมด
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Configuration Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* Fan 1 */}
          <DeviceAutoConfigCard
            deviceKey="fan1"
            deviceName="พัดลมใหญ่"
            config={displayConfig.fan1}
            disabled={controlsDisabled}
            onChange={(updates) => handleChange({ fan1: updates })}
          />

          {/* Fan 2 */}
          <DeviceAutoConfigCard
            deviceKey="fan2"
            deviceName="พัดลมกวนอากาศ"
            config={displayConfig.fan2}
            disabled={controlsDisabled}
            onChange={(updates) => handleChange({ fan2: updates })}
          />

          {/* Light 1 */}
          <DeviceAutoConfigCard
            deviceKey="light1"
            deviceName="แสงเสริม"
            config={displayConfig.light1}
            disabled={controlsDisabled}
            onChange={(updates) => handleChange({ light1: updates })}
          />

          {/* Water System */}
          <WaterAutoConfigCard
            config={displayConfig.water}
            disabled={controlsDisabled}
            onChange={(updates) => handleChange({ water: updates })}
          />

          {/* Motor System */}
          <MotorAutoConfigCard
            config={displayConfig.motor}
            disabled={controlsDisabled}
            onChange={(updates) => handleChange({ motor: updates })}
          />
        </div>
      )}
    </div>
  );
}