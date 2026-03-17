import { Sprout, BarChart3, Sliders, Clock, Zap } from 'lucide-react';
import { useT } from '@/i18n';

export type TabKey = 'soil' | 'charts' | 'dashboard' | 'timers' | 'automation';

interface GreenhouseTabsProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  disabled?: boolean;
}

export function GreenhouseTabs({ activeTab, onTabChange, disabled = false }: GreenhouseTabsProps) {
  const { t } = useT();

  const tabs = [
    { id: 'soil' as TabKey, name: t('dashboard.soilTab'), icon: Sprout },
    { id: 'charts' as TabKey, name: t('dashboard.chartsTab'), icon: BarChart3 },
    { id: 'dashboard' as TabKey, name: t('dashboard.controlTab'), icon: Sliders },
    { id: 'timers' as TabKey, name: t('dashboard.timersTab'), icon: Clock },
    { id: 'automation' as TabKey, name: t('dashboard.autoTab'), icon: Zap },
  ];

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <nav className="-mb-px flex space-x-8 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => !disabled && onTabChange(tab.id)}
              disabled={disabled}
              className={`
                group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                ${isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                transition-colors
              `}
            >
              <Icon className={`
                ${isActive ? 'text-primary' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-300'}
                -ml-0.5 mr-2 h-5 w-5
              `} />
              {tab.name}
            </button>
          );
        })}
      </nav>
    </div>
  );
}