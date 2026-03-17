import { useState } from 'react';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { FileText, Download, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getApiUrl, ENV } from '@/config/env';
import { api } from '@/lib/api';
import { useT } from '@/i18n';

import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface ReportDownloadProps {
  projectKey: string;
  ghKey: string;
}

type Period = '1d' | '7d' | '30d';

export function ReportDownload({ projectKey, ghKey }: ReportDownloadProps) {
  const { t } = useT();
  const { addToast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('7d');
  const [isDownloading, setIsDownloading] = useState(false);

  const PERIODS: { key: Period; label: string; desc: string }[] = [
    { key: '1d', label: t('report.period1d'), desc: t('report.period1dDesc') },
    { key: '7d', label: t('report.period7d'), desc: t('report.period7dDesc') },
    { key: '30d', label: t('report.period30d'), desc: t('report.period30dDesc') },
  ];

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const filename = `greenhouse-report-${projectKey}-${ghKey}-${selectedPeriod}.pdf`;

      if (ENV.IS_CAPACITOR) {
        const { CapacitorHttp } = await import('@capacitor/core');
        const csrf = await api.getCsrfToken();
        const url = getApiUrl(`/api/reports/download?project=${projectKey}&gh=${ghKey}&period=${selectedPeriod}`);

        const response = await CapacitorHttp.get({
          url,
          headers: { 'X-CSRF-Token': csrf },
          responseType: 'blob',
          webFetchExtra: { credentials: 'include' },
        });

        await Filesystem.writeFile({
          path: filename,
          data: response.data,
          directory: Directory.Cache,
        });

        const fileUri = await Filesystem.getUri({
          path: filename,
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'GreenHouse Report',
          url: fileUri.uri,
          dialogTitle: t('report.shareTitle'),
        });

        addToast({ type: 'success', message: t('report.successMsg') });
      } else {
        const csrfResponse = await fetch(getApiUrl('/api/auth/csrf'), { credentials: 'include' });
        const csrfData = await csrfResponse.json();
        const csrfToken = csrfData.data?.csrfToken;

        const url = getApiUrl(`/api/reports/download?project=${projectKey}&gh=${ghKey}&period=${selectedPeriod}`);
        const response = await fetch(url, {
          credentials: 'include',
          headers: { 'X-CSRF-Token': csrfToken || '' },
        });

        if (!response.ok) throw new Error(t('report.errFailed'));

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);

        addToast({ type: 'success', message: t('report.successMsg') });
      }
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : t('common.error') });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card className="dark:bg-gray-800">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('report.title')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('report.subtitle')}</p>
          </div>
        </div>

        {/* Period selector */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {PERIODS.map((period) => (
            <button
              key={period.key}
              onClick={() => setSelectedPeriod(period.key)}
              className={cn(
                'p-3 rounded-lg border-2 text-center transition-all',
                selectedPeriod === period.key
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
              )}
            >
              <Calendar className={cn(
                'w-5 h-5 mx-auto mb-1',
                selectedPeriod === period.key ? 'text-primary' : 'text-gray-400 dark:text-gray-500'
              )} />
              <p className={cn(
                'font-medium text-sm',
                selectedPeriod === period.key ? 'text-primary' : 'text-gray-700 dark:text-gray-300'
              )}>
                {period.label}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{period.desc}</p>
            </button>
          ))}
        </div>

        {/* Download button */}
        <Button onClick={handleDownload} isLoading={isDownloading} className="w-full">
          <Download className="w-4 h-4" />
          {t('report.downloadBtn')}
        </Button>
      </div>
    </Card>
  );
}