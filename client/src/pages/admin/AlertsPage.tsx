import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, Button, Badge } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { adminApi, AdminProject } from '@/lib/adminApi';
import { Bell, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Alert {
  id: number;
  alert_type: string;
  severity: string;
  sensor_key: string | null;
  sensor_name: string | null;
  current_value: number | null;
  threshold_value: number | null;
  direction: string | null;
  message: string;
  is_acknowledged: number;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
  created_at: string;
  project_key: string;
  project_name: string;
  gh_key: string;
  greenhouse_name: string;
}

export function AlertsPage() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 });
  
  const [filters, setFilters] = useState({
    project_key: '',
    severity: '',
    is_acknowledged: '',
  });

  const canAcknowledge = user?.role && ['superadmin', 'admin', 'operator'].includes(user.role);

  useEffect(() => { adminApi.getAdminProjects().then(setProjects).catch(() => {}); }, []);
  useEffect(() => { fetchAlerts(); }, [filters]);

  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.project_key) params.append('project_key', filters.project_key);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.is_acknowledged) params.append('is_acknowledged', filters.is_acknowledged);
      params.append('limit', '50');
      
      const response = await api.get<{ alerts: Alert[]; pagination: any }>(`/alerts?${params}`);
      if (response.success && response.data) {
        setAlerts(response.data.alerts);
        setPagination(response.data.pagination);
      }
    } catch { addToast({ type: 'error', message: 'ไม่สามารถโหลดข้อมูลได้' }); }
    finally { setIsLoading(false); }
  };

  const handleAcknowledge = async (id: number) => {
    try {
      await api.put(`/alerts/${id}/acknowledge`, {});
      addToast({ type: 'success', message: 'รับทราบแล้ว' }); fetchAlerts();
    } catch { addToast({ type: 'error', message: 'เกิดข้อผิดพลาด' }); }
  };

  const handleAcknowledgeAll = async () => {
    if (!confirm('รับทราบ Alert ทั้งหมดที่ยังไม่ได้รับทราบ?')) return;
    try {
      const params = new URLSearchParams();
      if (filters.project_key) params.append('project_key', filters.project_key);
      await api.put(`/alerts/acknowledge-all?${params}`, {});
      addToast({ type: 'success', message: 'รับทราบทั้งหมดแล้ว' }); fetchAlerts();
    } catch { addToast({ type: 'error', message: 'เกิดข้อผิดพลาด' }); }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <Badge variant="error">วิกฤต</Badge>;
      case 'warning': return <Badge variant="warning">เตือน</Badge>;
      default: return <Badge variant="secondary">ข้อมูล</Badge>;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default: return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  const unacknowledgedCount = alerts.filter(a => !a.is_acknowledged).length;

  return (
    <PageContainer title="การแจ้งเตือน" subtitle="ดู Alert ทั้งหมด">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{alerts.length}</p>
              <p className="text-sm text-gray-500">ทั้งหมด</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{unacknowledgedCount}</p>
              <p className="text-sm text-gray-500">รอรับทราบ</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{alerts.filter(a => a.severity === 'critical').length}</p>
              <p className="text-sm text-gray-500">วิกฤต</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{alerts.filter(a => a.is_acknowledged).length}</p>
              <p className="text-sm text-gray-500">รับทราบแล้ว</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select value={filters.project_key} onChange={(e) => setFilters({ ...filters, project_key: e.target.value })} className="px-3 py-2 border rounded-lg">
          <option value="">ทุกโปรเจกต์</option>
          {projects.map(p => <option key={p.key} value={p.key}>{p.nameTh}</option>)}
        </select>
        <select value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })} className="px-3 py-2 border rounded-lg">
          <option value="">ทุกระดับ</option>
          <option value="critical">วิกฤต</option>
          <option value="warning">เตือน</option>
          <option value="info">ข้อมูล</option>
        </select>
        <select value={filters.is_acknowledged} onChange={(e) => setFilters({ ...filters, is_acknowledged: e.target.value })} className="px-3 py-2 border rounded-lg">
          <option value="">ทั้งหมด</option>
          <option value="false">ยังไม่รับทราบ</option>
          <option value="true">รับทราบแล้ว</option>
        </select>
        <div className="flex-1" />
        <Button variant="outline" onClick={fetchAlerts}><RefreshCw className="w-4 h-4" />รีเฟรช</Button>
        {canAcknowledge && unacknowledgedCount > 0 && (
          <Button onClick={handleAcknowledgeAll}><CheckCircle className="w-4 h-4" />รับทราบทั้งหมด ({unacknowledgedCount})</Button>
        )}
      </div>

      {/* Alerts Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm">เวลา</th>
                <th className="text-left px-4 py-3 text-sm">ระดับ</th>
                <th className="text-left px-4 py-3 text-sm">โรงเรือน</th>
                <th className="text-left px-4 py-3 text-sm">ข้อความ</th>
                <th className="text-left px-4 py-3 text-sm">สถานะ</th>
                {canAcknowledge && <th className="text-right px-4 py-3 text-sm">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={canAcknowledge ? 6 : 5} className="px-4 py-8 text-center">กำลังโหลด...</td></tr>
              ) : alerts.length === 0 ? (
                <tr><td colSpan={canAcknowledge ? 6 : 5} className="px-4 py-8 text-center text-gray-500">ไม่มี Alert</td></tr>
              ) : alerts.map((alert) => (
                <tr key={alert.id} className={cn('hover:bg-gray-50', !alert.is_acknowledged && 'bg-yellow-50/50')}>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(alert.created_at).toLocaleString('th-TH')}</td>
                  <td className="px-4 py-3">{getSeverityBadge(alert.severity)}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium">{alert.greenhouse_name}</div>
                    <div className="text-xs text-gray-500">{alert.project_name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      {getSeverityIcon(alert.severity)}
                      <div>
                        <div className="text-sm">{alert.message}</div>
                        {alert.sensor_name && (
                          <div className="text-xs text-gray-500">
                            {alert.sensor_name}: {alert.current_value} ({alert.direction === 'above' ? 'สูงกว่า' : 'ต่ำกว่า'} {alert.threshold_value})
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {alert.is_acknowledged ? (
                      <div className="text-xs text-gray-500">
                        <span className="text-green-600">รับทราบแล้ว</span>
                        <br />โดย {alert.acknowledged_by_name}
                      </div>
                    ) : (
                      <Badge variant="warning">รอรับทราบ</Badge>
                    )}
                  </td>
                  {canAcknowledge && (
                    <td className="px-4 py-3 text-right">
                      {!alert.is_acknowledged && (
                        <Button variant="outline" size="sm" onClick={() => handleAcknowledge(alert.id)}>
                          <CheckCircle className="w-4 h-4" />รับทราบ
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination.total > pagination.limit && (
          <div className="p-4 border-t text-center text-sm text-gray-500">
            แสดง {alerts.length} จาก {pagination.total} รายการ
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
