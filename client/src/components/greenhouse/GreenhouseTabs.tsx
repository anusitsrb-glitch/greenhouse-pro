import { cn } from '@/lib/utils';
import { Sprout, BarChart3, Sliders, Clock } from 'lucide-react';

// Tab order MUST be: ค่าดิน -> กราฟ -> ควบคุม -> ตั้งเวลา
export type TabKey = 'soil' | 'charts' | 'dashboard' | 'timers';

interface Tab {
  key: TabKey;
  label: string;
  icon: typeof Sprout;
}

const TABS: Tab[] = [
  { key: 'soil', label: 'ค่าดิน', icon: Sprout },
  { key: 'charts', label: 'กราฟ', icon: BarChart3 },
  { key: 'dashboard', label: 'ควบคุม', icon: Sliders },
  { key: 'timers', label: 'ตั้งเวลา', icon: Clock },
];

interface GreenhouseTabsProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  disabled?: boolean;
}

export function GreenhouseTabs({ activeTab, onTabChange, disabled }: GreenhouseTabsProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-1.5 flex gap-1">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            onClick={() => !disabled && onTabChange(tab.key)}
            disabled={disabled}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg',
              'text-sm font-medium transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary/50',
              isActive
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Mobile-friendly bottom tabs version
export function GreenhouseTabsBottom({ activeTab, onTabChange, disabled }: GreenhouseTabsProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 z-20 md:hidden">
      <div className="flex gap-1 max-w-lg mx-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => !disabled && onTabChange(tab.key)}
              disabled={disabled}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2 rounded-lg',
                'text-xs font-medium transition-all duration-200',
                isActive
                  ? 'text-primary'
                  : 'text-gray-500',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Icon className={cn(
                'w-5 h-5',
                isActive && 'text-primary'
              )} />
              <span>{tab.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
