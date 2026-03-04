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
import { 
  CropsPage, GrowthRecordsPage, FertilizerPage, 
  PestDiseasePage, YieldPage, WaterUsagePage 
} from '@/pages/agriculture';

import {
  ControlHistoryPage,
  NotificationSettingsPage,
  NotificationsListPage,
} from '@/pages';

import { ReactNode, useEffect } from 'react';
import { useOfflineBanner } from '@/hooks/useNetworkStatus';
import { ENV } from '@/config/env';

// ✅ Patch M2: Android back button
import { App as CapacitorApp } from '@capacitor/app';

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
  const { isAuthenticated, user } = useAuth();
  const { showBanner } = useOfflineBanner();
  const navigate = useNavigate();

  // ✅ Patch M2: Android back button — ย้อน route แทนการออกแอป
  useEffect(() => {
    if (!ENV.IS_CAPACITOR) return;

    const handler = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        navigate(-1);
      } else {
        // อยู่หน้าแรกสุดแล้ว → ออกแอป
        CapacitorApp.exitApp();
      }
    });

    return () => {
      handler.then((h) => h.remove());
    };
  }, [navigate]);

  useEffect(() => {
    if (!user?.theme) return;

    if (user.theme === 'dark') {
      document.documentElement.classList.add('dark');
      return;
    }

    if (user.theme === 'light') {
      document.documentElement.classList.remove('dark');
      return;
    }

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user]);

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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}