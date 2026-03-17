import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { adminApi, AdminGreenhouse, AdminProject } from '@/lib/adminApi';
import { useToast } from '@/hooks/useToast';
import { useT } from '@/i18n';
import { Pencil, Trash2, Search, Plus, Link, Unlink, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GreenhousesPage() {
  const { addToast } = useToast();
  const { t } = useT();
  const [greenhouses, setGreenhouses] = useState<AdminGreenhouse[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [linkingGh, setLinkingGh] = useState<AdminGreenhouse | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [ghData, projectData] = await Promise.all([
        adminApi.getAdminGreenhouses(filterProject || undefined),
        adminApi.getAdminProjects()
      ]);
      setGreenhouses(ghData);
      setProjects(projectData);
    } catch {
      addToast({ type: 'error', message: t('common.error') });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => { fetchData(); }, 30000);
    return () => clearInterval(timer);
  }, [filterProject]);

  const filteredGreenhouses = greenhouses.filter(gh =>
    gh.nameTh.toLowerCase().includes(searchTerm.toLowerCase()) ||
    gh.ghKey.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (gh: AdminGreenhouse) => {
    if (!confirm(t('admin.gh.deleteConfirm').replace('{name}', gh.nameTh))) return;
    try {
      await adminApi.deleteGreenhouse(gh.projectKey, gh.ghKey);
      addToast({ type: 'success', message: t('admin.gh.deleteSuccess') });
      fetchData();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : t('common.error') });
    }
  };

  const handleUnlink = async (gh: AdminGreenhouse) => {
    if (!confirm(t('admin.gh.unlinkConfirm'))) return;
    try {
      await adminApi.unlinkDevice(gh.projectKey, gh.ghKey);
      addToast({ type: 'success', message: t('admin.gh.unlinkSuccess') });
      fetchData();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : t('common.error') });
    }
  };

  return (
    <AdminLayout title={t('admin.greenhouses')} subtitle={t('admin.gh.subtitle')}>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder={t('admin.gh.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
        >
          <option value="">{t('admin.gh.allProjects')}</option>
          {projects.map(p => <option key={p.key} value={p.key}>{p.nameTh}</option>)}
        </select>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" />
          {t('admin.gh.addGreenhouse')}
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">{t('admin.gh.colGreenhouse')}</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">{t('admin.gh.colProject')}</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">{t('admin.gh.colDeviceId')}</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">{t('common.status')}</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">{t('common.loading')}</td></tr>
              ) : filteredGreenhouses.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">{t('admin.gh.noGreenhouse')}</td></tr>
              ) : filteredGreenhouses.map((gh) => (
                <tr key={gh.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{gh.nameTh}</div>
                    <div className="text-sm text-gray-500">{gh.ghKey}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{gh.projectName}</td>
                  <td className="px-4 py-3">
                    {gh.tbDeviceId ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Wifi className="w-4 h-4 text-green-500" />
                          <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                            {gh.tbDeviceId.substring(0, 8)}...
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {gh.isOnline ? (
                            <>
                              <span className="w-2 h-2 bg-green-500 rounded-full" />
                              <span className="text-green-600">{t('admin.gh.online')}</span>
                            </>
                          ) : (
                            <>
                              <span className="w-2 h-2 bg-gray-400 rounded-full" />
                              <span className="text-gray-500">{t('admin.gh.offline')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-400">
                        <WifiOff className="w-4 h-4" />
                        <span className="text-sm">{t('admin.gh.notConnected')}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={gh.status === 'ready' ? 'success' : 'warning'}>
                      {gh.status === 'ready' ? t('admin.gh.statusReady') : t('admin.gh.statusDeveloping')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {gh.tbDeviceId ? (
                        <Button variant="ghost" size="sm" onClick={() => handleUnlink(gh)} title={t('admin.gh.unlinkTitle')}>
                          <Unlink className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setLinkingGh(gh)} title={t('admin.gh.linkTitle')}>
                          <Link className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(gh)} className="text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showCreateModal && (
        <CreateGreenhouseModal
          projects={projects}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { setShowCreateModal(false); fetchData(); }}
        />
      )}
      {linkingGh && (
        <LinkDeviceModal
          greenhouse={linkingGh}
          onClose={() => setLinkingGh(null)}
          onSuccess={() => { setLinkingGh(null); fetchData(); }}
        />
      )}
    </AdminLayout>
  );
}

// ─── CreateGreenhouseModal ────────────────────────────────────────────────────
function CreateGreenhouseModal({ projects, onClose, onSuccess }: { projects: AdminProject[]; onClose: () => void; onSuccess: () => void }) {
  const { addToast } = useToast();
  const { t } = useT();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    project_key: projects[0]?.key || '',
    gh_key: '',
    name_th: '',
    status: 'developing' as 'developing' | 'ready',
    tb_device_id: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await adminApi.createGreenhouse({ ...formData, tb_device_id: formData.tb_device_id.trim() || undefined });
      addToast({ type: 'success', message: t('admin.gh.createSuccess') });
      onSuccess();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : t('common.error') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">{t('admin.gh.createTitle')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin.gh.fieldProject')}
              </label>
              <select
                value={formData.project_key}
                onChange={(e) => setFormData({ ...formData, project_key: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                required
              >
                {projects.map(p => <option key={p.key} value={p.key}>{p.nameTh}</option>)}
              </select>
            </div>
            <Input
              label={t('admin.gh.fieldKey')}
              value={formData.gh_key}
              onChange={(e) => setFormData({ ...formData, gh_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              required
            />
            <Input
              label={t('admin.gh.fieldName')}
              value={formData.name_th}
              onChange={(e) => setFormData({ ...formData, name_th: e.target.value })}
              required
            />
            <Input
              label={t('admin.gh.fieldDeviceId')}
              value={formData.tb_device_id}
              onChange={(e) => setFormData({ ...formData, tb_device_id: e.target.value })}
              placeholder={t('admin.gh.fieldDeviceIdOptional')}
            />
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
              <Button type="submit" isLoading={isLoading} className="flex-1">{t('admin.gh.createBtn')}</Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}

// ─── LinkDeviceModal ──────────────────────────────────────────────────────────
function LinkDeviceModal({ greenhouse, onClose, onSuccess }: { greenhouse: AdminGreenhouse; onClose: () => void; onSuccess: () => void }) {
  const { addToast } = useToast();
  const { t } = useT();
  const [isLoading, setIsLoading] = useState(false);
  const [deviceId, setDeviceId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId.trim()) return;
    setIsLoading(true);
    try {
      await adminApi.linkDevice(greenhouse.projectKey, greenhouse.ghKey, deviceId.trim());
      addToast({ type: 'success', message: t('admin.gh.linkSuccess') });
      onSuccess();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : t('common.error') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-2">{t('admin.gh.linkDeviceTitle')}</h2>
          <p className="text-sm text-gray-500 mb-4">{greenhouse.nameTh}</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="ThingsBoard Device ID"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              required
            />
            <p className="text-xs text-gray-500">{t('admin.gh.linkDeviceHint')}</p>
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
              <Button type="submit" isLoading={isLoading} className="flex-1">{t('admin.gh.linkBtn')}</Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}