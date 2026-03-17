import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { adminApi, AdminProject, AdminGreenhouse } from '@/lib/adminApi';
import { Plus, Pencil, Trash2, Search, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SensorConfig {
  id: number;
  sensor_key: string;
  name_th: string;
  sensor_type: string;
  data_key: string;
  unit: string;
  icon: string;
  color: string;
  alert_min: number | null;
  alert_max: number | null;
  calibration_offset: number;
  calibration_scale: number;
  is_active: number;
}

export function SensorsPage() {
  const { addToast } = useToast();
  const { t } = useT();

  const SENSOR_TYPES = [
    { value: 'air',    label: t('admin.sensor.typeAir') },
    { value: 'soil',   label: t('admin.sensor.typeSoil') },
    { value: 'water',  label: t('admin.sensor.typeWater') },
    { value: 'light',  label: t('admin.sensor.typeLight') },
    { value: 'custom', label: t('admin.sensor.typeCustom') },
  ];

  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [greenhouses, setGreenhouses] = useState<AdminGreenhouse[]>([]);
  const [sensors, setSensors] = useState<SensorConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedGh, setSelectedGh] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSensor, setEditingSensor] = useState<SensorConfig | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  useEffect(() => { adminApi.getAdminProjects().then(setProjects).catch(() => {}); }, []);

  useEffect(() => {
    if (selectedProject) {
      adminApi.getAdminGreenhouses(selectedProject).then(setGreenhouses).catch(() => {});
      setSelectedGh(''); setSensors([]);
    }
  }, [selectedProject]);

  useEffect(() => { if (selectedProject && selectedGh) fetchSensors(); }, [selectedProject, selectedGh]);

  const fetchSensors = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<{ sensors: SensorConfig[] }>(`/admin/sensors/${selectedProject}/${selectedGh}`);
      if (response.success && response.data) setSensors(response.data.sensors);
    } catch { addToast({ type: 'error', message: t('common.error') }); }
    finally { setIsLoading(false); }
  };

  const handleDelete = async (sensor: SensorConfig) => {
    if (!confirm(t('admin.sensor.deleteConfirm').replace('{name}', sensor.name_th))) return;
    try {
      await api.delete(`/admin/sensors/${selectedProject}/${selectedGh}/${sensor.sensor_key}`);
      addToast({ type: 'success', message: t('admin.sensor.deleteSuccess') }); fetchSensors();
    } catch { addToast({ type: 'error', message: t('common.error') }); }
  };

  const handleApplyTemplate = async (template: string) => {
    try {
      await api.post(`/admin/sensors/${selectedProject}/${selectedGh}/bulk-create`, { template });
      addToast({ type: 'success', message: t('admin.sensor.templateSuccess') });
      fetchSensors(); setShowTemplateModal(false);
    } catch { addToast({ type: 'error', message: t('common.error') }); }
  };

  const filteredSensors = sensors.filter(s =>
    s.name_th.includes(searchTerm) || s.sensor_key.includes(searchTerm)
  );

  return (
    <AdminLayout title={t('admin.sensors')} subtitle={t('admin.sensor.subtitle')}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('agri.label.project')} <span className="text-red-500">*</span>
          </label>
          <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100">
            <option value="">{t('admin.sensor.selectProject')}</option>
            {projects.map(p => <option key={p.key} value={p.key}>{p.nameTh}</option>)}
          </select>
          <p className="text-xs text-gray-500 mt-1">{t('admin.sensor.selectProjectHint')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('agri.label.greenhouse')} <span className="text-red-500">*</span>
          </label>
          <select value={selectedGh} onChange={(e) => setSelectedGh(e.target.value)} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100" disabled={!selectedProject}>
            <option value="">{t('admin.sensor.selectGh')}</option>
            {greenhouses.map(g => <option key={g.ghKey} value={g.ghKey}>{g.nameTh}</option>)}
          </select>
          <p className="text-xs text-gray-500 mt-1">{t('admin.sensor.selectGhHint')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.search')}</label>
          <Input placeholder={t('common.search') + '...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={() => setShowTemplateModal(true)} variant="outline" disabled={!selectedGh}>
            <Wand2 className="w-4 h-4" />Template
          </Button>
          <Button onClick={() => { setEditingSensor(null); setShowModal(true); }} disabled={!selectedGh}>
            <Plus className="w-4 h-4" />{t('common.add')}
          </Button>
        </div>
      </div>

      {!selectedGh ? (
        <Card><div className="p-8 text-center text-gray-500">{t('admin.sensor.pleaseSelect')}</div></Card>
      ) : isLoading ? (
        <Card><div className="p-8 text-center text-gray-500">{t('common.loading')}</div></Card>
      ) : (
        <Card>
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Sensor</th>
                <th className="text-left px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t('admin.sensor.colType')}</th>
                <th className="text-left px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Data Key</th>
                <th className="text-left px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t('admin.sensor.colUnit')}</th>
                <th className="text-left px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t('admin.sensor.colAlert')}</th>
                <th className="text-right px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {filteredSensors.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">{t('admin.sensor.noSensor')}</td></tr>
              ) : filteredSensors.map((s) => (
                <tr key={s.id} className={cn('hover:bg-gray-50 dark:hover:bg-gray-800/50', !s.is_active && 'opacity-50')}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{s.name_th}</div>
                    <div className="text-xs text-gray-500">{s.sensor_key}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{SENSOR_TYPES.find(tp => tp.value === s.sensor_type)?.label}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-600 dark:text-gray-400">{s.data_key}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.unit}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{s.alert_min ?? '-'} ~ {s.alert_max ?? '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingSensor(s); setShowModal(true); }}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(s)} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showModal && (
        <SensorModal
          projectKey={selectedProject}
          ghKey={selectedGh}
          sensor={editingSensor}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchSensors(); }}
        />
      )}
      {showTemplateModal && (
        <TemplateModal onApply={handleApplyTemplate} onClose={() => setShowTemplateModal(false)} />
      )}
    </AdminLayout>
  );
}

