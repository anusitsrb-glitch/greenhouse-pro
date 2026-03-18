import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { adminApi, AdminProject } from '@/lib/adminApi';
import { useToast } from '@/hooks/useToast';
import { useT } from '@/i18n';
import { Pencil, Trash2, Search, FolderPlus, Home, Server, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

type ProjectStatus = 'ready' | 'developing';

type ProjectFormData = {
  key: string;
  name_th: string;
  status: ProjectStatus;
  tb_base_url: string;
  tb_username: string;
  tb_password: string;
};

export function ProjectsPage() {
  const { addToast } = useToast();
  const { t } = useT();
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<AdminProject | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getAdminProjects();
      setProjects(data);
    } catch {
      addToast({ type: 'error', message: t('common.error') });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredProjects = projects.filter(p =>
    p.nameTh.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (project: AdminProject) => {
    if (!confirm(t('admin.project.deleteConfirm').replace('{name}', project.nameTh))) return;
    try {
      await adminApi.deleteProject(project.key);
      addToast({ type: 'success', message: t('admin.project.deleteSuccess') });
      fetchData();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : t('common.error') });
    }
  };

  return (
    <AdminLayout title={t('admin.projects')} subtitle={t('admin.project.subtitle')}>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder={t('admin.project.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <FolderPlus className="w-4 h-4" />
          {t('admin.project.addProject')}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12 text-gray-500">{t('admin.project.noProject')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="overflow-hidden">
              <div className={cn('h-1.5', project.status === 'ready' ? 'bg-green-500' : 'bg-yellow-500')} />
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{project.nameTh}</h3>
                    <p className="text-sm text-gray-500">{project.key}</p>
                  </div>
                  <Badge variant={project.status === 'ready' ? 'success' : 'warning'}>
                    {project.status === 'ready' ? t('admin.project.statusReady') : t('admin.project.statusDeveloping')}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <div className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-gray-400" />
                    <span>{project.greenhouseCount} {t('admin.project.greenhouse')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-gray-400" />
                    <span className="truncate text-xs">{project.tbBaseUrl}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingProject(project)} className="flex-1">
                    <Pencil className="w-4 h-4" />
                    {t('common.edit')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(project)} className="text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCreateModal && (
        <ProjectModal onClose={() => setShowCreateModal(false)} onSuccess={() => { setShowCreateModal(false); fetchData(); }} />
      )}
      {editingProject && (
        <ProjectModal project={editingProject} onClose={() => setEditingProject(null)} onSuccess={() => { setEditingProject(null); fetchData(); }} />
      )}
    </AdminLayout>
  );
}

function ProjectModal({ project, onClose, onSuccess }: { project?: AdminProject; onClose: () => void; onSuccess: () => void }) {
  const { addToast } = useToast();
  const { t } = useT();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<ProjectFormData>({
    key: project?.key || '',
    name_th: project?.nameTh || '',
    status: (project?.status as ProjectStatus) || 'developing',
    tb_base_url: project?.tbBaseUrl || '',
    tb_username: project?.tbUsername || '',
    tb_password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (project) {
        const updateData = { ...formData };
        if (!updateData.tb_password) delete updateData.tb_password;
        await adminApi.updateProject(project.key, updateData);
        addToast({ type: 'success', message: t('admin.project.saveSuccess') });
      } else {
        await adminApi.createProject(formData);
        addToast({ type: 'success', message: t('admin.project.createSuccess') });
      }
      onSuccess();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : t('common.error') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">
            {project ? t('admin.project.editTitle') : t('admin.project.createTitle')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('admin.project.fieldKey')}
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              required
              disabled={!!project}
            />
            <Input
              label={t('admin.project.fieldName')}
              value={formData.name_th}
              onChange={(e) => setFormData({ ...formData, name_th: e.target.value })}
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin.project.fieldStatus')}
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              >
                <option value="developing">{t('admin.project.statusDeveloping')}</option>
                <option value="ready">{t('admin.project.statusReady')}</option>
              </select>
            </div>

            <hr className="dark:border-gray-700" />
            <p className="text-sm text-gray-500">{t('admin.project.tbSection')}</p>

            <Input
              label={t('admin.project.tbUrl')}
              value={formData.tb_base_url}
              onChange={(e) => setFormData({ ...formData, tb_base_url: e.target.value })}
              placeholder={t('admin.project.tbUrlPlaceholder')}
              required={!project}
            />
            <Input
              label={t('admin.project.tbUsername')}
              value={formData.tb_username}
              onChange={(e) => setFormData({ ...formData, tb_username: e.target.value })}
              required={!project}
            />

            <div className="relative">
              <Input
                label={t('admin.project.tbPassword')}
                type={showPassword ? 'text' : 'password'}
                value={formData.tb_password}
                onChange={(e) => setFormData({ ...formData, tb_password: e.target.value })}
                placeholder={project ? t('admin.project.tbPasswordPlaceholder') : ''}
                required={!project}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 text-gray-400"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                {t('common.cancel')}
              </Button>
              <Button type="submit" isLoading={isLoading} className="flex-1">
                {project ? t('common.save') : t('admin.project.createBtn')}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}