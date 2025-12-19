import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import { adminApi, AdminProject, AdminGreenhouse } from '@/lib/adminApi';
import { Plus, Pencil, Trash2, Package, DollarSign, TrendingUp, Scale } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface YieldRecord {
  id: number;
  greenhouse_name: string;
  crop_name: string | null;
  harvest_date: string;
  quantity: number;
  unit: string;
  quality_grade: string | null;
  price_per_unit: number | null;
  total_revenue: number | null;
  notes: string | null;
}

interface YieldTotals {
  total_quantity: number;
  total_revenue: number;
}

const GRADES = [
  { value: 'A', label: 'เกรด A', color: 'bg-green-100 text-green-700' },
  { value: 'B', label: 'เกรด B', color: 'bg-blue-100 text-blue-700' },
  { value: 'C', label: 'เกรด C', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'reject', label: 'คัดทิ้ง', color: 'bg-red-100 text-red-700' },
];

export function YieldPage() {
  const { addToast } = useToast();
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [greenhouses, setGreenhouses] = useState<AdminGreenhouse[]>([]);
  const [records, setRecords] = useState<YieldRecord[]>([]);
  const [totals, setTotals] = useState<YieldTotals>({ total_quantity: 0, total_revenue: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedGh, setSelectedGh] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<YieldRecord | null>(null);

  useEffect(() => { adminApi.getAdminProjects().then(setProjects).catch(() => {}); }, []);
  useEffect(() => {
    if (selectedProject) adminApi.getAdminGreenhouses(selectedProject).then(setGreenhouses).catch(() => {});
  }, [selectedProject]);
  useEffect(() => { fetchRecords(); }, [selectedProject, selectedGh, dateRange]);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedProject) params.append('project_key', selectedProject);
      if (selectedGh) params.append('gh_key', selectedGh);
      if (dateRange.start) params.append('start_date', dateRange.start);
      if (dateRange.end) params.append('end_date', dateRange.end);
      const response = await api.get<{ records: YieldRecord[]; totals: YieldTotals }>(`/agriculture/yield?${params}`);
      if (response.success && response.data) {
        setRecords(response.data.records);
        setTotals(response.data.totals || { total_quantity: 0, total_revenue: 0 });
      }
    } catch { addToast({ type: 'error', message: 'ไม่สามารถโหลดข้อมูลได้' }); }
    finally { setIsLoading(false); }
  };

  const handleDelete = async (record: YieldRecord) => {
    if (!confirm('ลบบันทึกนี้?')) return;
    try {
      await api.delete(`/agriculture/yield/${record.id}`);
      addToast({ type: 'success', message: 'ลบสำเร็จ' });
      fetchRecords();
    } catch { addToast({ type: 'error', message: 'เกิดข้อผิดพลาด' }); }
  };

  // Chart data - group by month
  const chartData = records.reduce((acc: any[], record) => {
    const month = new Date(record.harvest_date).toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
    const existing = acc.find(a => a.month === month);
    if (existing) {
      existing.quantity += record.quantity;
      existing.revenue += record.total_revenue || 0;
    } else {
      acc.push({ month, quantity: record.quantity, revenue: record.total_revenue || 0 });
    }
    return acc;
  }, []);

  return (
    <PageContainer title="บันทึกผลผลิต" subtitle="ติดตามการเก็บเกี่ยวและรายได้">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{records.length}</p>
              <p className="text-sm text-gray-500">ครั้งที่เก็บเกี่ยว</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Scale className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totals.total_quantity?.toLocaleString() || 0}</p>
              <p className="text-sm text-gray-500">ผลผลิตรวม (kg)</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">฿{totals.total_revenue?.toLocaleString() || 0}</p>
              <p className="text-sm text-gray-500">รายได้รวม</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                ฿{totals.total_quantity > 0 ? (totals.total_revenue / totals.total_quantity).toFixed(2) : 0}
              </p>
              <p className="text-sm text-gray-500">ราคาเฉลี่ย/kg</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="p-4 mb-6">
          <h3 className="text-lg font-semibold mb-4">ผลผลิตรายเดือน</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" orientation="left" stroke="#10b981" />
              <YAxis yAxisId="right" orientation="right" stroke="#8b5cf6" />
              <Tooltip />
              <Bar yAxisId="left" dataKey="quantity" name="ปริมาณ (kg)" fill="#10b981" />
              <Bar yAxisId="right" dataKey="revenue" name="รายได้ (฿)" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">ทุกโปรเจกต์</option>
          {projects.map(p => <option key={p.key} value={p.key}>{p.nameTh}</option>)}
        </select>
        <select value={selectedGh} onChange={(e) => setSelectedGh(e.target.value)} className="px-3 py-2 border rounded-lg" disabled={!selectedProject}>
          <option value="">ทุกโรงเรือน</option>
          {greenhouses.map(g => <option key={g.ghKey} value={g.ghKey}>{g.nameTh}</option>)}
        </select>
        <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className="w-40" placeholder="ตั้งแต่" />
        <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className="w-40" placeholder="ถึง" />
        <div className="flex-1" />
        <Button onClick={() => { setEditingRecord(null); setShowModal(true); }}>
          <Plus className="w-4 h-4" /> บันทึกผลผลิต
        </Button>
      </div>

      {/* Records Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm">วันที่</th>
                <th className="text-left px-4 py-3 text-sm">โรงเรือน</th>
                <th className="text-left px-4 py-3 text-sm">พืช</th>
                <th className="text-right px-4 py-3 text-sm">ปริมาณ</th>
                <th className="text-left px-4 py-3 text-sm">เกรด</th>
                <th className="text-right px-4 py-3 text-sm">ราคา/หน่วย</th>
                <th className="text-right px-4 py-3 text-sm">รายได้</th>
                <th className="text-right px-4 py-3 text-sm">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center">กำลังโหลด...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">ยังไม่มีข้อมูล</td></tr>
              ) : records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{new Date(record.harvest_date).toLocaleDateString('th-TH')}</td>
                  <td className="px-4 py-3 text-sm">{record.greenhouse_name}</td>
                  <td className="px-4 py-3 text-sm">{record.crop_name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">{record.quantity} {record.unit}</td>
                  <td className="px-4 py-3">
                    {record.quality_grade && (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${GRADES.find(g => g.value === record.quality_grade)?.color || ''}`}>
                        {GRADES.find(g => g.value === record.quality_grade)?.label || record.quality_grade}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">{record.price_per_unit ? `฿${record.price_per_unit}` : '-'}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-green-600">{record.total_revenue ? `฿${record.total_revenue.toLocaleString()}` : '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingRecord(record); setShowModal(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(record)} className="text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal */}
      {showModal && (
        <YieldModal
          record={editingRecord}
          projects={projects}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchRecords(); }}
        />
      )}
    </PageContainer>
  );
}

