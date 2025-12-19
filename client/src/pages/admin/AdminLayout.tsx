import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { 
  Leaf, Users, FolderKanban, Home as HomeIcon, Bell, Settings, ArrowLeft, LogOut,
  Gauge, Zap, PlaySquare, Shield, History, Sprout, Droplets, Bug, Package, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

const NAV_SECTIONS = [
  {
    title: 'ระบบ',
    items: [
      { href: '/admin/users', label: 'จัดการผู้ใช้', icon: Users },
      { href: '/admin/projects', label: 'จัดการโปรเจกต์', icon: FolderKanban },
      { href: '/admin/greenhouses', label: 'จัดการโรงเรือน', icon: HomeIcon },
      { href: '/admin/sensors', label: 'จัดการ Sensor', icon: Gauge },
    ]
  },
  {
    title: 'ควบคุม',
    items: [
      { href: '/admin/automation', label: 'Automation Rules', icon: Zap },
      { href: '/admin/scenes', label: 'Scenes / Presets', icon: PlaySquare },
      { href: '/admin/control-history', label: 'ประวัติการควบคุม', icon: History },
    ]
  },
  {
    title: 'การเกษตร',
    items: [
      { href: '/agriculture/crops', label: 'จัดการพืช', icon: Sprout },
      { href: '/agriculture/growth', label: 'บันทึกการเติบโต', icon: Activity },
      { href: '/agriculture/fertilizer', label: 'ตารางใส่ปุ๋ย', icon: Droplets },
      { href: '/agriculture/pest-disease', label: 'โรค/แมลง', icon: Bug },
      { href: '/agriculture/yield', label: 'ผลผลิต', icon: Package },
      { href: '/agriculture/water', label: 'การใช้น้ำ', icon: Droplets },
    ]
  },
  {
    title: 'แจ้งเตือน',
    items: [
      { href: '/admin/notifications', label: 'ตั้งค่าแจ้งเตือน', icon: Bell },
      { href: '/admin/alerts', label: 'ประวัติ Alert', icon: Bell },
    ]
  },
  {
    title: 'ตั้งค่า',
    items: [
      { href: '/admin/security', label: 'Security', icon: Shield },
      { href: '/admin/audit', label: 'Audit Log', icon: History },
      { href: '/admin/settings', label: 'ตั้งค่าระบบ', icon: Settings },
    ]
  },
];

export function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-gray-900 text-white z-40 hidden lg:block overflow-y-auto">
        {/* Logo */}
        <div className="p-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">GreenHouse Pro</h1>
              <p className="text-xs text-gray-400">Admin Panel</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-6">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-4">{section.title}</h3>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm',
                        isActive ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Back to app */}
        <div className="p-4 border-t border-gray-800 mt-4">
          <Link to="/" className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            <span>กลับหน้าหลัก</span>
          </Link>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden bg-gray-900 text-white px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-gray-800"><ArrowLeft className="w-5 h-5" /></button>
            <h1 className="font-semibold">Admin Panel</h1>
          </div>
          <button onClick={logout} className="p-2 rounded-lg hover:bg-gray-800"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      {/* Mobile navigation */}
      <nav className="lg:hidden bg-white border-b px-2 py-2 overflow-x-auto sticky top-12 z-20">
        <div className="flex gap-1 min-w-max">
          {NAV_SECTIONS.flatMap(s => s.items).slice(0, 8).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link key={item.href} to={item.href} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors', isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100')}>
                <Icon className="w-4 h-4" /><span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen">
        <div className="bg-white border-b px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
