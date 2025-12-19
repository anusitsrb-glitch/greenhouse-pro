import { useState } from 'react';
import { Card, Button } from '@/components/ui';
import { adminApi } from '@/lib/adminApi';
import { useToast } from '@/hooks/useToast';
import { FileText, Download, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportDownloadProps {
  projectKey: string;
  ghKey: string;
}

type Period = '1d' | '7d' | '30d';

const PERIODS: { key: Period; label: string; desc: string }[] = [
  { key: '1d', label: 'รายวัน', desc: '24 ชั่วโมงย้อนหลัง' },
  { key: '7d', label: 'รายสัปดาห์', desc: '7 วันย้อนหลัง' },
  { key: '30d', label: 'รายเดือน', desc: '30 วันย้อนหลัง' },
];

export function ReportDownload({ projectKey, ghKey }: ReportDownloadProps) {
  const { addToast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('7d');
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // Get CSRF token first
      const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' });
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.data?.csrfToken;

      // Fetch PDF
      const url = `/api/reports/download?project=${projectKey}&gh=${ghKey}&period=${selectedPeriod}`;
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
      });

      if (!response.ok) {
        throw new Error('ไม่สามารถดาวน์โหลดรายงานได้');
      }

      // Download file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `greenhouse-report-${projectKey}-${ghKey}-${selectedPeriod}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      addToast({ type: 'success', message: 'ดาวน์โหลดรายงานสำเร็จ' });
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด' });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">ดาวน์โหลดรายงาน PDF</h3>
            <p className="text-sm text-gray-500">สรุปข้อมูล sensor และสถิติ</p>
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
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <Calendar className={cn(
                'w-5 h-5 mx-auto mb-1',
                selectedPeriod === period.key ? 'text-primary' : 'text-gray-400'
              )} />
              <p className={cn(
                'font-medium text-sm',
                selectedPeriod === period.key ? 'text-primary' : 'text-gray-700'
              )}>
                {period.label}
              </p>
              <p className="text-xs text-gray-500">{period.desc}</p>
            </button>
          ))}
        </div>

        {/* Download button */}
        <Button onClick={handleDownload} isLoading={isDownloading} className="w-full">
          <Download className="w-4 h-4" />
          ดาวน์โหลดรายงาน
        </Button>
      </div>
    </Card>
  );
}
