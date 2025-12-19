import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Badge } from '@/components/ui';
import { adminApi } from '@/lib/adminApi';
import { useToast } from '@/hooks/useToast';
import { Database, Shield, Clock, Server, Download, RefreshCw } from 'lucide-react';

export function SettingsPage() {
  const { addToast } = useToast();
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getSettings();
      setSettings(data);
    } catch (error) {
      addToast({ type: 'error', message: 'ไม่สามารถโหลดข้อมูลได้' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  return (
    <AdminLayout title="ตั้งค่าระบบ" subtitle="ดูข้อมูลและตั้งค่าระบบทั่วไป">
      <div className="max-w-3xl space-y-6">
        {/* System Info */}
        <Card>
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-gray-400" />
              ข้อมูลระบบ
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">เวอร์ชัน</p>
                <p className="text-lg font-semibold">{settings.app_version || '1.0.0'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Node.js</p>
                <p className="text-lg font-semibold">{process.env.NODE_ENV || 'production'}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Database */}
        <Card>
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-gray-400" />
              ฐานข้อมูล
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">SQLite Database</p>
                  <p className="text-sm text-gray-500">ไฟล์ฐานข้อมูลหลัก</p>
                </div>
                <Badge variant="success">เชื่อมต่อแล้ว</Badge>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">การสำรองข้อมูล</p>
                  <p className="text-sm text-gray-500">
                    {settings.backup_enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'} 
                    {settings.backup_interval_days && ` (ทุก ${settings.backup_interval_days} วัน)`}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4" />
                  สำรองข้อมูล
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Security */}
        <Card>
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-gray-400" />
              ความปลอดภัย
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600">CSRF Protection</span>
                <Badge variant="success">เปิดใช้งาน</Badge>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600">Rate Limiting</span>
                <Badge variant="success">เปิดใช้งาน</Badge>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600">Session Timeout</span>
                <span className="text-gray-900 font-medium">24 ชั่วโมง</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600">Password Hashing</span>
                <Badge variant="success">bcrypt</Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Audit Log Info */}
        <Card>
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" />
              บันทึกการใช้งาน (Audit Log)
            </h3>
            <p className="text-gray-600 mb-4">
              ระบบจะบันทึกการกระทำทั้งหมดของผู้ใช้ เช่น การ login, การควบคุมอุปกรณ์, การแก้ไขข้อมูล เป็นต้น
            </p>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 <strong>Tip:</strong> สามารถดู Audit Log ได้จากฐานข้อมูลโดยตรง หรือสร้างหน้า Audit Log Viewer เพิ่มเติมได้
              </p>
            </div>
          </div>
        </Card>

        {/* Refresh */}
        <Button variant="outline" onClick={fetchSettings} isLoading={isLoading}>
          <RefreshCw className="w-4 h-4" />
          รีเฟรชข้อมูล
        </Button>
      </div>
    </AdminLayout>
  );
}
