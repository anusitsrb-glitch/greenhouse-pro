import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui';
import { Leaf, LogOut, User, ChevronRight, Settings, Sprout } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { NotificationBell } from '@/components/notifications';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface HeaderProps {
  breadcrumbs?: Breadcrumb[];
}

export function Header({ breadcrumbs }: HeaderProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-red-100 text-red-800';
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'operator':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'Super Admin';
      case 'admin':
        return 'ผู้ดูแลระบบ';
      case 'operator':
        return 'ผู้ควบคุม';
      default:
        return 'ผู้ชม';
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isOperator = isAdmin || user?.role === 'operator';

  return (
    <header className="bg-white shadow-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo & Breadcrumbs */}
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-sm">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900 hidden sm:block">
                GreenHouse Pro
              </span>
            </Link>

            {/* Breadcrumbs */}
            {breadcrumbs && breadcrumbs.length > 0 && (
              <nav className="hidden md:flex items-center gap-1 text-sm">
                <ChevronRight className="w-4 h-4 text-gray-400" />
                {breadcrumbs.map((crumb, index) => (
                  <div key={index} className="flex items-center gap-1">
                    {crumb.href ? (
                      <Link
                        to={crumb.href}
                        className="text-gray-500 hover:text-primary transition-colors"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-gray-900 font-medium">{crumb.label}</span>
                    )}
                    {index < breadcrumbs.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                ))}
              </nav>
            )}
          </div>

          {/* Navigation & User Menu */}
          <div className="flex items-center gap-2">
            {/* Agriculture Menu - visible to all */}
            <Link
              to="/agriculture/crops"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                location.pathname.startsWith('/agriculture')
                  ? 'text-primary bg-primary/10'
                  : 'text-gray-600 hover:text-primary hover:bg-primary/5'
              }`}
            >
              <Sprout className="w-4 h-4" />
              <span className="hidden sm:inline">การเกษตร</span>
            </Link>

            {/* 🆕 Notification Bell - Phase 1 */}
            <NotificationBell />

            {/* Admin Link - only for admin/superadmin */}
            {isAdmin && (
              <Link
                to="/admin/users"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  location.pathname.startsWith('/admin')
                    ? 'text-primary bg-primary/10'
                    : 'text-gray-600 hover:text-primary hover:bg-primary/5'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}

            {/* User Info (Desktop only - unchanged) */}
            <div className="hidden sm:flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
              <Link to="/profile" className="flex items-center gap-2 hover:opacity-80">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{user?.username}</div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(
                      user?.role || ''
                    )}`}
                  >
                    {getRoleLabel(user?.role || '')}
                  </span>
                </div>
              </Link>
            </div>

            {/* ✅ User Profile (Mobile only) */}
            <Link
              to="/profile"
              className="sm:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              aria-label="โปรไฟล์"
              title="โปรไฟล์"
            >
              <User className="w-4 h-4" />
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-gray-600 hover:text-gray-900"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">ออก</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
