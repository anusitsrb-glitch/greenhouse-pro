import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import { adminApi, AdminUser } from '@/lib/adminApi';
import { Search, Download, RefreshCw, FileText, User, Calendar } from 'lucide-react';

interface AuditLog {
  id: number;
  user_id: number | null;
  username: string | null;
  user_role: string | null;
  action: string;
  project_key: string | null;
  gh_key: string | null;
  detail: Record<string, any>;
  ip_address: string | null;
  created_at: string;
}

interface AuditStats {
  total: number;
  byAction: { action: string; count: number }[];
  byUser: { username: string | null; action_count: number }[];
  daily: { date: string; count: number }[];
}

export function AuditLogPage() {
  const { addToast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, limit: 100, offset: 0 });
  
  const [filters, setFilters] = useState({
    action: '',
    start_date: '',
    end_date: '',
  });

  useEffect(() => { fetchActions(); fetchStats(); }, []);
  useEffect(() => { fetchLogs(); }, [filters]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.action) params.append('action', filters.action);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      params.append('limit', '100');
      
      const response = await api.get<{ logs: AuditLog[]; pagination: any }>(`/admin/audit?${params}`);
      if (response.success && response.data) {
        setLogs(response.data.logs);
        setPagination(response.data.pagination);
      }
    } catch { addToast({ type: 'error', message: 'ไม่สามารถโหลดข้อมูลได้' }); }
    finally { setIsLoading(false); }
  };

  const fetchActions = async () => {
    try {
      const response = await api.get<{ actions: string[] }>('/admin/audit/actions');
      if (response.success && response.data) setActions(response.data.actions);
    } catch {}
  };

  const fetchStats = async () => {
    try {
      const response = await api.get<{ stats: AuditStats }>('/admin/audit/stats?days=7');
      if (response.success && response.data) setStats(response.data.stats);
    } catch {}
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    window.open(`/api/admin/audit/export?${params}`, '_blank');
  };

  const getActionBadge = (action: string) => {
    if (action.includes('LOGIN')) return <Badge variant="primary">{action}</Badge>;
    if (action.includes('CREATED')) return <Badge variant="success">{action}</Badge>;
    if (action.includes('DELETED')) return <Badge variant="error">{action}</Badge>;
    if (action.includes('UPDATED') || action.includes('CHANGED')) return <Badge variant="warning">{action}</Badge>;
    return <Badge variant="secondary">{action}</Badge>;
  };

  return (
    <AdminLayout title="Audit Log" subtitle="บันทึกการใช้งานระบบทั้งหมด">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-500">บันทึก (7 วัน)</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <User className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.byUser.length}</p>
                <p className="text-sm text-gray-500">ผู้ใช้งาน</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 col-span-2">
            <p className="text-sm font-medium text-gray-700 mb-2">Action ยอดนิยม</p>
            <div className="flex flex-wrap gap-1">
              {stats.byAction.slice(0, 5).map(a => (
                <span key={a.action} className="text-xs bg-gray-100 px-2 py-1 rounded">{a.action}: {a.count}</span>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} className="px-3 py-2 border rounded-lg">
          <option value="">ทุก Action</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <Input type="date" value={filters.start_date} onChange={(e) => setFilters({ ...filters, start_date: e.target.value })} />
          <span>-</span>
          <Input type="date" value={filters.end_date} onChange={(e) => setFilters({ ...filters, end_date: e.target.value })} />
        </div>
        <div className="flex-1" />
        <Button variant="outline" onClick={fetchLogs}><RefreshCw className="w-4 h-4" />รีเฟรช</Button>
        <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4" />Export CSV</Button>
      </div>

      {/* Logs Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm">เวลา</th>
                <th className="text-left px-4 py-3 text-sm">ผู้ใช้</th>
                <th className="text-left px-4 py-3 text-sm">Action</th>
                <th className="text-left px-4 py-3 text-sm">Project/GH</th>
                <th className="text-left px-4 py-3 text-sm">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center">กำลังโหลด...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">ไม่มีบันทึก</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{new Date(log.created_at).toLocaleString('th-TH')}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium">{log.username || 'System'}</div>
                    {log.user_role && <div className="text-xs text-gray-500">{log.user_role}</div>}
                  </td>
                  <td className="px-4 py-3">{getActionBadge(log.action)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {log.project_key && <div>{log.project_key}</div>}
                    {log.gh_key && <div className="text-xs text-gray-400">{log.gh_key}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title={JSON.stringify(log.detail)}>
                    {Object.keys(log.detail).length > 0 ? JSON.stringify(log.detail).substring(0, 50) + '...' : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination.total > pagination.limit && (
          <div className="p-4 border-t text-center text-sm text-gray-500">
            แสดง {logs.length} จาก {pagination.total} รายการ
          </div>
        )}
      </Card>
    </AdminLayout>
  );
}
