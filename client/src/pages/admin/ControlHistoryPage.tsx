import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Badge } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import { adminApi, AdminProject, AdminGreenhouse } from '@/lib/adminApi';
import { History, Power, RotateCcw, Clock, User, Zap } from 'lucide-react';

interface ControlHistoryItem {
  id: number;
  control_key: string;
  control_name: string;
  action: string;
  value: string;
  source: 'manual' | 'schedule' | 'automation' | 'scene';
  source_id: number | null;
  username: string;
  created_at: string;
}

const SOURCE_CONFIG = {
  manual: { label: 'กดเอง', color: 'bg-blue-100 text-blue-700', icon: User },
  schedule: { label: 'ตั้งเวลา', color: 'bg-purple-100 text-purple-700', icon: Clock },
  automation: { label: 'อัตโนมัติ', color: 'bg-green-100 text-green-700', icon: Zap },
  scene: { label: 'Scene', color: 'bg-orange-100 text-orange-700', icon: RotateCcw },
};

export function ControlHistoryPage() {
  const { addToast } = useToast();
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [greenhouses, setGreenhouses] = useState<AdminGreenhouse[]>([]);
  const [history, setHistory] = useState<ControlHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedGh, setSelectedGh] = useState('');

  useEffect(() => { adminApi.getAdminProjects().then(setProjects).catch(() => {}); }, []);
  useEffect(() => {
    if (selectedProject) { adminApi.getAdminGreenhouses(selectedProject).then(setGreenhouses).catch(() => {}); setSelectedGh(''); }
  }, [selectedProject]);
  useEffect(() => { if (selectedProject && selectedGh) fetchHistory(); }, [selectedProject, selectedGh]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<{ history: ControlHistoryItem[] }>(`/admin/control-history/${selectedProject}/${selectedGh}`);
      if (response.success && response.data) setHistory(response.data.history);
    } catch { addToast({ type: 'error', message: 'ไม่สามารถโหลดข้อมูลได้' }); }
    finally { setIsLoading(false); }
  };

  // Stats
  const stats = {
    total: history.length,
    manual: history.filter(h => h.source === 'manual').length,
    schedule: history.filter(h => h.source === 'schedule').length,
    automation: history.filter(h => h.source === 'automation').length,
  };

  return (
    <AdminLayout title="ประวัติการควบคุม" subtitle="บันทึกการเปิด/ปิดอุปกรณ์ทั้งหมด">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">โปรเจกต์</label>
          <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
            <option value="">เลือกโปรเจกต์...</option>
            {projects.map(p => <option key={p.key} value={p.key}>{p.nameTh}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">โรงเรือน</label>
          <select value={selectedGh} onChange={(e) => setSelectedGh(e.target.value)} className="w-full px-3 py-2 border rounded-lg" disabled={!selectedProject}>
            <option value="">เลือกโรงเรือน...</option>
            {greenhouses.map(g => <option key={g.ghKey} value={g.ghKey}>{g.nameTh}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={fetchHistory} disabled={!selectedGh || isLoading}>
            <History className="w-4 h-4" /> โหลดประวัติ
          </Button>
        </div>
      </div>

      {!selectedGh ? (
        <Card><div className="p-8 text-center text-gray-500">กรุณาเลือกโปรเจกต์และโรงเรือน</div></Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <History className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-gray-500">ทั้งหมด</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{stats.manual}</p>
                  <p className="text-sm text-gray-500">กดเอง</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">{stats.schedule}</p>
                  <p className="text-sm text-gray-500">ตั้งเวลา</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.automation}</p>
                  <p className="text-sm text-gray-500">อัตโนมัติ</p>
                </div>
              </div>
            </Card>
          </div>

          {/* History Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm">เวลา</th>
                    <th className="text-left px-4 py-3 text-sm">อุปกรณ์</th>
                    <th className="text-left px-4 py-3 text-sm">การกระทำ</th>
                    <th className="text-left px-4 py-3 text-sm">แหล่งที่มา</th>
                    <th className="text-left px-4 py-3 text-sm">ผู้ใช้</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center">กำลังโหลด...</td></tr>
                  ) : history.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">ยังไม่มีประวัติ</td></tr>
                  ) : history.map((item) => {
                    const sourceConfig = SOURCE_CONFIG[item.source];
                    const SourceIcon = sourceConfig.icon;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{new Date(item.created_at).toLocaleString('th-TH')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Power className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{item.control_name || item.control_key}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={item.action === 'on' || item.value === '1' ? 'success' : 'secondary'}>
                            {item.action === 'on' || item.value === '1' ? 'เปิด' : item.action === 'off' || item.value === '0' ? 'ปิด' : item.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${sourceConfig.color}`}>
                            <SourceIcon className="w-3 h-3" /> {sourceConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{item.username || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </AdminLayout>
  );
}
