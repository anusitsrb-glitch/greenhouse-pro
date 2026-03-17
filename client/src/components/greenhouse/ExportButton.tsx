import { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { exportApi, ExportParams } from '@/lib/exportApi';
import { useToast } from '@/hooks/useToast';
import { useT } from '@/i18n';

interface ExportButtonProps {
  projectKey: string;
  ghKey: string;
  telemetryKeys: string[];
  disabled?: boolean;
}

const EXPORT_DAYS = [7, 30, 90];

export function ExportButton({ projectKey, ghKey, telemetryKeys, disabled }: ExportButtonProps) {
  const { t } = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleExport = async (days: number) => {
    setIsExporting(true);
    setIsOpen(false);

    const params: ExportParams = { projectKey, ghKey, keys: telemetryKeys, days };

    try {
      await exportApi.toExcel(params);
      addToast({
        type: 'success',
        message: t('exportSimple.successMsg').replace('{n}', String(days)),
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : t('export.errFailed'),
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && !isExporting && setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Export Excel"
      >
        {isExporting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="hidden sm:inline">{t('export.downloading')}</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Excel</span>
          </>
        )}
      </button>

      {isOpen && !isExporting && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
          <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 font-medium border-b border-gray-100 dark:border-gray-700">
            {t('exportSimple.selectRange')}
          </div>
          {EXPORT_DAYS.map((days) => (
            <button
              key={days}
              onClick={() => handleExport(days)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
              <span>{t('exportSimple.days').replace('{n}', String(days))}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}