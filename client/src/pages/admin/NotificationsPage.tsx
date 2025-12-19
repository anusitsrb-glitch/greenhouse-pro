import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { adminApi, LineNotifyConfig } from '@/lib/adminApi';
import { useToast } from '@/hooks/useToast';
import { Bell, Send, Save, Eye, EyeOff, AlertTriangle, Thermometer, Droplets, Sprout } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NotificationsPage() {
  const { addToast } = useToast();
  const [config, setConfig] = useState<LineNotifyConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [newToken, setNewToken] = useState('');

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getLineNotifyConfig();
      setConfig(data);
    } catch (error) {
      addToast({ type: 'error', message: 'ไม่สามารถโหลดข้อมูลได้' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      await adminApi.updateLineNotifyConfig({
        ...config,
        token: newToken || undefined,
      });
      addToast({ type: 'success', message: 'บันทึกการตั้งค่าสำเร็จ' });
      setNewToken('');
      fetchConfig();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      await adminApi.testLineNotify();
      addToast({ type: 'success', message: 'ส่งข้อความทดสอบสำเร็จ' });
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด' });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading || !config) {
    return <AdminLayout title="การแจ้งเตือน"><div className="text-center py-12 text-gray-500">กำลังโหลด...</div></AdminLayout>;
  }

  return (
    <AdminLayout title="การแจ้งเตือน" subtitle="ตั้งค่า Line Notify และเงื่อนไขการแจ้งเตือน">
      <div className="max-w-3xl space-y-6">
        {/* Main Toggle */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', config.enabled ? 'bg-green-100' : 'bg-gray-100')}>
                  <Bell className={cn('w-6 h-6', config.enabled ? 'text-green-600' : 'text-gray-400')} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Line Notify</h3>
                  <p className="text-sm text-gray-500">รับการแจ้งเตือนผ่าน Line เมื่อมีเหตุการณ์สำคัญ</p>
                </div>
              </div>
              <button
                onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                className={cn(
                  'relative w-14 h-8 rounded-full transition-colors',
                  config.enabled ? 'bg-green-500' : 'bg-gray-300'
                )}
              >
                <span className={cn(
                  'absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow',
                  config.enabled ? 'left-7' : 'left-1'
                )} />
              </button>
            </div>
          </div>
        </Card>

        {/* Token Settings */}
        <Card>
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Token การเชื่อมต่อ</h3>
            
            {config.tokenMasked && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Token ปัจจุบัน: <span className="font-mono">{config.tokenMasked}</span></p>
              </div>
            )}

            <div className="relative">
              <Input
                label="Line Notify Token ใหม่"
                type={showToken ? 'text' : 'password'}
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                placeholder={config.tokenMasked ? '(ไม่เปลี่ยนแปลง)' : 'วาง Token ที่นี่'}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>วิธีรับ Token:</strong><br />
                1. ไปที่ <a href="https://notify-bot.line.me/" target="_blank" className="underline">notify-bot.line.me</a><br />
                2. Login ด้วย Line Account<br />
                3. คลิก "Generate Token"<br />
                4. เลือกกลุ่มหรือ 1-on-1 ที่ต้องการรับแจ้งเตือน<br />
                5. คัดลอก Token มาวางที่นี่
              </p>
            </div>
          </div>
        </Card>

        {/* Alert Types */}
        <Card>
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">ประเภทการแจ้งเตือน</h3>
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={config.alertOnOffline}
                  onChange={(e) => setConfig({ ...config, alertOnOffline: e.target.checked })}
                  className="w-4 h-4 text-primary rounded"
                />
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="font-medium">แจ้งเตือนเมื่ออุปกรณ์ออฟไลน์</p>
                  <p className="text-sm text-gray-500">ส่งข้อความเมื่ออุปกรณ์ขาดการเชื่อมต่อ</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={config.alertOnThreshold}
                  onChange={(e) => setConfig({ ...config, alertOnThreshold: e.target.checked })}
                  className="w-4 h-4 text-primary rounded"
                />
                <Thermometer className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="font-medium">แจ้งเตือนเมื่อค่าเกินเกณฑ์</p>
                  <p className="text-sm text-gray-500">ส่งข้อความเมื่อค่า sensor ผิดปกติ</p>
                </div>
              </label>
            </div>
          </div>
        </Card>

        {/* Thresholds */}
        {config.alertOnThreshold && (
          <Card>
            <div className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">เกณฑ์การแจ้งเตือน</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Temperature */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Thermometer className="w-4 h-4" />
                    <span className="font-medium">อุณหภูมิอากาศ (°C)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="ต่ำสุด"
                      type="number"
                      value={config.thresholds.temp_min}
                      onChange={(e) => setConfig({
                        ...config,
                        thresholds: { ...config.thresholds, temp_min: parseFloat(e.target.value) }
                      })}
                    />
                    <Input
                      label="สูงสุด"
                      type="number"
                      value={config.thresholds.temp_max}
                      onChange={(e) => setConfig({
                        ...config,
                        thresholds: { ...config.thresholds, temp_max: parseFloat(e.target.value) }
                      })}
                    />
                  </div>
                </div>

                {/* Humidity */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Droplets className="w-4 h-4" />
                    <span className="font-medium">ความชื้นอากาศ (%)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="ต่ำสุด"
                      type="number"
                      value={config.thresholds.humidity_min}
                      onChange={(e) => setConfig({
                        ...config,
                        thresholds: { ...config.thresholds, humidity_min: parseFloat(e.target.value) }
                      })}
                    />
                    <Input
                      label="สูงสุด"
                      type="number"
                      value={config.thresholds.humidity_max}
                      onChange={(e) => setConfig({
                        ...config,
                        thresholds: { ...config.thresholds, humidity_max: parseFloat(e.target.value) }
                      })}
                    />
                  </div>
                </div>

                {/* Soil Moisture */}
                <div className="space-y-3 md:col-span-2">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Sprout className="w-4 h-4" />
                    <span className="font-medium">ความชื้นดิน (%)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="ต่ำสุด"
                      type="number"
                      value={config.thresholds.soil_moisture_min}
                      onChange={(e) => setConfig({
                        ...config,
                        thresholds: { ...config.thresholds, soil_moisture_min: parseFloat(e.target.value) }
                      })}
                    />
                    <Input
                      label="สูงสุด"
                      type="number"
                      value={config.thresholds.soil_moisture_max}
                      onChange={(e) => setConfig({
                        ...config,
                        thresholds: { ...config.thresholds, soil_moisture_max: parseFloat(e.target.value) }
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={handleTest} variant="outline" isLoading={isTesting} disabled={!config.tokenMasked && !newToken}>
            <Send className="w-4 h-4" />
            ทดสอบส่งข้อความ
          </Button>
          <Button onClick={handleSave} isLoading={isSaving} className="flex-1">
            <Save className="w-4 h-4" />
            บันทึกการตั้งค่า
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
