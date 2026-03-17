import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { PageLoading, ToastContainer } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { LoginPage } from '@/pages/LoginPage';
import { HomePage } from '@/pages/HomePage';
import { ProjectPage } from '@/pages/ProjectPage';
import { GreenhousePage } from '@/pages/GreenhousePage';
import { ProfilePage } from '@/pages/ProfilePage';
import { NotificationPermissionBanner } from '@/components/notifications';
import { 
  UsersPage, ProjectsPage, GreenhousesPage, NotificationsPage, 
  SettingsPage, SensorsPage, AlertsPage, AuditLogPage,
  AutomationPage, ScenesPage, ControlHistoryPage as AdminControlHistoryPage,
  AdminLayout
} from '@/pages/admin';
import { AppSettingsProvider, type ThemeMode } from '@/hooks/useAppSettings';
import type { Language } from '@/i18n';
import {
  ControlHistoryPage,
  NotificationSettingsPage,
  NotificationsListPage,
} from '@/pages';
import { ReactNode, useEffect } from 'react';
import { useOfflineBanner } from '@/hooks/useNetworkStatus';
import { ENV } from '@/config/env';
import { App as CapacitorApp } from '@capacitor/app';
import { 
  CropsPage, GrowthRecordsPage, FertilizerPage, 
  PestDiseasePage, YieldPage, WaterUsagePage,
  AgriculturePage
} from '@/pages/agriculture';

function hasRole(userRole: string | undefined, allowedRoles: string[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <PageLoading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!hasRole(user?.role, ['admin', 'superadmin'])) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function OperatorRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <PageLoading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!hasRole(user?.role, ['operator', 'admin', 'superadmin'])) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoading />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { toasts, removeToast } = useToast();
  const { isAuthenticated } = useAuth();
  const { showBanner } = useOfflineBanner();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ENV.IS_CAPACITOR) return;
    const handler = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        navigate(-1);
      } else {
        CapacitorApp.exitApp();
      }
    });
    return () => {
      handler.then((h) => h.remove());
    };
  }, [navigate]);

  return (
    <>
      {showBanner && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-2 z-50 text-sm font-medium">
          ⚠️ ไม่มีการเชื่อมต่ออินเทอร์เน็ต
        </div>
      )}
      
      {isAuthenticated && <NotificationPermissionBanner />}
      
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/project/:projectKey" element={<ProtectedRoute><ProjectPage /></ProtectedRoute>} />
        <Route path="/project/:projectKey/:ghKey" element={<ProtectedRoute><GreenhousePage /></ProtectedRoute>} />
        <Route path="/agriculture" element={<ProtectedRoute><AgriculturePage /></ProtectedRoute>} />
        <Route path="/agriculture/crops" element={<ProtectedRoute><CropsPage /></ProtectedRoute>} />
        <Route path="/agriculture/growth" element={<ProtectedRoute><GrowthRecordsPage /></ProtectedRoute>} />
        <Route path="/agriculture/fertilizer" element={<ProtectedRoute><FertilizerPage /></ProtectedRoute>} />
        <Route path="/agriculture/pest-disease" element={<ProtectedRoute><PestDiseasePage /></ProtectedRoute>} />
        <Route path="/agriculture/yield" element={<ProtectedRoute><YieldPage /></ProtectedRoute>} />
        <Route path="/agriculture/water" element={<ProtectedRoute><WaterUsagePage /></ProtectedRoute>} />
        <Route path="/alerts" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
        <Route path="/control-history" element={<ProtectedRoute><ControlHistoryPage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsListPage /></ProtectedRoute>} />
        <Route path="/notifications/settings" element={<ProtectedRoute><NotificationSettingsPage /></ProtectedRoute>} />
        <Route path="/admin/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
        <Route path="/admin/projects" element={<AdminRoute><ProjectsPage /></AdminRoute>} />
        <Route path="/admin/greenhouses" element={<AdminRoute><GreenhousesPage /></AdminRoute>} />
        <Route path="/admin/sensors" element={<AdminRoute><SensorsPage /></AdminRoute>} />
        <Route path="/admin/notifications" element={<AdminRoute><NotificationsPage /></AdminRoute>} />
        <Route path="/admin/alerts" element={<AdminRoute><AlertsPage /></AdminRoute>} />
        <Route path="/admin/audit" element={<AdminRoute><AuditLogPage /></AdminRoute>} />
        <Route path="/admin/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
        <Route path="/admin/automation" element={<AdminRoute><AutomationPage /></AdminRoute>} />
        <Route path="/admin/scenes" element={<AdminRoute><ScenesPage /></AdminRoute>} />
        <Route path="/admin/control-history" element={<AdminRoute><AdminControlHistoryPage /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}

// ✅ แก้: รอ user โหลดเสร็จก่อน render AppSettingsProvider
// เพื่อให้ initialLanguage / initialTheme ได้ค่าจริงจาก user
function AppInner() {
  const { user, isLoading } = useAuth();

  // รอ checkAuth เสร็จก่อน — ถ้า render ก่อนจะได้ 'th'/'light' เป็น initial เสมอ
  if (isLoading) return <PageLoading />;

  return (
    <AppSettingsProvider
      initialLanguage={(user?.language as Language) || 'th'}
      initialTheme={(user?.theme as ThemeMode) || 'light'}
    >
      <AppRoutes />
    </AppSettingsProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </BrowserRouter>
  );
}