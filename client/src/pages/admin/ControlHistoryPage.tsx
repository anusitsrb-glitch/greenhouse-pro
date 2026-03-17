import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Badge } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { useT } from '@/i18n';
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

export function ControlHistoryPage() {
  const { addToast } = useToast();
  const { t } = useT();
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [greenhouses, setGreenhouses] = useState<AdminGreenhouse[]>([]);
  const [history, setHistory] = useState<ControlHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedGh, setSelectedGh] = useState('');

  const SOURCE_CONFIG = {
    manual:     { label: t('admin.ctrl.srcManual'),   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',     icon: User },
    schedule:   { label: t('admin.ctrl.srcSchedule'), color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', icon: Clock },
    automation: { label: t('admin.ctrl.srcAuto'),     color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',   icon: Zap },
    scene:      { label: t('admin.ctrl.srcScene'),    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', icon: RotateCcw },
  };

  useEffect(() => { adminApi.getAdminProjects().then(setProjects).catch(() => {}); }, []);

  useEffect(() => {
    if (selectedProject) {
      adminApi.getAdminGreenhouses(selectedProject).then(setGreenhouses).catch(() => {});
      setSelectedGh('');
    }
  }, [selectedProject]);

  useEffect(() => { if (selectedProject && selectedGh) fetchHistory(); }, [selectedProject, selectedGh]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<{ history: ControlHistoryItem[] }>(`/admin/control-history/${selectedProject}/${selectedGh}`);
      if (response.success && response.data) setHistory(response.data.history);
    } catch { addToast({ type: 'error', message: t('admin.ctrl.loadError') }); }
    finally { setIsLoading(false); }
  };

  const stats = {
    total:      history.length,
    manual:     history.filter(h => h.source === 'manual').length,
    schedule:   history.filter(h => h.source === 'schedule').length,
    automation: history.filter(h => h.source === 'automation').length,
  };

  const getActionLabel = (action: string, value: string) => {
    if (action === 'on'  || value === '1') return t('admin.ctrl.actionOn');
    if (action === 'off' || value === '0') return t('admin.ctrl.actionOff');
    return action;
  };

  const isOn = (action: string, value: string) =>
    action === 'on' || value === '1';

  return (
    <AdminLayout title={t('admin.nav.controlHistory')} subtitle={t('admin.ctrl.subtitle')}>
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('admin.ctrl.selectProject')}
          </label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="">{t('admin.ctrl.selectProjectPlaceholder')}</option>
            {projects.map(p => <option key={p.key} value={p.key}>{p.nameTh}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('admin.ctrl.selectGh')}
          </label>
          <select
            value={selectedGh}
            onChange={(e) => setSelectedGh(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            disabled={!selectedProject}
          >
            <option value="">{t('admin.ctrl.selectGhPlaceholder')}</option>
            {greenhouses.map(g => <option key={g.ghKey} value={g.ghKey}>{g.nameTh}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={fetchHistory} disabled={!selectedGh || isLoading}>
            <History className="w-4 h-4" /> {t('admin.ctrl.loadBtn')}
          </Button>
        </div>
      </div>

      {!selectedGh ? (
        <Card><div className="p-8 text-center text-gray-500 dark:text-gray-400">{t('admin.ctrl.pleaseSelect')}</div></Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <History className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold dark:text-gray-100">{stats.total}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.ctrl.statTotal')}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{stats.manual}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.ctrl.statManual')}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">{stats.schedule}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.ctrl.statSchedule')}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.automation}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.ctrl.statAuto')}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* History Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm dark:text-gray-300">{t('admin.ctrl.colTime')}</th>
                    <th className="text-left px-4 py-3 text-sm dark:text-gray-300">{t('admin.ctrl.colDevice')}</th>
                    <th className="text-left px-4 py-3 text-sm dark:text-gray-300">{t('admin.ctrl.colAction')}</th>
                    <th className="text-left px-4 py-3 text-sm dark:text-gray-300">{t('admin.ctrl.colSource')}</th>
                    <th className="text-left px-4 py-3 text-sm dark:text-gray-300">{t('admin.ctrl.colUser')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {isLoading ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center dark:text-gray-400">{t('common.loading')}</td></tr>
                  ) : history.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">{t('admin.ctrl.noHistory')}</td></tr>
                  ) : history.map((item) => {
                    const sourceConfig = SOURCE_CONFIG[item.source] ?? SOURCE_CONFIG.manual;
                    const SourceIcon = sourceConfig.icon;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 text-sm dark:text-gray-300">
                          {new Date(item.created_at).toLocaleString('th-TH')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Power className="w-4 h-4 text-gray-400" />
                            <span className="font-medium dark:text-gray-100">{item.control_name || item.control_key}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={isOn(item.action, item.value) ? 'success' : 'secondary'}>
                            {getActionLabel(item.action, item.value)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${sourceConfig.color}`}>
                            <SourceIcon className="w-3 h-3" /> {sourceConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm dark:text-gray-300">{item.username || '-'}</td>
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