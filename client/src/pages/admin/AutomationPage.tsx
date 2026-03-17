import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { adminApi, AdminProject, AdminGreenhouse } from '@/lib/adminApi';
import { Plus, Pencil, Trash2, Zap, Clock, Activity, Play, Pause } from 'lucide-react';

interface AutomationRule {
  id: number;
  name: string;
  description: string;
  trigger_type: 'sensor' | 'time' | 'manual';
  trigger_config: {
    sensor_key?: string;
    condition?: 'above' | 'below' | 'equal';
    value?: number;
    time?: string;
    days?: number[];
  };
  conditions: Array<{ sensor_key: string; condition: string; value: number; }>;
  actions: Array<{
    type: 'control' | 'notification';
    control_key?: string;
    action?: string;
    value?: any;
    channel?: string;
    message?: string;
  }>;
  is_active: number;
  last_triggered_at: string | null;
  trigger_count: number;
}

export function AutomationPage() {
  const { addToast } = useToast();
  const { t } = useT();
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [greenhouses, setGreenhouses] = useState<AdminGreenhouse[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedGh, setSelectedGh] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  const TRIGGER_TYPES = [
    { value: 'sensor', label: t('admin.auto.triggerSensor'), icon: Activity },
    { value: 'time', label: t('admin.auto.triggerTime'), icon: Clock },
    { value: 'manual', label: t('admin.auto.triggerManual'), icon: Zap },
  ];

  const CONDITIONS = [
    { value: 'above', label: t('admin.auto.condAbove') },
    { value: 'below', label: t('admin.auto.condBelow') },
    { value: 'equal', label: t('admin.auto.condEqual') },
    { value: 'between', label: t('admin.auto.condBetween') },
  ];

  useEffect(() => { adminApi.getAdminProjects().then(setProjects).catch(() => {}); }, []);

  useEffect(() => {
    if (selectedProject) {
      adminApi.getAdminGreenhouses(selectedProject).then(setGreenhouses).catch(() => {});
      setSelectedGh(''); setRules([]);
    }
  }, [selectedProject]);

  useEffect(() => { if (selectedProject && selectedGh) fetchRules(); }, [selectedProject, selectedGh]);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<{ rules: AutomationRule[] }>(`/admin/automation/${selectedProject}/${selectedGh}`);
      if (response.success && response.data) setRules(response.data.rules);
    } catch { addToast({ type: 'error', message: t('admin.auto.loadError') }); }
    finally { setIsLoading(false); }
  };

  const handleToggle = async (rule: AutomationRule) => {
    try {
      await api.put(`/admin/automation/${selectedProject}/${selectedGh}/${rule.id}/toggle`, {});
      addToast({ type: 'success', message: rule.is_active ? t('admin.auto.toggleOffSuccess') : t('admin.auto.toggleSuccess') });
      fetchRules();
    } catch { addToast({ type: 'error', message: t('admin.auto.error') }); }
  };

  const handleDelete = async (rule: AutomationRule) => {
    if (!confirm(t('admin.auto.deleteConfirm').replace('{name}', rule.name))) return;
    try {
      await api.delete(`/admin/automation/${selectedProject}/${selectedGh}/${rule.id}`);
      addToast({ type: 'success', message: t('admin.auto.deleteSuccess') });
      fetchRules();
    } catch { addToast({ type: 'error', message: t('admin.auto.error') }); }
  };

  const getTriggerIcon = (type: string) => {
    const found = TRIGGER_TYPES.find(tt => tt.value === type);
    return found ? found.icon : Zap;
  };

  const getTriggerLabel = (type: string) => {
    const found = TRIGGER_TYPES.find(tt => tt.value === type);
    return found ? found.label : type;
  };

  const getConditionLabel = (cond: string) => {
    const found = CONDITIONS.find(c => c.value === cond);
    return found ? found.label : cond;
  };

  return (
    <AdminLayout title="Automation Rules" subtitle={t('admin.auto.subtitle')}>
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('admin.auto.selectProject')}
          </label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="">{t('admin.auto.selectProjectPlaceholder')}</option>
            {projects.map(p => <option key={p.key} value={p.key}>{p.nameTh}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('admin.auto.selectGh')}
          </label>
          <select
            value={selectedGh}
            onChange={(e) => setSelectedGh(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            disabled={!selectedProject}
          >
            <option value="">{t('admin.auto.selectGhPlaceholder')}</option>
            {greenhouses.map(g => <option key={g.ghKey} value={g.ghKey}>{g.nameTh}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={() => { setEditingRule(null); setShowModal(true); }} disabled={!selectedGh}>
            <Plus className="w-4 h-4" /> {t('admin.auto.addRule')}
          </Button>
        </div>
      </div>

      {/* Rules List */}
      {!selectedGh ? (
        <Card><div className="p-8 text-center text-gray-500 dark:text-gray-400">{t('admin.auto.pleaseSelect')}</div></Card>
      ) : isLoading ? (
        <Card><div className="p-8 text-center dark:text-gray-400">{t('common.loading')}</div></Card>
      ) : rules.length === 0 ? (
        <Card><div className="p-8 text-center text-gray-500 dark:text-gray-400">{t('admin.auto.noRule')}</div></Card>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => {
            const TriggerIcon = getTriggerIcon(rule.trigger_type);
            return (
              <Card key={rule.id} className={`p-4 ${!rule.is_active && 'opacity-50'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${rule.is_active ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                      <TriggerIcon className={`w-6 h-6 ${rule.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg dark:text-gray-100">{rule.name}</h3>
                      {rule.description && <p className="text-sm text-gray-500 dark:text-gray-400">{rule.description}</p>}

                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="secondary">{getTriggerLabel(rule.trigger_type)}</Badge>

                        {rule.trigger_type === 'sensor' && rule.trigger_config.sensor_key && (
                          <Badge variant="primary">
                            {rule.trigger_config.sensor_key} {getConditionLabel(rule.trigger_config.condition || '')} {rule.trigger_config.value}
                          </Badge>
                        )}

                        {rule.trigger_type === 'time' && rule.trigger_config.time && (
                          <Badge variant="primary">{t('admin.auto.timeAt')} {rule.trigger_config.time}</Badge>
                        )}

                        <Badge variant="success">{t('admin.auto.actionsCount').replace('{n}', String(rule.actions.length))}</Badge>
                      </div>

                      {rule.last_triggered_at && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                          {t('admin.auto.lastTriggered')} {new Date(rule.last_triggered_at).toLocaleString('th-TH')} ({t('admin.auto.triggerCount').replace('{n}', String(rule.trigger_count))})
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleToggle(rule)}>
                      {rule.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setEditingRule(rule); setShowModal(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(rule)} className="text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <AutomationModal
          projectKey={selectedProject}
          ghKey={selectedGh}
          rule={editingRule}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchRules(); }}
        />
      )}
    </AdminLayout>
  );
}

// Modal Component
function AutomationModal({ projectKey, ghKey, rule, onClose, onSuccess }: {
  projectKey: string;
  ghKey: string;
  rule: AutomationRule | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { addToast } = useToast();
  const { t } = useT();
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    name: rule?.name || '',
    description: rule?.description || '',
    trigger_type: rule?.trigger_type || 'sensor',
    trigger_config: rule?.trigger_config || { sensor_key: '', condition: 'above', value: 0 },
    actions: rule?.actions || [{ type: 'control', control_key: '', action: 'on' }],
  });

  const TRIGGER_TYPES = [
    { value: 'sensor', label: t('admin.auto.triggerSensor'), icon: Activity },
    { value: 'time', label: t('admin.auto.triggerTime'), icon: Clock },
    { value: 'manual', label: t('admin.auto.triggerManual'), icon: Zap },
  ];

  const CONDITIONS = [
    { value: 'above', label: t('admin.auto.condAbove') },
    { value: 'below', label: t('admin.auto.condBelow') },
    { value: 'equal', label: t('admin.auto.condEqual') },
    { value: 'between', label: t('admin.auto.condBetween') },
  ];

  const handleAddAction = () => {
    setForm({ ...form, actions: [...form.actions, { type: 'control', control_key: '', action: 'on' }] });
  };

  const handleRemoveAction = (index: number) => {
    setForm({ ...form, actions: form.actions.filter((_, i) => i !== index) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (rule) {
        await api.put(`/admin/automation/${projectKey}/${ghKey}/${rule.id}`, form);
      } else {
        await api.post(`/admin/automation/${projectKey}/${ghKey}`, form);
      }
      addToast({ type: 'success', message: t('admin.auto.saveSuccess') });
      onSuccess();
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || t('admin.auto.error') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4 dark:text-gray-100">
            {rule ? t('admin.auto.editTitle') : t('admin.auto.createTitle')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('admin.auto.fieldName')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder={t('admin.auto.fieldNamePlaceholder')}
            />

            <Input
              label={t('admin.auto.fieldDesc')}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('admin.auto.fieldDescPlaceholder')}
            />

            {/* Trigger Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('admin.auto.triggerType')}
              </label>
              <div className="flex gap-2">
                {TRIGGER_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setForm({ ...form, trigger_type: type.value as any })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      form.trigger_type === type.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:text-gray-300'
                    }`}
                  >
                    <type.icon className="w-4 h-4" />
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Trigger Config */}
            {form.trigger_type === 'sensor' && (
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label={t('admin.auto.sensorKey')}
                  value={form.trigger_config.sensor_key || ''}
                  onChange={(e) => setForm({ ...form, trigger_config: { ...form.trigger_config, sensor_key: e.target.value } })}
                  placeholder={t('admin.auto.sensorKeyPlaceholder')}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin.auto.condition')}
                  </label>
                  <select
                    value={form.trigger_config.condition || 'above'}
                    onChange={(e) => setForm({ ...form, trigger_config: { ...form.trigger_config, condition: e.target.value as any } })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  >
                    {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <Input
                  label={t('admin.auto.value')}
                  type="number"
                  value={form.trigger_config.value || 0}
                  onChange={(e) => setForm({ ...form, trigger_config: { ...form.trigger_config, value: parseFloat(e.target.value) } })}
                />
              </div>
            )}

            {form.trigger_type === 'time' && (
              <Input
                label={t('admin.auto.time')}
                type="time"
                value={form.trigger_config.time || ''}
                onChange={(e) => setForm({ ...form, trigger_config: { ...form.trigger_config, time: e.target.value } })}
              />
            )}

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('admin.auto.actions')}
                </label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddAction}>
                  <Plus className="w-4 h-4" /> {t('admin.auto.addAction')}
                </Button>
              </div>

              <div className="space-y-2">
                {form.actions.map((action, index) => (
                  <div key={index} className="flex gap-2 items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <select
                      value={action.type}
                      onChange={(e) => {
                        const newActions = [...form.actions];
                        newActions[index] = { ...action, type: e.target.value as any };
                        setForm({ ...form, actions: newActions });
                      }}
                      className="px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                    >
                      <option value="control">{t('admin.auto.actionControl')}</option>
                      <option value="notification">{t('admin.auto.actionNotif')}</option>
                    </select>

                    {action.type === 'control' && (
                      <>
                        <Input
                          placeholder={t('admin.auto.controlKeyPlaceholder')}
                          value={action.control_key || ''}
                          onChange={(e) => {
                            const newActions = [...form.actions];
                            newActions[index] = { ...action, control_key: e.target.value };
                            setForm({ ...form, actions: newActions });
                          }}
                          className="flex-1"
                        />
                        <select
                          value={action.action || 'on'}
                          onChange={(e) => {
                            const newActions = [...form.actions];
                            newActions[index] = { ...action, action: e.target.value };
                            setForm({ ...form, actions: newActions });
                          }}
                          className="px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                        >
                          <option value="on">{t('admin.auto.actionOn')}</option>
                          <option value="off">{t('admin.auto.actionOff')}</option>
                          <option value="toggle">{t('admin.auto.actionToggle')}</option>
                        </select>
                      </>
                    )}

                    {action.type === 'notification' && (
                      <>
                        <select
                          value={action.channel || 'line'}
                          onChange={(e) => {
                            const newActions = [...form.actions];
                            newActions[index] = { ...action, channel: e.target.value };
                            setForm({ ...form, actions: newActions });
                          }}
                          className="px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                        >
                          <option value="line">Line</option>
                          <option value="sms">SMS</option>
                        </select>
                        <Input
                          placeholder={t('admin.auto.messagePlaceholder')}
                          value={action.message || ''}
                          onChange={(e) => {
                            const newActions = [...form.actions];
                            newActions[index] = { ...action, message: e.target.value };
                            setForm({ ...form, actions: newActions });
                          }}
                          className="flex-1"
                        />
                      </>
                    )}

                    <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveAction(index)} className="text-red-600">
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