function YieldModal({ record, projects, onClose, onSuccess }: {
  record: YieldRecord | null;
  projects: AdminProject[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [greenhouses, setGreenhouses] = useState<AdminGreenhouse[]>([]);
  const [form, setForm] = useState({
    project_key: '',
    gh_key: '',
    harvest_date: record?.harvest_date || new Date().toISOString().split('T')[0],
    quantity: record?.quantity || '',
    unit: record?.unit || 'kg',
    quality_grade: record?.quality_grade || '',
    price_per_unit: record?.price_per_unit || '',
    notes: record?.notes || '',
  });

  useEffect(() => {
    if (form.project_key) adminApi.getAdminGreenhouses(form.project_key).then(setGreenhouses).catch(() => {});
  }, [form.project_key]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (record) {
        await api.put(`/agriculture/yield/${record.id}`, form);
      } else {
        await api.post('/agriculture/yield', form);
      }
      addToast({ type: 'success', message: 'บันทึกสำเร็จ' });
      onSuccess();
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'เกิดข้อผิดพลาด' });
    } finally {
      setIsLoading(false);
    }
  };

  const totalRevenue = (parseFloat(form.quantity as string) || 0) * (parseFloat(form.price_per_unit as string) || 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">{record ? 'แก้ไขบันทึก' : 'บันทึกผลผลิต'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!record && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">โปรเจกต์</label>
                  <select value={form.project_key} onChange={(e) => setForm({ ...form, project_key: e.target.value, gh_key: '' })} className="w-full px-3 py-2 border rounded-lg" required>
                    <option value="">เลือก...</option>
                    {projects.map(p => <option key={p.key} value={p.key}>{p.nameTh}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">โรงเรือน</label>
                  <select value={form.gh_key} onChange={(e) => setForm({ ...form, gh_key: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required disabled={!form.project_key}>
                    <option value="">เลือก...</option>
                    {greenhouses.map(g => <option key={g.ghKey} value={g.ghKey}>{g.nameTh}</option>)}
                  </select>
                </div>
              </div>
            )}
            
            <Input label="วันที่เก็บเกี่ยว" type="date" value={form.harvest_date} onChange={(e) => setForm({ ...form, harvest_date: e.target.value })} required />
            
            <div className="grid grid-cols-2 gap-4">
              <Input label="ปริมาณ" type="number" step="0.1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">หน่วย</label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="kg">กิโลกรัม (kg)</option>
                  <option value="g">กรัม (g)</option>
                  <option value="pcs">ชิ้น</option>
                  <option value="bunch">กำ</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">เกรด</label>
              <div className="flex gap-2">
                {GRADES.map(grade => (
                  <button
                    key={grade.value}
                    type="button"
                    onClick={() => setForm({ ...form, quality_grade: grade.value })}
                    className={`px-3 py-1.5 rounded-lg border transition-colors ${
                      form.quality_grade === grade.value ? 'border-primary bg-primary/10' : 'border-gray-200'
                    }`}
                  >
                    <span className={`text-xs ${grade.color} px-2 py-0.5 rounded-full`}>{grade.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Input label="ราคาต่อหน่วย (฿)" type="number" step="0.01" value={form.price_per_unit} onChange={(e) => setForm({ ...form, price_per_unit: e.target.value })} placeholder="เช่น 50" />

            {totalRevenue > 0 && (
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-sm text-gray-500">รายได้รวม</p>
                <p className="text-2xl font-bold text-green-600">฿{totalRevenue.toLocaleString()}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">บันทึก</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">ยกเลิก</Button>
              <Button type="submit" isLoading={isLoading} className="flex-1">บันทึก</Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
