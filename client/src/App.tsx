import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

// 🆕 Phase 2 Pages
import {
  ControlHistoryPage,
  NotificationSettingsPage,
  NotificationsListPage,
} from '@/pages';

import { ReactNode, useEffect } from 'react';


// Check if user has at least the required role
function hasRole(userRole: string | undefined, allowedRoles: string[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

// Protected route component - any authenticated user
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Admin route (requires admin or superadmin role)
function AdminRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <PageLoading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!hasRole(user?.role, ['admin', 'superadmin'])) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

// Operator route (requires operator, admin, or superadmin role)
function OperatorRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <PageLoading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!hasRole(user?.role, ['operator', 'admin', 'superadmin'])) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

// Public route (redirect to home if authenticated)
function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoading />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Main app content with routes
// Main app content with routes
function AppRoutes() {
  const { toasts, removeToast } = useToast();
  const { isAuthenticated, user } = useAuth();


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

    // system
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user]);

  
  return (
    <>
      {isAuthenticated && <NotificationPermissionBanner />}
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        
        {/* Protected Routes - All authenticated users */}
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/project/:projectKey" element={<ProtectedRoute><ProjectPage /></ProtectedRoute>} />
        <Route path="/project/:projectKey/:ghKey" element={<ProtectedRoute><GreenhousePage /></ProtectedRoute>} />
        
        {/* Agriculture Routes */}
        <Route path="/agriculture/crops" element={<ProtectedRoute><CropsPage /></ProtectedRoute>} />
        <Route path="/agriculture/growth" element={<ProtectedRoute><GrowthRecordsPage /></ProtectedRoute>} />
        <Route path="/agriculture/fertilizer" element={<ProtectedRoute><FertilizerPage /></ProtectedRoute>} />
        <Route path="/agriculture/pest-disease" element={<ProtectedRoute><PestDiseasePage /></ProtectedRoute>} />
        <Route path="/agriculture/yield" element={<ProtectedRoute><YieldPage /></ProtectedRoute>} />
        <Route path="/agriculture/water" element={<ProtectedRoute><WaterUsagePage /></ProtectedRoute>} />
        
        {/* Alerts Route */}
        <Route path="/alerts" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
        
        {/* 🆕 Phase 2 Routes - Notification System */}
        <Route path="/control-history" element={<ProtectedRoute><ControlHistoryPage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsListPage /></ProtectedRoute>} />
        <Route path="/notifications/settings" element={<ProtectedRoute><NotificationSettingsPage /></ProtectedRoute>} />
        
        {/* Admin Routes */}
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
        
        {/* Catch all - redirect to home */}
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