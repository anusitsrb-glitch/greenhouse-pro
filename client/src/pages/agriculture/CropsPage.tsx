import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import { adminApi, AdminProject, AdminGreenhouse } from '@/lib/adminApi';
import { Plus, Pencil, Trash2, Leaf, Calendar, Check, Sprout } from 'lucide-react';
import { useT } from '@/i18n';

interface Crop {
  id: number;
  name: string;
  variety: string;
  plant_date: string;
  expected_harvest_date: string;
  actual_harvest_date: string | null;
  quantity: number;
  unit: string;
  status: 'planted' | 'growing' | 'harvested' | 'failed';
  notes: string;
  greenhouse_name: string;
}

export function CropsPage() {
  const { t } = useT();
  const { addToast } = useToast();
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [greenhouses, setGreenhouses] = useState<AdminGreenhouse[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedGh, setSelectedGh] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCrop, setEditingCrop] = useState<Crop | null>(null);
  const [filterStatus, setFilterStatus] = useState('');

  const STATUS_CONFIG = {
    planted: { label: t('agri.crop.status.planted'), color: 'bg-blue-100 text-blue-700' },
    growing: { label: t('agri.crop.status.growing'), color: 'bg-green-100 text-green-700' },
    harvested: { label: t('agri.crop.status.harvested'), color: 'bg-purple-100 text-purple-700' },
    failed: { label: t('agri.crop.status.failed'), color: 'bg-red-100 text-red-700' },
  };

  useEffect(() => { adminApi.getAdminProjects().then(setProjects).catch(() => {}); }, []);
  useEffect(() => {
    if (selectedProject) adminApi.getAdminGreenhouses(selectedProject).then(setGreenhouses).catch(() => {});
  }, [selectedProject]);
  useEffect(() => { fetchCrops(); }, [selectedProject, selectedGh, filterStatus]);

  const fetchCrops = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedProject) params.append('project_key', selectedProject);
      if (selectedGh) params.append('gh_key', selectedGh);
      if (filterStatus) params.append('status', filterStatus);
      const response = await api.get<{ crops: Crop[] }>(`/agriculture/crops?${params}`);
      if (response.success && response.data) setCrops(response.data.crops);
    } catch { addToast({ type: 'error', message: t('common.error') }); }
    finally { setIsLoading(false); }
  };

  const handleDelete = async (crop: Crop) => {
    if (!confirm(`${t('agri.crop.confirmDelete')} "${crop.name}"?`)) return;
    try {
      await api.delete(`/agriculture/crops/${crop.id}`);
      addToast({ type: 'success', message: t('msg.deleted') }); fetchCrops();
    } catch { addToast({ type: 'error', message: t('common.error') }); }
  };

  const handleHarvest = async (crop: Crop) => {
    if (!confirm(`${t('agri.crop.confirmHarvest')} "${crop.name}"?`)) return;
    try {
      await api.put(`/agriculture/crops/${crop.id}`, { status: 'harvested', actual_harvest_date: new Date().toISOString().split('T')[0] });
      addToast({ type: 'success', message: t('msg.saved') }); fetchCrops();
    } catch { addToast({ type: 'error', message: t('common.error') }); }
  };

  const getDaysUntilHarvest = (date: string) => Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  const stats = {
    total: crops.length,
    growing: crops.filter(c => c.status === 'growing').length,
    harvested: crops.filter(c => c.status === 'harvested').length,
    nearHarvest: crops.filter(c => (c.status === 'growing' || c.status === 'planted') && getDaysUntilHarvest(c.expected_harvest_date) <= 7 && getDaysUntilHarvest(c.expected_harvest_date) >= 0).length,
  };

  return (
    <PageContainer title={t('agri.menu.crops')} subtitle={t('agri.menu.cropsDesc')}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><Leaf className="w-5 h-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{stats.total}</p><p className="text-sm text-gray-500">{t('agri.crop.statTotal')}</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><Sprout className="w-5 h-5 text-green-600" /></div><div><p className="text-2xl font-bold">{stats.growing}</p><p className="text-sm text-gray-500">{t('agri.crop.status.growing')}</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center"><Check className="w-5 h-5 text-purple-600" /></div><div><p className="text-2xl font-bold">{stats.harvested}</p><p className="text-sm text-gray-500">{t('agri.crop.status.harvested')}</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center"><Calendar className="w-5 h-5 text-yellow-600" /></div><div><p className="text-2xl font-bold">{stats.nearHarvest}</p><p className="text-sm text-gray-500">{t('agri.crop.statNearHarvest')}</p></div></div></Card>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">{t('agri.filter.allProjects')}</option>
          {projects.map(p => <option key={p.key} value={p.key}>{p.nameTh}</option>)}
        </select>
        <select value={selectedGh} onChange={(e) => setSelectedGh(e.target.value)} className="px-3 py-2 border rounded-lg" disabled={!selectedProject}>
          <option value="">{t('agri.filter.allGreenhouses')}</option>
          {greenhouses.map(g => <option key={g.ghKey} value={g.ghKey}>{g.nameTh}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">{t('agri.filter.allStatus')}</option>
          <option value="planted">{t('agri.crop.status.planted')}</option>
          <option value="growing">{t('agri.crop.status.growing')}</option>
          <option value="harvested">{t('agri.crop.status.harvested')}</option>
          <option value="failed">{t('agri.crop.status.failed')}</option>
        </select>
        <div className="flex-1" />
        <Button onClick={() => { setEditingCrop(null); setShowModal(true); }}><Plus className="w-4 h-4" /> {t('agri.crop.addCrop')}</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm">{t('agri.crop.colName')}</th>
                <th className="text-left px-4 py-3 text-sm">{t('agri.col.greenhouse')}</th>
                <th className="text-left px-4 py-3 text-sm">{t('agri.crop.colPlantDate')}</th>
                <th className="text-left px-4 py-3 text-sm">{t('agri.crop.colExpectedHarvest')}</th>
                <th className="text-left px-4 py-3 text-sm">{t('agri.col.quantity')}</th>
                <th className="text-left px-4 py-3 text-sm">{t('common.status')}</th>
                <th className="text-right px-4 py-3 text-sm">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center">{t('common.loading')}</td></tr>
              ) : crops.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">{t('agri.crop.noData')}</td></tr>
              ) : crops.map((crop) => {
                const daysLeft = getDaysUntilHarvest(crop.expected_harvest_date);
                return (
                  <tr key={crop.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3"><div><p className="font-medium">{crop.name}</p>{crop.variety && <p className="text-xs text-gray-500">{t('agri.crop.variety')}: {crop.variety}</p>}</div></td>
                    <td className="px-4 py-3 text-sm">{crop.greenhouse_name}</td>
                    <td className="px-4 py-3 text-sm">{new Date(crop.plant_date).toLocaleDateString('th-TH')}</td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(crop.expected_harvest_date).toLocaleDateString('th-TH')}
                      {crop.status === 'growing' && daysLeft > 0 && (
                        <span className={`ml-2 text-xs ${daysLeft <= 7 ? 'text-yellow-600' : 'text-gray-400'}`}>
                          ({t('agri.crop.daysLeft').replace('{n}', String(daysLeft))})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{crop.quantity} {crop.unit}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs ${STATUS_CONFIG[crop.status].color}`}>{STATUS_CONFIG[crop.status].label}</span></td>
                    <td className="px-4 py-3 text-right">
                      {(crop.status === 'planted' || crop.status === 'growing') && (
                        <Button variant="ghost" size="sm" onClick={() => handleHarvest(crop)} className="text-green-600"><Check className="w-4 h-4" /></Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => { setEditingCrop(crop); setShowModal(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(crop)} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {showModal && (
        <CropModal
          crop={editingCrop}
          projects={projects}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchCrops(); }}
        />
      )}
    </PageContainer>
  );
}

function CropModal({ crop, projects, onClose, onSuccess }: {
  crop: Crop | null;
  projects: AdminProject[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useT();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [greenhouses, setGreenhouses] = useState<AdminGreenhouse[]>([]);
  const [form, setForm] = useState({
    project_key: '',
    gh_key: '',
    name: crop?.name || '',
    variety: crop?.variety || '',
    plant_date: crop?.plant_date || new Date().toISOString().split('T')[0],
    expected_harvest_date: crop?.expected_harvest_date || '',
    quantity: crop?.quantity || 0,
    unit: crop?.unit || 'ต้น',
    status: crop?.status || 'planted',
    notes: crop?.notes || '',
  });

  useEffect(() => {
    if (form.project_key) adminApi.getAdminGreenhouses(form.project_key).then(setGreenhouses).catch(() => {});
  }, [form.project_key]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true);
    try {
      if (crop) await api.put(`/agriculture/crops/${crop.id}`, form);
      else await api.post('/agriculture/crops', form);
      addToast({ type: 'success', message: t('msg.saved') }); onSuccess();
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || t('common.error') });
    } finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">{crop ? t('agri.crop.editTitle') : t('agri.crop.addTitle')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!crop && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('agri.label.project')}</label>
                  <select value={form.project_key} onChange={(e) => setForm({ ...form, project_key: e.target.value, gh_key: '' })} className="w-full px-3 py-2 border rounded-lg" required>
                    <option value="">{t('agri.label.select')}</option>
                    {projects.map(p => <option key={p.key} value={p.key}>{p.nameTh}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('agri.label.greenhouse')}</label>
                  <select value={form.gh_key} onChange={(e) => setForm({ ...form, gh_key: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required disabled={!form.project_key}>
                    <option value="">{t('agri.label.select')}</option>
                    {greenhouses.map(g => <option key={g.ghKey} value={g.ghKey}>{g.nameTh}</option>)}
                  </select>
                </div>
              </div>
            )}
            <Input label={t('agri.crop.fieldName')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder={t('agri.crop.fieldNamePlaceholder')} />
            <Input label={t('agri.crop.fieldVariety')} value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} placeholder={t('agri.crop.fieldVarietyPlaceholder')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('agri.crop.colPlantDate')} type="date" value={form.plant_date} onChange={(e) => setForm({ ...form, plant_date: e.target.value })} required />
              <Input label={t('agri.crop.colExpectedHarvest')} type="date" value={form.expected_harvest_date} onChange={(e) => setForm({ ...form, expected_harvest_date: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('agri.col.quantity')} type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('agri.col.unit')}</label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="ต้น">{t('agri.unit.plant')}</option>
                  <option value="ถาด">{t('agri.unit.tray')}</option>
                  <option value="แปลง">{t('agri.unit.plot')}</option>
                  <option value="กก.">{t('agri.unit.kg')}</option>
                </select>
              </div>
            </div>
            {crop && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.status')}</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="planted">{t('agri.crop.status.planted')}</option>
                  <option value="growing">{t('agri.crop.status.growing')}</option>
                  <option value="harvested">{t('agri.crop.status.harvested')}</option>
                  <option value="failed">{t('agri.crop.status.failed')}</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('agri.label.notes')}</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={3} placeholder={t('agri.label.notesPlaceholder')} />
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