/**
 * NotificationPermissionBanner
 * Banner to request browser notification permission
 */

import { useState, useEffect } from 'react';
import { useBrowserNotification } from '@/hooks/useBrowserNotification';
import { Card, Button } from '@/components/ui';
import { Bell, X, Check } from 'lucide-react';

export function NotificationPermissionBanner() {
  const { permission, isSupported, requestPermission } = useBrowserNotification();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Show banner if:
    // 1. Browser supports notifications
    // 2. Permission is default (not granted or denied)
    // 3. User hasn't dismissed it in this session
    const shouldShow = 
      isSupported && 
      permission === 'default' && 
      !isDismissed;

    setIsVisible(shouldShow);
  }, [isSupported, permission, isDismissed]);

  const handleAllow = async () => {
    const granted = await requestPermission();
    
    if (granted) {
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4">
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 shadow-lg">
        <div className="flex items-start gap-4 p-4">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 mb-1">
              เปิดใช้งานการแจ้งเตือน
            </h3>
            <p className="text-sm text-gray-600">
              รับการแจ้งเตือนแบบเรียลไทม์เมื่อมีเหตุการณ์สำคัญ เช่น อุปกรณ์ออฟไลน์หรือค่าเซ็นเซอร์ผิดปกติ
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={handleAllow}
              size="sm"
              className="whitespace-nowrap"
            >
              <Check className="w-4 h-4" />
              อนุญาต
            </Button>

            <button
              onClick={handleDismiss}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="ปิด"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}