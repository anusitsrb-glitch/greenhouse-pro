/**
 * NotificationPanel Component
 * Dropdown panel showing recent notifications
 */

import { useState } from 'react';
import { NotificationItem } from './NotificationItem';
import { Button, Spinner } from '@/components/ui';
import { CheckCheck, RefreshCw, Settings, Trash2 } from 'lucide-react';
import type { Notification } from '@/types/notifications';
import { Link } from 'react-router-dom';

interface NotificationPanelProps {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  onNotificationClick: (notification: Notification) => void;
  onMarkAsRead: (id: number) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: number) => void;
  onRefresh: () => void;
  onClose: () => void;
}

export function NotificationPanel({
  notifications,
  unreadCount,
  isLoading,
  onNotificationClick,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onRefresh,
  onClose,
}: NotificationPanelProps) {
  const [showAll, setShowAll] = useState(false);
  
  const filteredNotifications = showAll 
    ? notifications 
    : notifications.filter(n => !n.is_read);

  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">การแจ้งเตือน</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium text-white bg-red-500 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
            title="รีเฟรช"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>

          <Link
            to="/notifications/settings"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
            title="ตั้งค่า"
          >
            <Settings className="w-4 h-4 text-gray-600" />
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => setShowAll(false)}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            !showAll
              ? 'text-primary border-b-2 border-primary bg-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          ยังไม่อ่าน {unreadCount > 0 && `(${unreadCount})`}
        </button>
        <button
          onClick={() => setShowAll(true)}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            showAll
              ? 'text-primary border-b-2 border-primary bg-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          ทั้งหมด ({notifications.length})
        </button>
      </div>

      {/* Actions */}
      {unreadCount > 0 && !showAll && (
        <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
          <button
            onClick={onMarkAllAsRead}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            <CheckCheck className="w-4 h-4" />
            อ่านทั้งหมดแล้ว
          </button>
        </div>
      )}

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            <p>{showAll ? 'ไม่มีการแจ้งเตือน' : 'ไม่มีการแจ้งเตือนใหม่'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={() => onNotificationClick(notification)}
                onMarkAsRead={() => onMarkAsRead(notification.id)}
                onDelete={() => onDelete(notification.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer - แสดงเสมอ */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-center">
        {notifications.length > 0 && (
          <p className="text-xs text-gray-500 mb-2">
            แสดง {filteredNotifications.length} รายการล่าสุด
          </p>
        )}
        <Link
          to="/notifications"
          onClick={onClose}
          className="text-sm text-primary hover:underline font-medium inline-flex items-center gap-1"
        >
          ดูประวัติทั้งหมด →
        </Link>
      </div>
    </div>
  );
}