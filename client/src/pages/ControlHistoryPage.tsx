/**
 * Control History Page
 * View detailed control action history with filters and stats
 */

import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, Button, Badge, Input } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { controlHistoryApi } from '@/lib/notificationsApi';
import type { ControlHistory, ControlHistoryStats } from '@/types/notifications';
import {
  RefreshCw,
  Download,
  Filter,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  Activity,
  TrendingUp,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function ControlHistoryPage() {
  const { addToast } = useToast();
  const [history, setHistory] = useState<ControlHistory[]>([]);
  const [stats, setStats] = useState<ControlHistoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 });

  // Filters
  const [filters, setFilters] = useState({
    project_key: '',
    gh_key: '',
    source: '' as '' | 'manual' | 'automation' | 'schedule' | 'scene' | 'external_api',
    user_id: '',
    control_key: '',
    success: '' as '' | 'true' | 'false',
    start_date: '',
    end_date: '',
    search: '',
  });

  // Fetch data
  useEffect(() => {
    fetchHistory();
    fetchStats();
  }, [filters]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const params: any = { limit: 50, offset: 0 };
      if (filters.project_key) params.project_key = filters.project_key;
      if (filters.gh_key) params.gh_key = filters.gh_key;
      if (filters.source) params.source = filters.source;
      if (filters.user_id) params.user_id = parseInt(filters.user_id);
      if (filters.control_key) params.control_key = filters.control_key;
      if (filters.success) params.success = filters.success === 'true';
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const response = await controlHistoryApi.getHistory(params);

      if (response.success && response.data) {
        let data = response.data.history;

        // Client-side search filter
        if (filters.search) {
          const search = filters.search.toLowerCase();
          data = data.filter(
            (h) =>
              h.control_key.toLowerCase().includes(search) ||
              h.control_name?.toLowerCase().includes(search) ||
              h.user_name?.toLowerCase().includes(search) ||
              h.greenhouse_name.toLowerCase().includes(search)
          );
        }

        setHistory(data);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      addToast({ type: 'error', message: 'ไม่สามารถโหลดประวัติได้' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params: any = { days: 30 };
      if (filters.project_key) params.project_key = filters.project_key;
      if (filters.gh_key) params.gh_key = filters.gh_key;

      const response = await controlHistoryApi.getStats(params);

      if (response.success && response.data) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleRefresh = () => {
    fetchHistory();
    fetchStats();
  };

  const handleResetFilters = () => {
    setFilters({
      project_key: '',
      gh_key: '',
      source: '',
      user_id: '',
      control_key: '',
      success: '',
      start_date: '',
      end_date: '',
      search: '',
    });
  };

  const getSourceBadge = (source: string) => {
    const variants: Record<string, { label: string; color: string }> = {
      manual: { label: 'Manual', color: 'bg-blue-100 text-blue-800' },
      automation: { label: 'Auto', color: 'bg-purple-100 text-purple-800' },
      schedule: { label: 'ตั้งเวลา', color: 'bg-green-100 text-green-800' },
      scene: { label: 'ฉาก', color: 'bg-yellow-100 text-yellow-800' },
      external_api: { label: 'API', color: 'bg-gray-100 text-gray-800' },
    };

    const variant = variants[source] || { label: source, color: 'bg-gray-100 text-gray-800' };

    return (
      <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', variant.color)}>
        {variant.label}
      </span>
    );
  };

  const successRate = stats
    ? Math.round((stats.successCount / (stats.successCount + stats.failureCount)) * 100)
    : 0;

  return (
    <PageContainer title="ประวัติการควบคุม" subtitle="ดูประวัติการควบคุมอุปกรณ์ทั้งหมด">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.successCount + stats.failureCount}</p>
                <p className="text-sm text-gray-500">ทั้งหมด (30 วัน)</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.successCount}</p>
                <p className="text-sm text-gray-500">สำเร็จ</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.failureCount}</p>
                <p className="text-sm text-gray-500">ล้มเหลว</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{successRate}%</p>
                <p className="text-sm text-gray-500">อัตราสำเร็จ</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-600" />
          <h3 className="font-semibold">ค้นหา & กรอง</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="ค้นหา..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10"
            />
          </div>

          {/* Source */}
          <select
            value={filters.source}
            onChange={(e) => setFilters({ ...filters, source: e.target.value as any })}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">แหล่งที่มาทั้งหมด</option>
            <option value="manual">Manual</option>
            <option value="automation">Automation</option>
            <option value="schedule">Schedule</option>
            <option value="scene">Scene</option>
            <option value="external_api">External API</option>
          </select>

          {/* Success */}
          <select
            value={filters.success}
            onChange={(e) => setFilters({ ...filters, success: e.target.value as any })}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">ทั้งหมด</option>
            <option value="true">สำเร็จ</option>
            <option value="false">ล้มเหลว</option>
          </select>

          {/* Start Date */}
          <Input
            type="date"
            value={filters.start_date}
            onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={handleResetFilters}>
            ล้างตัวกรอง
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4" />
            รีเฟรช
          </Button>
        </div>
      </Card>

      {/* History Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium">เวลา</th>
                <th className="text-left px-4 py-3 text-sm font-medium">โรงเรือน</th>
                <th className="text-left px-4 py-3 text-sm font-medium">อุปกรณ์</th>
                <th className="text-left px-4 py-3 text-sm font-medium">การกระทำ</th>
                <th className="text-left px-4 py-3 text-sm font-medium">ผู้ใช้</th>
                <th className="text-left px-4 py-3 text-sm font-medium">แหล่งที่มา</th>
                <th className="text-left px-4 py-3 text-sm font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    ไม่พบประวัติการควบคุม
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(item.created_at).toLocaleString('th-TH')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{item.greenhouse_name}</div>
                      <div className="text-xs text-gray-500">{item.project_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{item.control_name || item.control_key}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{item.action}</div>
                      {item.value && <div className="text-xs text-gray-500">→ {item.value}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">
                          {item.user_full_name || item.user_name || 'ระบบ'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getSourceBadge(item.source)}</td>
                    <td className="px-4 py-3">
                      {item.success ? (
                        <Badge variant="success">สำเร็จ</Badge>
                      ) : (
                        <div>
                          <Badge variant="error">ล้มเหลว</Badge>
                          {item.error_message && (
                            <div className="text-xs text-red-600 mt-1">{item.error_message}</div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.total > pagination.limit && (
          <div className="p-4 border-t text-center text-sm text-gray-500">
            แสดง {history.length} จาก {pagination.total} รายการ
          </div>
        )}
      </Card>

      {/* Top Users */}
      {stats && stats.topUsers.length > 0 && (
        <Card className="mt-6 p-4">
          <h3 className="font-semibold mb-4">ผู้ใช้งานบ่อยที่สุด</h3>
          <div className="space-y-2">
            {stats.topUsers.slice(0, 5).map((user, index) => (
              <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 font-medium">#{index + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{user.full_name || user.username}</p>
                    <p className="text-xs text-gray-500">{user.username}</p>
                  </div>
                </div>
                <Badge variant="secondary">{user.count} ครั้ง</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </PageContainer>
  );
}