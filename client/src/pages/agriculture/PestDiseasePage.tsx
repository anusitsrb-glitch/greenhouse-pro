import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import { adminApi, AdminProject, AdminGreenhouse } from '@/lib/adminApi';
import { Plus, Pencil, Trash2, Bug, AlertTriangle, Check, Camera } from 'lucide-react';

interface PestDiseaseRecord {
  id: number;
  greenhouse_name: string;
  crop_name: string | null;
  record_type: 'pest' | 'disease';
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affected_area: string | null;
  treatment: string | null;
  photo_url: string | null;
  notes: string | null;
  resolved: number;
  resolved_at: string | null;
  created_at: string;
}

const SEVERITY_CONFIG = {
  low: { label: 'น้อย', color: 'bg-green-100 text-green-700' },
  medium: { label: 'ปานกลาง', color: 'bg-yellow-100 text-yellow-700' },
  high: { label: 'มาก', color: 'bg-orange-100 text-orange-700' },
  critical: { label: 'รุนแรง', color: 'bg-red-100 text-red-700' },
};

export function PestDiseasePage() {
  const { addToast } = useToast();
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [greenhouses, setGreenhouses] = useState<AdminGreenhouse[]>([]);
  const [records, setRecords] = useState<PestDiseaseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedGh, setSelectedGh] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PestDiseaseRecord | null>(null);

  useEffect(() => { adminApi.getAdminProjects().then(setProjects).catch(() => {}); }, []);
  useEffect(() => {
    if (selectedProject) adminApi.getAdminGreenhouses(selectedProject).then(setGreenhouses).catch(() => {});
  }, [selectedProject]);
  useEffect(() => { fetchRecords(); }, [selectedProject, selectedGh, filterType, showResolved]);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedProject) params.append('project_key', selectedProject);
      if (selectedGh) params.append('gh_key', selectedGh);
      if (filterType) params.append('type', filterType);
      params.append('resolved', showResolved ? 'true' : 'false');
      const response = await api.get<{ records: PestDiseaseRecord[] }>(`/agriculture/pest-disease?${params}`);
      if (response.success && response.data) setRecords(response.data.records);
    } catch { addToast({ type: 'error', message: 'ไม่สามารถโหลดข้อมูลได้' }); }
    finally { setIsLoading(false); }
  };

  const handleResolve = async (record: PestDiseaseRecord) => {
    try {
      await api.put(`/agriculture/pest-disease/${record.id}/resolve`, {});
      addToast({ type: 'success', message: 'บันทึกการแก้ไขสำเร็จ' });
      fetchRecords();
    } catch { addToast({ type: 'error', message: 'เกิดข้อผิดพลาด' }); }
  };

  const handleDelete = async (record: PestDiseaseRecord) => {
    if (!confirm('ลบบันทึกนี้?')) return;
    try {
      await api.delete(`/agriculture/pest-disease/${record.id}`);
      addToast({ type: 'success', message: 'ลบสำเร็จ' });
      fetchRecords();
    } catch { addToast({ type: 'error', message: 'เกิดข้อผิดพลาด' }); }
  };

  // Stats
  const activePests = records.filter(r => r.record_type === 'pest' && !r.resolved).length;
  const activeDiseases = records.filter(r => r.record_type === 'disease' && !r.resolved).length;
  const critical = records.filter(r => r.severity === 'critical' && !r.resolved).length;

  return (
    <PageContainer title="โรคและแมลงศัตรูพืช" subtitle="บันทึกและติดตามปัญหาโรคและแมลง">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Bug className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{activePests}</p>
              <p className="text-sm text-gray-500">แมลงศัตรูพืช</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{activeDiseases}</p>
              <p className="text-sm text-gray-500">โรคพืช</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{critical}</p>
              <p className="text-sm text-gray-500">ความรุนแรงสูง</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{records.filter(r => r.resolved).length}</p>
              <p className="text-sm text-gray-500">แก้ไขแล้ว</p>
            </div>
          </div>
        </Card>
      </div>

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
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">ทุกประเภท</option>
          <option value="pest">แมลงศัตรูพืช</option>
          <option value="disease">โรคพืช</option>
        </select>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="rounded" />
          <span className="text-sm">แสดงที่แก้ไขแล้ว</span>
        </label>
        <div className="flex-1" />
        <Button onClick={() => { setEditingRecord(null); setShowModal(true); }}>
          <Plus className="w-4 h-4" /> บันทึกปัญหา
        </Button>
      </div>

      {/* Records */}
      <div className="grid gap-4">
        {isLoading ? (
          <Card><div className="p-8 text-center">กำลังโหลด...</div></Card>
        ) : records.length === 0 ? (
          <Card><div className="p-8 text-center text-gray-500">ไม่มีข้อมูล</div></Card>
        ) : records.map((record) => (
          <Card key={record.id} className={`p-4 ${record.resolved ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${record.record_type === 'pest' ? 'bg-orange-100' : 'bg-purple-100'}`}>
                  {record.record_type === 'pest' ? (
                    <Bug className={`w-6 h-6 ${record.record_type === 'pest' ? 'text-orange-600' : 'text-purple-600'}`} />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-purple-600" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{record.name}</h3>
                    <Badge variant={record.record_type === 'pest' ? 'warning' : 'secondary'}>
                      {record.record_type === 'pest' ? 'แมลง' : 'โรค'}
                    </Badge>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${SEVERITY_CONFIG[record.severity].color}`}>
                      {SEVERITY_CONFIG[record.severity].label}
                    </span>
                    {record.resolved && <Badge variant="success">แก้ไขแล้ว</Badge>}
                  </div>
                  <p className="text-sm text-gray-500">{record.greenhouse_name} {record.crop_name && `• ${record.crop_name}`}</p>
                  {record.affected_area && <p className="text-sm text-gray-500 mt-1">พื้นที่: {record.affected_area}</p>}
                  {record.treatment && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                      <span className="font-medium">การรักษา:</span> {record.treatment}
                    </div>
                  )}
                  {record.notes && <p className="text-sm text-gray-500 mt-2">{record.notes}</p>}
                  {record.photo_url && (
                    <a href={record.photo_url} target="_blank" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm mt-2">
                      <Camera className="w-4 h-4" /> ดูรูป
                    </a>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">{new Date(record.created_at).toLocaleDateString('th-TH')}</p>
                <div className="flex gap-1 mt-2">
                  {!record.resolved && (
                    <Button size="sm" variant="outline" onClick={() => handleResolve(record)}>
                      <Check className="w-4 h-4" /> แก้ไขแล้ว
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { setEditingRecord(record); setShowModal(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(record)} className="text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <PestDiseaseModal
          record={editingRecord}
          projects={projects}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchRecords(); }}
        />
      )}
    </PageContainer>
  );
}

function PestDiseaseModal({ record, projects, onClose, onSuccess }: {
  record: PestDiseaseRecord | null;
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
    record_type: record?.record_type || 'pest',
    name: record?.name || '',
    severity: record?.severity || 'medium',
    affected_area: record?.affected_area || '',
    treatment: record?.treatment || '',
    photo_url: record?.photo_url || '',
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
        await api.put(`/agriculture/pest-disease/${record.id}`, form);
      } else {
        await api.post('/agriculture/pest-disease', form);
      }
      addToast({ type: 'success', message: 'บันทึกสำเร็จ' });
      onSuccess();
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'เกิดข้อผิดพลาด' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">{record ? 'แก้ไขบันทึก' : 'บันทึกโรค/แมลงศัตรูพืช'}</h2>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ประเภท</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="type" checked={form.record_type === 'pest'} onChange={() => setForm({ ...form, record_type: 'pest' })} />
                  <Bug className="w-5 h-5 text-orange-500" /> แมลงศัตรูพืช
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="type" checked={form.record_type === 'disease'} onChange={() => setForm({ ...form, record_type: 'disease' })} />
                  <AlertTriangle className="w-5 h-5 text-purple-500" /> โรคพืช
                </label>
              </div>
            </div>

            <Input label="ชื่อโรค/แมลง" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="เช่น เพลี้ยอ่อน, โรคราน้ำค้าง" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ความรุนแรง</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, severity: key as any })}
                    className={`p-2 rounded-lg border text-center transition-colors ${
                      form.severity === key ? 'border-primary bg-primary/10' : 'border-gray-200'
                    }`}
                  >
                    <span className={`text-xs px-2 py-0.5 rounded-full ${config.color}`}>{config.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Input label="พื้นที่ที่พบ" value={form.affected_area} onChange={(e) => setForm({ ...form, affected_area: e.target.value })} placeholder="เช่น แปลงที่ 1-3, มุมตะวันออก" />
            <Input label="การรักษา/กำจัด" value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} placeholder="เช่น พ่นยาฆ่าแมลงชีวภาพ" />
            <Input label="URL รูปภาพ" value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} placeholder="https://..." />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">บันทึกเพิ่มเติม</label>
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
