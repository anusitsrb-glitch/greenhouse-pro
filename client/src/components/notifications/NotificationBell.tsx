/**
 * NotificationBell Component
 * Bell icon with badge and dropdown panel
 */

import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { NotificationPanel } from './NotificationPanel';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';


export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      refresh();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className={cn(
          'relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors',
          isOpen
            ? 'bg-primary/10 text-primary'
            : 'text-gray-600 hover:text-primary hover:bg-primary/5'
        )}
        aria-label="การแจ้งเตือน"
      >
        <Bell className="w-4 h-4" />

        <span className="hidden sm:inline">
          แจ้งเตือน
        </span>

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>


      {/* Dropdown Panel */}
      {isOpen && (
        <NotificationPanel
          notifications={notifications}
          unreadCount={unreadCount}
          isLoading={isLoading}
          onNotificationClick={(notification) => {
            handleNotificationClick(notification);
          }}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDelete={deleteNotification}
          onRefresh={refresh}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}


