import { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, Check } from 'lucide-react';
import { exportApi, ExportParams } from '@/lib/exportApi';
import { useToast } from '@/hooks/useToast';

interface ExportButtonProps {
  projectKey: string;
  ghKey: string;
  telemetryKeys: string[];
  disabled?: boolean;
}

const EXPORT_OPTIONS = [
  { days: 7, label: '7 วัน' },
  { days: 30, label: '30 วัน' },
  { days: 90, label: '90 วัน' },
];

export function ExportButton({ projectKey, ghKey, telemetryKeys, disabled }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  // Close dropdown when clicking outside
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

    const params: ExportParams = {
      projectKey,
      ghKey,
      keys: telemetryKeys,
      days,
    };

    try {
      await exportApi.toExcel(params);
      addToast({
        type: 'success',
        message: `ดาวน์โหลดข้อมูล ${days} วันสำเร็จ`,
      });
    } catch (error) {
      console.error('Export error:', error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'ไม่สามารถ Export ได้',
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
            <span className="hidden sm:inline">กำลังดาวน์โหลด...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Excel</span>
          </>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && !isExporting && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <div className="px-3 py-2 text-xs text-gray-500 font-medium border-b border-gray-100">
            เลือกช่วงเวลา
          </div>
          {EXPORT_OPTIONS.map((option) => (
            <button
              key={option.days}
              onClick={() => handleExport(option.days)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}