// ─── SensorModal ──────────────────────────────────────────────────────────────
function SensorModal({ projectKey, ghKey, sensor, onClose, onSuccess }: { projectKey: string; ghKey: string; sensor: SensorConfig | null; onClose: () => void; onSuccess: () => void }) {
  const { addToast } = useToast();
  const { t } = useT();

  const SENSOR_TYPES = [
    { value: 'air',    label: t('admin.sensor.typeAir') },
    { value: 'soil',   label: t('admin.sensor.typeSoil') },
    { value: 'water',  label: t('admin.sensor.typeWater') },
    { value: 'light',  label: t('admin.sensor.typeLight') },
    { value: 'custom', label: t('admin.sensor.typeCustom') },
  ];

  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    sensor_key: sensor?.sensor_key || '',
    name_th: sensor?.name_th || '',
    sensor_type: sensor?.sensor_type || 'air',
    data_key: sensor?.data_key || '',
    unit: sensor?.unit || '',
    alert_min: sensor?.alert_min ?? '',
    alert_max: sensor?.alert_max ?? '',
    calibration_offset: sensor?.calibration_offset ?? 0,
    calibration_scale: sensor?.calibration_scale ?? 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true);
    try {
      const data = { ...form, alert_min: form.alert_min === '' ? null : Number(form.alert_min), alert_max: form.alert_max === '' ? null : Number(form.alert_max) };
      if (sensor) await api.put(`/admin/sensors/${projectKey}/${ghKey}/${sensor.sensor_key}`, data);
      else await api.post(`/admin/sensors/${projectKey}/${ghKey}`, data);
      addToast({ type: 'success', message: t('admin.sensor.saveSuccess') }); onSuccess();
    } catch { addToast({ type: 'error', message: t('common.error') }); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">{sensor ? t('admin.sensor.editTitle') : t('admin.sensor.createTitle')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input label={t('admin.sensor.fieldKey')} value={form.sensor_key} onChange={(e) => setForm({ ...form, sensor_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} required disabled={!!sensor} />
              <p className="text-xs text-gray-500 mt-1">{t('admin.sensor.fieldKeyHint')}</p>
            </div>
            <div>
              <Input label={t('admin.sensor.fieldName')} value={form.name_th} onChange={(e) => setForm({ ...form, name_th: e.target.value })} required />
              <p className="text-xs text-gray-500 mt-1">{t('admin.sensor.fieldNameHint')}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.sensor.fieldType')}</label>
                <select value={form.sensor_type} onChange={(e) => setForm({ ...form, sensor_type: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100">
                  {SENSOR_TYPES.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">{t('admin.sensor.fieldTypeHint')}</p>
              </div>
              <div>
                <Input label={t('admin.sensor.fieldUnit')} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder={t('admin.sensor.fieldUnitPlaceholder')} />
                <p className="text-xs text-gray-500 mt-1">{t('admin.sensor.fieldUnitHint')}</p>
              </div>
            </div>
            <div>
              <Input label={t('admin.sensor.fieldDataKey')} value={form.data_key} onChange={(e) => setForm({ ...form, data_key: e.target.value })} required />
              <p className="text-xs text-gray-500 mt-1">{t('admin.sensor.fieldDataKeyHint')}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input label={t('admin.sensor.alertMin')} type="number" step="any" value={form.alert_min} onChange={(e) => setForm({ ...form, alert_min: e.target.value })} />
                <p className="text-xs text-gray-500 mt-1">{t('admin.sensor.alertMinHint')}</p>
              </div>
              <div>
                <Input label={t('admin.sensor.alertMax')} type="number" step="any" value={form.alert_max} onChange={(e) => setForm({ ...form, alert_max: e.target.value })} />
                <p className="text-xs text-gray-500 mt-1">{t('admin.sensor.alertMaxHint')}</p>
              </div>
            </div>
            <hr className="dark:border-gray-700" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.sensor.calibration')}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input label={t('admin.sensor.calibOffset')} type="number" step="any" value={form.calibration_offset} onChange={(e) => setForm({ ...form, calibration_offset: parseFloat(e.target.value) || 0 })} />
                <p className="text-xs text-gray-500 mt-1">{t('admin.sensor.calibOffsetHint')}</p>
              </div>
              <div>
                <Input label={t('admin.sensor.calibScale')} type="number" step="any" value={form.calibration_scale} onChange={(e) => setForm({ ...form, calibration_scale: parseFloat(e.target.value) || 1 })} />
                <p className="text-xs text-gray-500 mt-1">{t('admin.sensor.calibScaleHint')}</p>
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

// ─── TemplateModal ────────────────────────────────────────────────────────────
function TemplateModal({ onApply, onClose }: { onApply: (t: string) => void; onClose: () => void }) {
  const { t } = useT();
  const templates = [
    { key: 'standard_10_soil', name: 'มาตรฐาน 10 จุดดิน', desc: 'อากาศ 4 ค่า + ดิน 10 จุด (moisture + temp)' },
    { key: 'simple_air_only',  name: 'อากาศอย่างเดียว',   desc: 'อุณหภูมิ + ความชื้นอากาศ' },
  ];
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-2">{t('admin.sensor.templateTitle')}</h2>
          <p className="text-sm text-gray-500 mb-4">{t('admin.sensor.templateDesc')}</p>
          <div className="space-y-3">
            {templates.map(tp => (
              <button key={tp.key} onClick={() => onApply(tp.key)} className="w-full text-left p-4 border rounded-lg hover:border-primary transition-colors dark:border-gray-700 dark:hover:border-primary">
                <p className="font-medium text-gray-900 dark:text-gray-100">{tp.name}</p>
                <p className="text-sm text-gray-500">{tp.desc}</p>
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={onClose} className="w-full mt-4">{t('common.cancel')}</Button>
        </div>
      </Card>
    </div>
  );
}