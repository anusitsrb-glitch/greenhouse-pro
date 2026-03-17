import { Sprout, BarChart3, Sliders, Clock, Zap } from 'lucide-react';
import { useT } from '@/i18n';

export type TabKey = 'soil' | 'charts' | 'dashboard' | 'timers' | 'automation';

interface GreenhouseTabsBottomProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  disabled?: boolean;
}

export function GreenhouseTabsBottom({ activeTab, onTabChange, disabled = false }: GreenhouseTabsBottomProps) {
  const { t } = useT();

  const tabs = [
    { id: 'soil' as TabKey,       name: t('dashboard.soilTab'),    icon: Sprout },
    { id: 'charts' as TabKey,     name: t('dashboard.chartsTab'),  icon: BarChart3 },
    { id: 'dashboard' as TabKey,  name: t('dashboard.controlTab'), icon: Sliders },
    { id: 'timers' as TabKey,     name: t('dashboard.timersTab'),  icon: Clock },
    { id: 'automation' as TabKey, name: t('dashboard.autoTab'),    icon: Zap },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 md:hidden z-50 safe-area-bottom">
      <nav className="flex justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => !disabled && onTabChange(tab.id)}
              disabled={disabled}
              className={`
                flex flex-col items-center justify-center py-2 px-3 flex-1
                ${isActive ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:bg-gray-100 dark:active:bg-gray-800'}
                transition-colors
              `}
            >
              <Icon className={`h-6 w-6 mb-1 ${isActive ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`} />
              <span className={`text-xs font-medium ${isActive ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}`}>
                {tab.name}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}