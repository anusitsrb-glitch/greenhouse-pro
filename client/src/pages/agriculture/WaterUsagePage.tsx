import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, Button, Input } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import { adminApi, AdminProject, AdminGreenhouse } from '@/lib/adminApi';
import { Plus, Pencil, Trash2, Droplets, DollarSign, TrendingDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useT } from '@/i18n';

interface WaterUsage { id: number; greenhouse_name: string; record_date: string; usage_liters: number; source: string | null; cost: number | null; notes: string | null; }
interface WaterTotals { total_liters: number; total_cost: number; }

export function WaterUsagePage() {
  const { t } = useT();
  const { addToast } = useToast();
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [greenhouses, setGreenhouses] = useState<AdminGreenhouse[]>([]);
  const [records, setRecords] = useState<WaterUsage[]>([]);
  const [totals, setTotals] = useState<WaterTotals>({ total_liters: 0, total_cost: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedGh, setSelectedGh] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WaterUsage | null>(null);

  useEffect(() => { adminApi.getAdminProjects().then(setProjects).catch(() => {}); }, []);
  useEffect(() => { if (selectedProject) adminApi.getAdminGreenhouses(selectedProject).then(setGreenhouses).catch(() => {}); }, [selectedProject]);
  useEffect(() => { fetchRecords(); }, [selectedProject, selectedGh, dateRange]);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedProject) params.append('project_key', selectedProject);
      if (selectedGh) params.append('gh_key', selectedGh);
      if (dateRange.start) params.append('start_date', dateRange.start);
      if (dateRange.end) params.append('end_date', dateRange.end);
      const response = await api.get<{ records: WaterUsage[]; totals: WaterTotals }>(`/agriculture/water-usage?${params}`);
      if (response.success && response.data) {
        setRecords(response.data.records);
        setTotals(response.data.totals || { total_liters: 0, total_cost: 0 });
      }
    } catch { addToast({ type: 'error', message: t('common.error') }); }
    finally { setIsLoading(false); }
  };

  const handleDelete = async (record: WaterUsage) => {
    if (!confirm(t('agri.water.confirmDelete'))) return;
    try {
      await api.delete(`/agriculture/water-usage/${record.id}`);
      addToast({ type: 'success', message: t('msg.deleted') });
      fetchRecords();
    } catch { addToast({ type: 'error', message: t('common.error') }); }
  };

  const chartData = records.slice().reverse().map(r => ({
    date: new Date(r.record_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
    liters: r.usage_liters,
    cost: r.cost || 0,
  }));
  const avgUsage = records.length > 0 ? (totals.total_liters / records.length).toFixed(0) : 0;

  return (
    <PageContainer title={t('agri.menu.water')} subtitle={t('agri.menu.waterDesc')}>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><Droplets className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-2xl font-bold text-blue-600">{(totals.total_liters / 1000).toFixed(1)}</p><p className="text-sm text-gray-500">{t('agri.water.statTotalM3')}</p></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-cyan-600" /></div>
            <div><p className="text-2xl font-bold">{avgUsage}</p><p className="text-sm text-gray-500">{t('agri.water.statAvgPerDay')}</p></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><DollarSign className="w-5 h-5 text-green-600" /></div>
            <div><p className="text-2xl font-bold">฿{totals.total_cost?.toLocaleString() || 0}</p><p className="text-sm text-gray-500">{t('agri.water.statTotalCost')}</p></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center"><DollarSign className="w-5 h-5 text-purple-600" /></div>
            <div>
              <p className="text-2xl font-bold">฿{totals.total_liters > 0 ? ((totals.total_cost / totals.total_liters) * 1000).toFixed(2) : 0}</p>
              <p className="text-sm text-gray-500">{t('agri.water.statPerM3')}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="p-4 mb-6">
          <h3 className="text-lg font-semibold mb-4">{t('agri.water.chartTitle')}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="liters" name={t('agri.water.colUsage')} stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">{t('agri.filter.allProjects')}</option>
          {projects.map(p => <option key={p.key} value={p.key}>{p.nameTh}</option>)}
        </select>
        <select value={selectedGh} onChange={(e) => setSelectedGh(e.target.value)} className="px-3 py-2 border rounded-lg" disabled={!selectedProject}>
          <option value="">{t('agri.filter.allGreenhouses')}</option>
          {greenhouses.map(g => <option key={g.ghKey} value={g.ghKey}>{g.nameTh}</option>)}
        </select>
        <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className="w-40" />
        <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className="w-40" />
        <div className="flex-1" />
        <Button onClick={() => { setEditingRecord(null); setShowModal(true); }}>
          <Plus className="w-4 h-4" /> {t('agri.water.addRecord')}
        </Button>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm">{t('agri.growth.colDate')}</th>
                <th className="text-left px-4 py-3 text-sm">{t('agri.col.greenhouse')}</th>
                <th className="text-right px-4 py-3 text-sm">{t('agri.water.colUsage')}</th>
                <th className="text-left px-4 py-3 text-sm">{t('agri.water.colSource')}</th>
                <th className="text-right px-4 py-3 text-sm">{t('agri.water.colCost')}</th>
                <th className="text-right px-4 py-3 text-sm">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center">{t('common.loading')}</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">{t('agri.water.noData')}</td></tr>
              ) : records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm">{new Date(record.record_date).toLocaleDateString('th-TH')}</td>
                  <td className="px-4 py-3 text-sm">{record.greenhouse_name}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-blue-600">{record.usage_liters.toLocaleString()} L</td>
                  <td className="px-4 py-3 text-sm">{record.source ? t(`agri.water.source.${record.source}`) : '-'}</td>
                  <td className="px-4 py-3 text-sm text-right">{record.cost ? `฿${record.cost.toLocaleString()}` : '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingRecord(record); setShowModal(true); }}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(record)} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showModal && (
        <WaterModal
          record={editingRecord}
          projects={projects}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchRecords(); }}
        />
      )}
    </PageContainer>
  );
}

function WaterModal({ record, projects, onClose, onSuccess }: {
  record: WaterUsage | null;
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
    record_date: record?.record_date || new Date().toISOString().split('T')[0],
    usage_liters: record?.usage_liters || '',
    source: record?.source || '',
    cost: record?.cost || '',
    notes: record?.notes || '',
  });

  useEffect(() => {
    if (form.project_key) adminApi.getAdminGreenhouses(form.project_key).then(setGreenhouses).catch(() => {});
  }, [form.project_key]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true);
    try {
      if (record) await api.put(`/agriculture/water-usage/${record.id}`, form);
      else await api.post('/agriculture/water-usage', form);
      addToast({ type: 'success', message: t('msg.saved') }); onSuccess();
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || t('common.error') });
    } finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">{record ? t('agri.water.editTitle') : t('agri.water.addTitle')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!record && (
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
            <Input label={t('agri.growth.colDate')} type="date" value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} required />
            <Input label={t('agri.water.fieldUsage')} type="number" value={form.usage_liters} onChange={(e) => setForm({ ...form, usage_liters: e.target.value })} required />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('agri.water.colSource')}</label>
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                <option value="">{t('agri.label.select')}</option>
                <option value="tap">{t('agri.water.source.tap')}</option>
                <option value="well">{t('agri.water.source.well')}</option>
                <option value="rain">{t('agri.water.source.rain')}</option>
                <option value="river">{t('agri.water.source.river')}</option>
              </select>
            </div>
            <Input label={t('agri.water.fieldCost')} type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('agri.label.notes')}</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} />
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