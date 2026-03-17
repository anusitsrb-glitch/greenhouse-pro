import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { adminApi, AdminProject, AdminGreenhouse } from '@/lib/adminApi';
import { Plus, Pencil, Trash2, Zap, Sun, Moon, Sunrise, Play } from 'lucide-react';

interface Scene {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  actions: Array<{
    control_key: string;
    action: string;
    value?: any;
  }>;
  is_active: number;
}

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
];

export function ScenesPage() {
  const { addToast } = useToast();
  const { t } = useT();
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [greenhouses, setGreenhouses] = useState<AdminGreenhouse[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedGh, setSelectedGh] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);

  const ICONS = [
    { value: 'Zap', icon: Zap, label: t('admin.scene.iconLightning') },
    { value: 'Sun', icon: Sun, label: t('admin.scene.iconDay') },
    { value: 'Moon', icon: Moon, label: t('admin.scene.iconNight') },
    { value: 'Sunrise', icon: Sunrise, label: t('admin.scene.iconMorning') },
  ];

  useEffect(() => { adminApi.getAdminProjects().then(setProjects).catch(() => {}); }, []);

  useEffect(() => {
    if (selectedProject) {
      adminApi.getAdminGreenhouses(selectedProject).then(setGreenhouses).catch(() => {});
      setSelectedGh(''); setScenes([]);
    }
  }, [selectedProject]);

  useEffect(() => { if (selectedProject && selectedGh) fetchScenes(); }, [selectedProject, selectedGh]);

  const fetchScenes = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<{ scenes: Scene[] }>(`/admin/scenes/${selectedProject}/${selectedGh}`);
      if (response.success && response.data) setScenes(response.data.scenes);
    } catch { addToast({ type: 'error', message: t('admin.scene.loadError') }); }
    finally { setIsLoading(false); }
  };

  const handleExecute = async (scene: Scene) => {
    try {
      await api.post(`/admin/scenes/${selectedProject}/${selectedGh}/${scene.id}/execute`, {});
      addToast({ type: 'success', message: t('admin.scene.executeSuccess').replace('{name}', scene.name) });
    } catch { addToast({ type: 'error', message: t('admin.scene.error') }); }
  };

  const handleDelete = async (scene: Scene) => {
    if (!confirm(t('admin.scene.deleteConfirm').replace('{name}', scene.name))) return;
    try {
      await api.delete(`/admin/scenes/${selectedProject}/${selectedGh}/${scene.id}`);
      addToast({ type: 'success', message: t('admin.scene.deleteSuccess') });
      fetchScenes();
    } catch { addToast({ type: 'error', message: t('admin.scene.error') }); }
  };

  const getIcon = (iconName: string) => {
    const found = ICONS.find(i => i.value === iconName);
    return found ? found.icon : Zap;
  };

  return (
    <AdminLayout title="Scenes / Presets" subtitle={t('admin.scene.subtitle')}>
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('admin.scene.selectProject')}
          </label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="">{t('admin.scene.selectProjectPlaceholder')}</option>
            {projects.map(p => <option key={p.key} value={p.key}>{p.nameTh}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('admin.scene.selectGh')}
          </label>
          <select
            value={selectedGh}
            onChange={(e) => setSelectedGh(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            disabled={!selectedProject}
          >
            <option value="">{t('admin.scene.selectGhPlaceholder')}</option>
            {greenhouses.map(g => <option key={g.ghKey} value={g.ghKey}>{g.nameTh}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={() => { setEditingScene(null); setShowModal(true); }} disabled={!selectedGh}>
            <Plus className="w-4 h-4" /> {t('admin.scene.addScene')}
          </Button>
        </div>
      </div>

      {/* Scenes Grid */}
      {!selectedGh ? (
        <Card><div className="p-8 text-center text-gray-500 dark:text-gray-400">{t('admin.scene.pleaseSelect')}</div></Card>
      ) : isLoading ? (
        <Card><div className="p-8 text-center dark:text-gray-400">{t('common.loading')}</div></Card>
      ) : scenes.length === 0 ? (
        <Card><div className="p-8 text-center text-gray-500 dark:text-gray-400">{t('admin.scene.noScene')}</div></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenes.map((scene) => {
            const IconComponent = getIcon(scene.icon);
            return (
              <Card key={scene.id} className={`p-4 ${!scene.is_active && 'opacity-50'}`}>
                <div className="flex items-start gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: scene.color + '20' }}
                  >
                    <IconComponent className="w-7 h-7" style={{ color: scene.color }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg dark:text-gray-100">{scene.name}</h3>
                    {scene.description && <p className="text-sm text-gray-500 dark:text-gray-400">{scene.description}</p>}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{scene.actions.length} actions</p>
                  </div>
                </div>

                {/* Actions Preview */}
                <div className="mt-4 flex flex-wrap gap-1">
                  {scene.actions.slice(0, 4).map((action, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {action.control_key}: {action.action}
                    </Badge>
                  ))}
                  {scene.actions.length > 4 && (
                    <Badge variant="secondary" className="text-xs">+{scene.actions.length - 4}</Badge>
                  )}
                </div>

                {/* Buttons */}
                <div className="mt-4 flex gap-2">
                  <Button
                    className="flex-1"
                    style={{ backgroundColor: scene.color }}
                    onClick={() => handleExecute(scene)}
                  >
                    <Play className="w-4 h-4" /> {t('admin.scene.executeBtn')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setEditingScene(scene); setShowModal(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(scene)} className="text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <SceneModal
          projectKey={selectedProject}
          ghKey={selectedGh}
          scene={editingScene}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchScenes(); }}
        />
      )}
    </AdminLayout>
  );
}

// Modal Component
function SceneModal({ projectKey, ghKey, scene, onClose, onSuccess }: {
  projectKey: string;
  ghKey: string;
  scene: Scene | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { addToast } = useToast();
  const { t } = useT();
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    name: scene?.name || '',
    description: scene?.description || '',
    icon: scene?.icon || 'Zap',
    color: scene?.color || '#3b82f6',
    actions: scene?.actions || [{ control_key: '', action: 'on' }],
  });

  const ICONS = [
    { value: 'Zap', icon: Zap, label: t('admin.scene.iconLightning') },
    { value: 'Sun', icon: Sun, label: t('admin.scene.iconDay') },
    { value: 'Moon', icon: Moon, label: t('admin.scene.iconNight') },
    { value: 'Sunrise', icon: Sunrise, label: t('admin.scene.iconMorning') },
  ];

  const handleAddAction = () => {
    setForm({ ...form, actions: [...form.actions, { control_key: '', action: 'on' }] });
  };

  const handleRemoveAction = (index: number) => {
    setForm({ ...form, actions: form.actions.filter((_, i) => i !== index) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (scene) {
        await api.put(`/admin/scenes/${projectKey}/${ghKey}/${scene.id}`, form);
      } else {
        await api.post(`/admin/scenes/${projectKey}/${ghKey}`, form);
      }
      addToast({ type: 'success', message: t('admin.scene.saveSuccess') });
      onSuccess();
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || t('admin.scene.error') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4 dark:text-gray-100">
            {scene ? t('admin.scene.editTitle') : t('admin.scene.createTitle')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('admin.scene.fieldName')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder={t('admin.scene.fieldNamePlaceholder')}
            />

            <Input
              label={t('admin.scene.fieldDesc')}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />

            {/* Icon Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('admin.scene.iconLabel')}
              </label>
              <div className="flex gap-2">
                {ICONS.map(icon => (
                  <button
                    key={icon.value}
                    type="button"
                    onClick={() => setForm({ ...form, icon: icon.value })}
                    className={`w-12 h-12 rounded-lg flex items-center justify-center border-2 transition-colors ${
                      form.icon === icon.value
                        ? 'border-primary bg-primary/10'
                        : 'border-gray-200 dark:border-gray-600'
                    }`}
                    title={icon.label}
                  >
                    <icon.icon className="w-6 h-6 dark:text-gray-300" />
                  </button>
                ))}
              </div>
            </div>

            {/* Color Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('admin.scene.colorLabel')}
              </label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      form.color === color ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('admin.scene.actions')}
                </label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddAction}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                {form.actions.map((action, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      placeholder="Control Key"
                      value={action.control_key}
                      onChange={(e) => {
                        const newActions = [...form.actions];
                        newActions[index] = { ...action, control_key: e.target.value };
                        setForm({ ...form, actions: newActions });
                      }}
                      className="flex-1"
                    />
                    <select
                      value={action.action}
                      onChange={(e) => {
                        const newActions = [...form.actions];
                        newActions[index] = { ...action, action: e.target.value };
                        setForm({ ...form, actions: newActions });
                      }}
                      className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    >
                      <option value="on">{t('admin.scene.actionOn')}</option>
                      <option value="off">{t('admin.scene.actionOff')}</option>
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAction(index)}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
              <Button type="submit" isLoading={isLoading} className="flex-1">{t('common.save')}</Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}