/**
 * Enhanced Notification Settings Page
 * With Browser Notification Permission Request
 */

import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, Button, Badge } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { useBrowserNotification } from '@/hooks/useBrowserNotification';
import { notificationsApi } from '@/lib/notificationsApi';
import { projectsApi } from '@/lib/projectsApi';
import type { NotificationSettings } from '@/types/notifications';
import type { Project } from '@/lib/projectsApi';

import {
  Bell,
  BellOff,
  Moon,
  Filter,
  Check,
  Save,
  RefreshCw,
  Building2,
  Home,
  X,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Greenhouse {
  id: number;
  projectId: number;
  ghKey: string;
  nameTh: string;
}

export function NotificationSettingsPageEnhanced() {
  const { addToast } = useToast();
  const { permission, isSupported, requestPermission } = useBrowserNotification();
  
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [greenhouses, setGreenhouses] = useState<Greenhouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchProjects();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await notificationsApi.getSettings();

      if (response.success && response.data) {
        setSettings(response.data.settings);
        setHasChanges(false);
      }
    } catch (error) {
      addToast({ type: 'error', message: 'ไม่สามารถโหลดการตั้งค่าได้' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const projectsList = await projectsApi.getProjects();
      setProjects(projectsList);

      const allGreenhouses: Greenhouse[] = [];
      for (const project of projectsList) {
        const ghData = await projectsApi.getGreenhouses(project.key);
        allGreenhouses.push(
          ...ghData.greenhouses.map((gh: any) => ({
            id: gh.id,
            projectId: project.id,
            ghKey: gh.ghKey,
            nameTh: gh.nameTh,
          }))
        );
      }

      setGreenhouses(allGreenhouses);
    } catch (error) {
     console.error('Failed to fetch projects:', error);
     addToast({ type: 'error', message: 'ไม่สามารถโหลดรายการโปรเจกต์/โรงเรือนได้' });
    }
  };

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    
    if (granted) {
      addToast({ 
        type: 'success', 
        message: 'เปิดใช้งานการแจ้งเตือนสำเร็จ! คุณจะได้รับการแจ้งเตือนแบบเรียลไทม์' 
      });
    } else {
      addToast({ 
        type: 'error', 
        message: 'ไม่สามารถเปิดใช้งานการแจ้งเตือนได้ กรุณาตรวจสอบการตั้งค่าเบราว์เซอร์' 
      });
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setIsSaving(true);
    try {
      const response = await notificationsApi.updateSettings(settings);

      if (response.success) {
        addToast({ type: 'success', message: 'บันทึกการตั้งค่าสำเร็จ' });
        setHasChanges(false);
      }
    } catch (error) {
      addToast({ type: 'error', message: 'ไม่สามารถบันทึกการตั้งค่าได้' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (key: keyof NotificationSettings) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: !settings[key] });
    setHasChanges(true);
  };

  const handleTimeChange = (key: 'quiet_hours_start' | 'quiet_hours_end', value: string) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setHasChanges(true);
  };

  const handleProjectToggle = (projectId: number) => {
    if (!settings) return;

    const projectIdStr = projectId.toString();
    const currentFilters = [...settings.project_filter];
    const index = currentFilters.indexOf(projectIdStr);

    if (index > -1) {
      currentFilters.splice(index, 1);
    } else {
      currentFilters.push(projectIdStr);
    }

    setSettings({ ...settings, project_filter: currentFilters });
    setHasChanges(true);
  };

  const handleGreenhouseToggle = (greenhouseId: number) => {
    if (!settings) return;

    const greenhouseIdStr = greenhouseId.toString();
    const currentFilters = [...settings.greenhouse_filter];
    const index = currentFilters.indexOf(greenhouseIdStr);

    if (index > -1) {
      currentFilters.splice(index, 1);
    } else {
      currentFilters.push(greenhouseIdStr);
    }

    setSettings({ ...settings, greenhouse_filter: currentFilters });
    setHasChanges(true);
  };

  const handleSelectAllProjects = () => {
    if (!settings) return;
    setSettings({
      ...settings,
      project_filter: projects.map((p) => p.id.toString()),
    });
    setHasChanges(true);
  };

  const handleClearAllProjects = () => {
    if (!settings) return;
    setSettings({ ...settings, project_filter: [] });
    setHasChanges(true);
  };

  const handleSelectAllGreenhouses = () => {
    if (!settings) return;
    setSettings({
      ...settings,
      greenhouse_filter: greenhouses.map((gh) => gh.id.toString()),
    });
    setHasChanges(true);
  };

  const handleClearAllGreenhouses = () => {
    if (!settings) return;
    setSettings({ ...settings, greenhouse_filter: [] });
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <PageContainer title="ตั้งค่าการแจ้งเตือน">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">กำลังโหลด...</div>
        </div>
      </PageContainer>
    );
  }

  if (!settings) {
    return (
      <PageContainer title="ตั้งค่าการแจ้งเตือน">
        <Card className="p-8 text-center">
          <p className="text-gray-500">ไม่พบการตั้งค่า</p>
          <Button onClick={fetchSettings} className="mt-4">
            <RefreshCw className="w-4 h-4" />
            ลองอีกครั้ง
          </Button>
        </Card>
      </PageContainer>
    );
  }

  const isProjectSelected = (projectId: number) =>
    settings.project_filter.includes(projectId.toString());

  const isGreenhouseSelected = (greenhouseId: number) =>
    settings.greenhouse_filter.includes(greenhouseId.toString());

  const ToggleCard = ({
    title,
    description,
    enabled,
    onToggle,
    icon: Icon,
  }: {
    title: string;
    description: string;
    enabled: boolean;
    onToggle: () => void;
    icon: any;
  }) => (
    <div
      className={cn(
        'flex items-start gap-4 p-4 rounded-lg border-2 transition-all cursor-pointer',
        enabled
          ? 'border-primary bg-primary/5 hover:bg-primary/10'
          : 'border-gray-200 bg-white hover:bg-gray-50'
      )}
      onClick={onToggle}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
          enabled ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
        )}
      >
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-medium">{title}</h4>
          {enabled && <Check className="w-5 h-5 text-primary flex-shrink-0" />}
        </div>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>
    </div>
  );

  // Browser Notification Permission Status Component
  const BrowserNotificationStatus = () => {
    if (!isSupported) {
      return (
        <Card className="p-4 mb-6 bg-gray-50 border-gray-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-700">เบราว์เซอร์ไม่รองรับการแจ้งเตือน</p>
              <p className="text-sm text-gray-600 mt-1">
                กรุณาใช้เบราว์เซอร์ที่รองรับ เช่น Chrome, Firefox, Edge
              </p>
            </div>
          </div>
        </Card>
      );
    }

    if (permission === 'denied') {
      return (
        <Card className="p-4 mb-6 bg-red-50 border-red-200">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-red-700">การแจ้งเตือนถูกปิดกั้น</p>
              <p className="text-sm text-red-600 mt-1">
                กรุณาเปิดการแจ้งเตือนในการตั้งค่าเบราว์เซอร์
              </p>
            </div>
          </div>
        </Card>
      );
    }

    if (permission === 'granted') {
      return (
        <Card className="p-4 mb-6 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-green-700">การแจ้งเตือนเปิดใช้งานแล้ว</p>
              <p className="text-sm text-green-600 mt-1">
                คุณจะได้รับการแจ้งเตือนแบบเรียลไทม์บนเบราว์เซอร์
              </p>
            </div>
          </div>
        </Card>
      );
    }

    // permission === 'default'
    return (
      <Card className="p-4 mb-6 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Bell className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-blue-700">เปิดใช้งานการแจ้งเตือนบนเบราว์เซอร์</p>
            <p className="text-sm text-blue-600 mt-1 mb-3">
              รับการแจ้งเตือนแบบเรียลไทม์เมื่อมีเหตุการณ์สำคัญ แม้ว่าคุณจะไม่ได้เปิดแท็บนี้อยู่
            </p>
            <Button 
              onClick={handleRequestPermission}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Bell className="w-4 h-4" />
              เปิดใช้งานตอนนี้
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <PageContainer title="ตั้งค่าการแจ้งเตือน">
      {/* Browser Notification Status */}
      <BrowserNotificationStatus />

      {/* General Settings */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold">ตั้งค่าทั่วไป</h3>
        </div>

        <ToggleCard
          title="เปิดการแจ้งเตือนแล้ว"
          description="คุณจะได้รับการแจ้งเตือนตามที่ตั้งค่าไว้"
          enabled={settings.enabled}
          onToggle={() => handleToggle('enabled')}
          icon={Bell}
        />
      </Card>

      {/* Project Filter */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold">กรองตามโปรเจกต์</h3>
            <Badge variant="secondary">{projects.length} โปรเจกต์</Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={handleSelectAllProjects}>
            <Check className="w-4 h-4" />
            เลือกทั้งหมด
          </Button>

          <Button variant="outline" size="sm" onClick={handleClearAllProjects}>
            <X className="w-4 h-4" />
            ล้างทั้งหมด
          </Button>

          <div className="text-sm text-gray-500 ml-2">
            ({settings.project_filter.length}/{projects.length})
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((project) => {
            const isSelected = isProjectSelected(project.id);

            return (
              <div
                key={project.id}
                onClick={() => handleProjectToggle(project.id)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0',
                    isSelected
                      ? 'bg-primary border-primary'
                      : 'border-gray-300 bg-white'
                  )}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{project.nameTh}</p>
                  <p className="text-xs text-gray-500">{project.key}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Greenhouse Filter */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold">กรองตามโรงเรือน</h3>
            <Badge variant="secondary">{greenhouses.length} โรงเรือน</Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={handleSelectAllGreenhouses}>
            <Check className="w-4 h-4" />
            เลือกทั้งหมด
          </Button>

          <Button variant="outline" size="sm" onClick={handleClearAllGreenhouses}>
            <X className="w-4 h-4" />
            ล้างทั้งหมด
          </Button>

          <div className="text-sm text-gray-500 ml-2">
            ({settings.greenhouse_filter.length}/{greenhouses.length})
          </div>
        </div>

        {/* Group by Project */}
        <div className="space-y-4">
          {projects.map((project) => {
            const projectGreenhouses = greenhouses.filter(
              (gh) => gh.projectId === project.id
            );

            if (projectGreenhouses.length === 0) return null;

            return (
              <div key={project.id}>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <h4 className="text-sm font-medium text-gray-700">
                    {project.nameTh}
                  </h4>
                  <span className="text-xs text-gray-500">
                    ({projectGreenhouses.length})
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pl-6">
                  {projectGreenhouses.map((greenhouse) => {
                    const isSelected = isGreenhouseSelected(greenhouse.id);

                    return (
                      <div
                        key={greenhouse.id}
                        onClick={() => handleGreenhouseToggle(greenhouse.id)}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div
                          className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0',
                            isSelected
                              ? 'bg-primary border-primary'
                              : 'border-gray-300 bg-white'
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {greenhouse.nameTh}
                          </p>
                          <p className="text-xs text-gray-500">{greenhouse.ghKey}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Notification Types */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold">ประเภทการแจ้งเตือน</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ToggleCard
            title="อุปกรณ์ออฟไลน์"
            description="แจ้งเตือนเมื่ออุปกรณ์ไม่สามารถเชื่อมต่อได้"
            enabled={settings.device_offline}
            onToggle={() => handleToggle('device_offline')}
            icon={BellOff}
          />

          <ToggleCard
            title="อุปกรณ์กลับมาออนไลน์"
            description="แจ้งเตือนเมื่ออุปกรณ์กลับมาเชื่อมต่อได้"
            enabled={settings.device_online}
            onToggle={() => handleToggle('device_online')}
            icon={Bell}
          />

          <ToggleCard
            title="ค่าเซ็นเซอร์ผิดปกติ"
            description="แจ้งเตือนเมื่อค่าเซ็นเซอร์เกินกำหนด"
            enabled={settings.sensor_alert}
            onToggle={() => handleToggle('sensor_alert')}
            icon={Bell}
          />

          <ToggleCard
            title="การควบคุมอุปกรณ์"
            description="แจ้งเตือนเมื่อมีการเปิด/ปิดอุปกรณ์"
            enabled={settings.control_action}
            onToggle={() => handleToggle('control_action')}
            icon={Bell}
          />

          <ToggleCard
            title="เปลี่ยนโหมด Auto"
            description="แจ้งเตือนเมื่อมีการเปลี่ยนการตั้งค่า Auto"
            enabled={settings.auto_mode_changed}
            onToggle={() => handleToggle('auto_mode_changed')}
            icon={Bell}
          />

          <ToggleCard
            title="ข้อผิดพลาดระบบ"
            description="แจ้งเตือนเมื่อมีข้อผิดพลาดของระบบ"
            enabled={settings.system_error}
            onToggle={() => handleToggle('system_error')}
            icon={Bell}
          />
        </div>
      </Card>

      {/* Severity Filters */}
      <Card className="p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">ระดับความสำคัญ</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ToggleCard
            title="ข้อมูล (Info)"
            description="การแจ้งเตือนทั่วไป"
            enabled={settings.show_info}
            onToggle={() => handleToggle('show_info')}
            icon={Bell}
          />

          <ToggleCard
            title="เตือน (Warning)"
            description="สิ่งที่ควรให้ความสนใจ"
            enabled={settings.show_warning}
            onToggle={() => handleToggle('show_warning')}
            icon={Bell}
          />

          <ToggleCard
            title="วิกฤต (Critical)"
            description="ต้องดำเนินการทันที"
            enabled={settings.show_critical}
            onToggle={() => handleToggle('show_critical')}
            icon={Bell}
          />
        </div>
      </Card>

      {/* Quiet Hours */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Moon className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold">ช่วงเวลาเงียบ</h3>
        </div>

        <div className="space-y-4">
          <div
            className="flex items-center gap-4 cursor-pointer"
            onClick={() => handleToggle('quiet_hours_enabled')}
          >
            <input
              type="checkbox"
              checked={settings.quiet_hours_enabled}
              onChange={() => {}}
              className="w-5 h-5 text-primary rounded cursor-pointer"
            />
            <div>
              <p className="font-medium">เปิดใช้งานช่วงเวลาเงียบ</p>
              <p className="text-sm text-gray-600">
                ไม่รับการแจ้งเตือนในช่วงเวลาที่กำหนด
              </p>
            </div>
          </div>

          {settings.quiet_hours_enabled && (
            <div className="grid grid-cols-2 gap-4 pl-9">
              <div>
                <label className="block text-sm font-medium mb-2">เริ่มต้น</label>
                <input
                  type="time"
                  value={settings.quiet_hours_start}
                  onChange={(e) => handleTimeChange('quiet_hours_start', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">สิ้นสุด</label>
                <input
                  type="time"
                  value={settings.quiet_hours_end}
                  onChange={(e) => handleTimeChange('quiet_hours_end', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="col-span-2 text-sm text-gray-600">
                ตัวอย่าง: {settings.quiet_hours_start} - {settings.quiet_hours_end}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 z-50">
          <Card className="p-4 shadow-lg">
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-600">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</p>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    บันทึก
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}