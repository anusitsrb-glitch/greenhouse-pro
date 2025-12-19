import { Construction, AlertTriangle } from 'lucide-react';

interface DevelopingBannerProps {
  reason?: string;
}

export function DevelopingBanner({ 
  reason = 'ยังไม่มีการผูก ThingsBoard Device (deviceId)' 
}: DevelopingBannerProps) {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
          <Construction className="w-5 h-5 text-yellow-600" />
        </div>
        <div>
          <h3 className="font-semibold text-yellow-800 mb-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            กำลังพัฒนา
          </h3>
          <p className="text-sm text-yellow-700">
            {reason}
          </p>
          <p className="text-xs text-yellow-600 mt-2">
            ค่าทั้งหมดจะแสดงเป็น -- และการควบคุมทั้งหมดจะถูกล็อก
          </p>
        </div>
      </div>
    </div>
  );
}

export function OfflineBanner() {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h3 className="font-semibold text-red-800 mb-1">
            อุปกรณ์ออฟไลน์
          </h3>
          <p className="text-sm text-red-700">
            ไม่สามารถเชื่อมต่อกับอุปกรณ์ได้ การควบคุมทั้งหมดจะถูกล็อก
          </p>
        </div>
      </div>
    </div>
  );
}
