/**
 * NotificationItem Component
 * Single notification item with actions
 */

import { useState } from 'react';
import {
  WifiOff,
  Wifi,
  AlertTriangle,
  Power,
  Settings,
  XCircle,
  Info,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types/notifications';
import { timeAgoTH } from '@/utils/time';


interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onMarkAsRead: () => void;
  onDelete: () => void;
}

export function NotificationItem({
  notification,
  onClick,
  onMarkAsRead,
  onDelete,
}: NotificationItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getIcon = () => {
    switch (notification.type) {
      case 'device_offline':
        return <WifiOff className="w-5 h-5 text-red-500" />;
      case 'device_online':
        return <Wifi className="w-5 h-5 text-green-500" />;
      case 'sensor_alert':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'control_action':
        return <Power className="w-5 h-5 text-blue-500" />;
      case 'auto_mode_changed':
        return <Settings className="w-5 h-5 text-purple-500" />;
      case 'system_error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSeverityColor = () => {
    switch (notification.severity) {
      case 'critical':
        return 'border-l-red-500';
      case 'warning':
        return 'border-l-yellow-500';
      default:
        return 'border-l-blue-500';
    }
  };

  const timeAgo = timeAgoTH(notification.created_at);


  return (
    <div
      className={cn(
        'relative px-4 py-3 cursor-pointer transition-colors border-l-4',
        getSeverityColor(),
        notification.is_read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50 hover:bg-blue-100'
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                'text-sm font-medium',
                notification.is_read ? 'text-gray-900' : 'text-gray-900 font-semibold'
              )}
            >
              {notification.title}
            </p>

            {/* Unread indicator */}
            {!notification.is_read && (
              <span className="flex-shrink-0 w-2 h-2 mt-1.5 bg-blue-600 rounded-full" />
            )}
          </div>

          {/* Message */}
          <p className="mt-1 text-sm text-gray-600 line-clamp-2">{notification.message}</p>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">{timeAgo}</span>

            {/* Actions (show on hover) */}
            {isHovered && (
              <div className="flex items-center gap-2">
                {!notification.is_read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkAsRead();
                    }}
                    className="p-1 rounded hover:bg-white/50 transition-colors"
                    title="อ่านแล้ว"
                  >
                    <Check className="w-4 h-4 text-green-600" />
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-1 rounded hover:bg-white/50 transition-colors"
                  title="ลบ"
                >
                  <X className="w-4 h-4 text-red-600" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}