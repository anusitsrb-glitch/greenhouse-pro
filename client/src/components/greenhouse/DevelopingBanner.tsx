import { Construction, AlertTriangle } from 'lucide-react';
import { useT } from '@/i18n';

interface DevelopingBannerProps {
  reason?: string;
}

export function DevelopingBanner({ reason }: DevelopingBannerProps) {
  const { t } = useT();

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center flex-shrink-0">
          <Construction className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
        </div>
        <div>
          <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {t('banner.developingTitle')}
          </h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            {reason ?? t('banner.developingDefault')}
          </p>
          <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2">
            {t('banner.developingNote')}
          </p>
        </div>
      </div>
    </div>
  );
}

export function OfflineBanner() {
  const { t } = useT();

  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h3 className="font-semibold text-red-800 dark:text-red-300 mb-1">
            {t('banner.offlineTitle')}
          </h3>
          <p className="text-sm text-red-700 dark:text-red-400">
            {t('banner.offlineDesc')}
          </p>
        </div>
      </div>
    </div>
  );
}