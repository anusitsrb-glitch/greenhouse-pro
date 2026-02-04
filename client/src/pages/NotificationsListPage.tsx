/**
 * Notifications List Page
 * View all notifications with filters and bulk actions
 */

import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, Button, Badge } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { notificationsApi } from '@/lib/notificationsApi';
import type { Notification } from '@/types/notifications';
import { NotificationItem } from '@/components/notifications';
import {
  RefreshCw,
  CheckCheck,
  Trash2,
  Filter,
  Settings,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function NotificationsListPage() {
  const { addToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 });

  // Filters
  const [filters, setFilters] = useState({
    type: '',
    severity: '' as '' | 'info' | 'warning' | 'critical',
    is_read: '' as '' | 'true' | 'false',
  });

  useEffect(() => {
    fetchNotifications();
  }, [filters]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const params: any = { limit: 50, offset: 0 };
      if (filters.type) params.type = filters.type;
      if (filters.severity) params.severity = filters.severity;
      if (filters.is_read) params.is_read = filters.is_read === 'true';

      const response = await notificationsApi.getNotifications(params);

      if (response.success && response.data) {
        setNotifications(response.data.notifications);
        setUnreadCount(response.data.unread_count);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      addToast({ type: 'error', message: 'ไม่สามารถโหลดการแจ้งเตือนได้' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      const response = await notificationsApi.markAsRead(id);

      if (response.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      addToast({ type: 'error', message: 'เกิดข้อผิดพลาด' });
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await notificationsApi.markAllAsRead();

      if (response.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
        addToast({ type: 'success', message: 'อ่านทั้งหมดแล้ว' });
      }
    } catch (error) {
      addToast({ type: 'error', message: 'เกิดข้อผิดพลาด' });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await notificationsApi.deleteNotification(id);

      if (response.success) {
        const notification = notifications.find((n) => n.id === id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));

        if (notification && !notification.is_read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }

        addToast({ type: 'success', message: 'ลบแล้ว' });
      }
    } catch (error) {
      addToast({ type: 'error', message: 'เกิดข้อผิดพลาด' });
    }
  };

  const handleDeleteAllRead = async () => {
    if (!confirm('ลบการแจ้งเตือนที่อ่านแล้วทั้งหมด?')) return;

    try {
      const response = await notificationsApi.deleteAllRead();

      if (response.success) {
        setNotifications((prev) => prev.filter((n) => !n.is_read));
        addToast({ type: 'success', message: `ลบแล้ว ${response.data?.count || 0} รายการ` });
      }
    } catch (error) {
      addToast({ type: 'error', message: 'เกิดข้อผิดพลาด' });
    }
  };

  const handleRefresh = () => {
    fetchNotifications();
  };

  const handleResetFilters = () => {
    setFilters({
      type: '',
      severity: '',
      is_read: '',
    });
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      device_offline: 'อุปกรณ์ออฟไลน์',
      device_online: 'อุปกรณ์ออนไลน์',
      sensor_alert: 'ค่าเซ็นเซอร์',
      control_action: 'ควบคุมอุปกรณ์',
      auto_mode_changed: 'เปลี่ยนโหมด Auto',
      system_error: 'ข้อผิดพลาด',
      info: 'ข้อมูล',
    };
    return labels[type] || type;
  };

  return (
    <PageContainer
      title="การแจ้งเตือนทั้งหมด"
      subtitle="ดูและจัดการการแจ้งเตือนทั้งหมด"
    >
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-2xl font-bold">{notifications.length}</p>
          <p className="text-sm text-gray-500">ทั้งหมด</p>
        </Card>

        <Card className="p-4">
          <p className="text-2xl font-bold text-yellow-600">{unreadCount}</p>
          <p className="text-sm text-gray-500">ยังไม่อ่าน</p>
        </Card>

        <Card className="p-4">
          <p className="text-2xl font-bold text-green-600">
            {notifications.filter((n) => n.is_read).length}
          </p>
          <p className="text-sm text-gray-500">อ่านแล้ว</p>
        </Card>

        <Card className="p-4">
          <p className="text-2xl font-bold text-red-600">
            {notifications.filter((n) => n.severity === 'critical').length}
          </p>
          <p className="text-sm text-gray-500">วิกฤต</p>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-600" />
          <h3 className="font-semibold">ค้นหา & กรอง</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Type */}
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">ประเภททั้งหมด</option>
            <option value="device_offline">อุปกรณ์ออฟไลน์</option>
            <option value="device_online">อุปกรณ์ออนไลน์</option>
            <option value="sensor_alert">ค่าเซ็นเซอร์</option>
            <option value="control_action">ควบคุมอุปกรณ์</option>
            <option value="auto_mode_changed">เปลี่ยนโหมด Auto</option>
            <option value="system_error">ข้อผิดพลาด</option>
          </select>

          {/* Severity */}
          <select
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value as any })}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">ทุกระดับ</option>
            <option value="info">ข้อมูล</option>
            <option value="warning">เตือน</option>
            <option value="critical">วิกฤต</option>
          </select>

          {/* Read Status */}
          <select
            value={filters.is_read}
            onChange={(e) => setFilters({ ...filters, is_read: e.target.value as any })}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">ทั้งหมด</option>
            <option value="false">ยังไม่อ่าน</option>
            <option value="true">อ่านแล้ว</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleResetFilters}>
            ล้างตัวกรอง
          </Button>

          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4" />
            รีเฟรช
          </Button>

          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
              <CheckCheck className="w-4 h-4" />
              อ่านทั้งหมด ({unreadCount})
            </Button>
          )}

          {notifications.filter((n) => n.is_read).length > 0 && (
            <Button variant="outline" size="sm" onClick={handleDeleteAllRead}>
              <Trash2 className="w-4 h-4" />
              ลบที่อ่านแล้ว
            </Button>
          )}

          <div className="flex-1" />

          <Link to="/notifications/settings">
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4" />
              ตั้งค่า
            </Button>
          </Link>
        </div>
      </Card>

      {/* Notifications List */}
      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">ไม่มีการแจ้งเตือน</div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={() => {}}
                onMarkAsRead={() => handleMarkAsRead(notification.id)}
                onDelete={() => handleDelete(notification.id)}
              />
            ))}
          </div>
        )}

        {pagination.total > pagination.limit && (
          <div className="p-4 border-t text-center text-sm text-gray-500">
            แสดง {notifications.length} จาก {pagination.total} รายการ
          </div>
        )}
      </Card>
    </PageContainer>
  );
}