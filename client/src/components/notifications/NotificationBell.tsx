/**
 * NotificationBell Component
 * Bell icon with badge and dropdown panel
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import { NotificationPanel } from './NotificationPanel';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 639px)').matches; // < sm
  });

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = () => setIsMobile(mq.matches);

    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  return isMobile;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    handleNotificationClick,
    refresh,
  } = useNotifications();

  // click-outside: รองรับทั้ง desktop และ mobile(portal)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // ถ้าคลิกอยู่ใน panel (mobile portal) ไม่ปิด
      if (target.closest('[data-notification-panel]')) return;

      // ถ้าคลิกอยู่ใน bell area ไม่ปิด (ให้ toggle จัดการ)
      if (dropdownRef.current && dropdownRef.current.contains(target)) return;

      setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside as any);
      document.addEventListener('touchstart', handleClickOutside as any, { passive: true });
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside as any);
      document.removeEventListener('touchstart', handleClickOutside as any);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) refresh();
  };

  const panel = (
    <NotificationPanel
      mode={isMobile ? 'mobile' : 'desktop'}
      notifications={notifications}
      unreadCount={unreadCount}
      isLoading={isLoading}
      onNotificationClick={(notification) => handleNotificationClick(notification)}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
      onDelete={deleteNotification}
      onRefresh={refresh}
      onClose={() => setIsOpen(false)}
    />
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className={cn(
          'relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors',
          isOpen
            ? 'bg-primary/10 text-primary'
            : 'text-gray-600 hover:text-primary hover:bg-primary/5'
        )}
        aria-label="การแจ้งเตือน"
        type="button"
      >
        <Bell className="w-4 h-4" />
        <span className="hidden sm:inline">แจ้งเตือน</span>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (isMobile ? createPortal(panel, document.body) : panel)}
    </div>
  );
}
