import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout';
import { 
  GreenhouseTabs, 
  GreenhouseTabsBottom,
  DevelopingBanner,
  OfflineBanner,
  SoilTab,
  DashboardTab,
  ChartsTab,
  TimersTab,
  AutomationTab, // ← ชื่อเดิม ไม่ต้องเปลี่ยน
  TabKey 
} from '@/components/greenhouse';
import { Button, Loading } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { projectsApi, GreenhouseDetail, ProjectDetail } from '@/lib/projectsApi';
import { tbApi } from '@/lib/tbApi';
import { AlertCircle, RefreshCw, ArrowLeft, Wifi, WifiOff } from 'lucide-react';

export function GreenhousePage() {
  const { projectKey, ghKey } = useParams<{ projectKey: string; ghKey: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [greenhouse, setGreenhouse] = useState<GreenhouseDetail | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [lastStatusCheck, setLastStatusCheck] = useState<number>(Date.now());
  
  // Default tab is Soil (ค่าดิน)
  const [activeTab, setActiveTab] = useState<TabKey>('soil');

  const checkDeviceStatus = useCallback(async () => {
    if (!projectKey || !ghKey) return;
    
    try {
      const status = await tbApi.getDeviceStatus(projectKey, ghKey);
      setIsOnline(status.online);
      setLastStatusCheck(Date.now());
    } catch {
      setIsOnline(false);
      setLastStatusCheck(Date.now());
    }
  }, [projectKey, ghKey]);

  const fetchData = async () => {
    if (!projectKey || !ghKey) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await projectsApi.getGreenhouse(projectKey, ghKey);
      setGreenhouse(data.greenhouse);
      setProject(data.project);
      
      // Check device status if device is linked
      if (data.greenhouse.hasDevice) {
        await checkDeviceStatus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectKey, ghKey]);

  // หมายเลข 1: Polling สถานะออนไลน์/ออฟไลน์ทุก 30 วินาที
  useEffect(() => {
    if (!greenhouse?.hasDevice) return;

    const interval = setInterval(() => {
      checkDeviceStatus();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [greenhouse?.hasDevice, checkDeviceStatus]);

  // Determine if controls should be disabled
  const isDeveloping = greenhouse?.status === 'developing' || !greenhouse?.hasDevice;
  const isDeviceOffline = isOnline === false;
  const controlsDisabled = isDeveloping || isDeviceOffline;

  const breadcrumbs = project && greenhouse ? [
    { label: project.nameTh, href: `/project/${projectKey}` },
    { label: greenhouse.nameTh }
  ] : [];

  // Render tab content
  const renderTabContent = () => {
    if (!projectKey || !ghKey) return null;

    const isReady = greenhouse?.status === 'ready' && greenhouse?.hasDevice;
    const deviceOnline = isOnline === true;
    const userRole = user?.role || 'viewer';

    switch (activeTab) {
      case 'soil':
        return <SoilTab project={projectKey} gh={ghKey} isReady={isReady} />;
      case 'charts':
        return <ChartsTab project={projectKey} gh={ghKey} isReady={isReady} />;
      case 'dashboard':
        return (
          <DashboardTab 
            project={projectKey} 
            gh={ghKey} 
            isReady={isReady}
            isOnline={deviceOnline}
            userRole={userRole}
          />
        );
      case 'timers':
        return (
          <TimersTab 
            project={projectKey} 
            gh={ghKey} 
            isReady={isReady}
            isOnline={deviceOnline}
            userRole={userRole}
          />
        );
      case 'automation': // NEW!
        return (
          <AutomationTab 
            project={projectKey} 
            gh={ghKey} 
            isReady={isReady}
            isOnline={deviceOnline}
            userRole={userRole}
          />
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <Loading message="กำลังโหลดข้อมูลโรงเรือน..." />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">เกิดข้อผิดพลาด</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" />
              กลับ
            </Button>
            <Button onClick={fetchData}>
              <RefreshCw className="w-4 h-4" />
              ลองใหม่
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer breadcrumbs={breadcrumbs}>
      {/* Back button (mobile) */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(`/project/${projectKey}`)}
        className="mb-4 -ml-2 md:hidden"
      >
        <ArrowLeft className="w-4 h-4" />
        กลับ
      </Button>

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-lg">
            {greenhouse?.ghKey.match(/\d+/)?.[0] || '?'}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {greenhouse?.nameTh}
            </h1>
            <p className="text-sm text-gray-500">
              {project?.nameTh}
            </p>
          </div>
        </div>

        {/* Online/Offline Status */}
        {greenhouse?.hasDevice && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            isOnline 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {isOnline ? (
              <>
                <Wifi className="w-4 h-4" />
                <span>ออนไลน์</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                <span>ออฟไลน์</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Banners */}
      {isDeveloping && <DevelopingBanner />}
      {!isDeveloping && isDeviceOffline && <OfflineBanner />}

      {/* Tabs */}
      <div className="mb-6 hidden md:block">
        <GreenhouseTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          disabled={false}
        />
      </div>

      {/* Tab Content */}
      <div className="pb-20 md:pb-0">
        {renderTabContent()}
      </div>

      {/* Mobile Bottom Tabs */}
      <GreenhouseTabsBottom
        activeTab={activeTab}
        onTabChange={setActiveTab}
        disabled={false}
      />
    </PageContainer>
  );
}
