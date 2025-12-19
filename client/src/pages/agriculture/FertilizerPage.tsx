import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import { adminApi, AdminProject, AdminGreenhouse } from '@/lib/adminApi';
import { Plus, Check, Calendar, Droplets, AlertCircle } from 'lucide-react';

interface FertilizerSchedule {
  id: number;
  greenhouse_name: string;
  crop_name: string | null;
  fertilizer_name: string;
  fertilizer_type: string | null;
  amount: number | null;
  unit: string;
  schedule_date: string;
  notes: string | null;
  is_completed: number;
  completed_at: string | null;
}

export function FertilizerPage() {
  const { addToast } = useToast();
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [greenhouses, setGreenhouses] = useState<AdminGreenhouse[]>([]);
  const [schedules, setSchedules] = useState<FertilizerSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedGh, setSelectedGh] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { adminApi.getAdminProjects().then(setProjects).catch(() => {}); }, []);
  useEffect(() => {
    if (selectedProject) adminApi.getAdminGreenhouses(selectedProject).then(setGreenhouses).catch(() => {});
  }, [selectedProject]);
  useEffect(() => { fetchSchedules(); }, [selectedProject, selectedGh, showCompleted]);

  const fetchSchedules = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedProject) params.append('project_key', selectedProject);
      if (selectedGh) params.append('gh_key', selectedGh);
      params.append('completed', showCompleted ? 'true' : 'false');
      const response = await api.get<{ schedules: FertilizerSchedule[] }>(`/agriculture/fertilizer?${params}`);
      if (response.success && response.data) setSchedules(response.data.schedules);
    } catch { addToast({ type: 'error', message: 'ไม่สามารถโหลดข้อมูลได้' }); }
    finally { setIsLoading(false); }
  };

  const handleComplete = async (schedule: FertilizerSchedule) => {
    try {
      await api.put(`/agriculture/fertilizer/${schedule.id}/complete`, {});
      addToast({ type: 'success', message: 'บันทึกสำเร็จ' });
      fetchSchedules();
    } catch { addToast({ type: 'error', message: 'เกิดข้อผิดพลาด' }); }
  };

  const getDaysUntil = (date: string) => {
    const diff = new Date(date).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Group schedules by date
  const today = new Date().toISOString().split('T')[0];
  const overdue = schedules.filter(s => s.schedule_date < today && !s.is_completed);
  const todayTasks = schedules.filter(s => s.schedule_date === today && !s.is_completed);
  const upcoming = schedules.filter(s => s.schedule_date > today && !s.is_completed);
  const completed = schedules.filter(s => s.is_completed);

  return (
    <PageContainer title="ตารางใส่ปุ๋ย" subtitle="วางแผนและติดตามการใส่ปุ๋ย">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 border-l-4 border-red-500">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-600">{overdue.length}</p>
              <p className="text-sm text-gray-500">เกินกำหนด</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-yellow-500">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold text-yellow-600">{todayTasks.length}</p>
              <p className="text-sm text-gray-500">วันนี้</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <Droplets className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-blue-600">{upcoming.length}</p>
              <p className="text-sm text-gray-500">กำลังจะมา</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-green-500">
          <div className="flex items-center gap-3">
            <Check className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-green-600">{completed.length}</p>
              <p className="text-sm text-gray-500">เสร็จแล้ว</p>
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
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} className="rounded" />
          <span className="text-sm">แสดงที่เสร็จแล้ว</span>
        </label>
        <div className="flex-1" />
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> เพิ่มตาราง
        </Button>
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-red-600 mb-3">⚠️ เกินกำหนด ({overdue.length})</h3>
          <div className="grid gap-3">
            {overdue.map(schedule => (
              <ScheduleCard key={schedule.id} schedule={schedule} onComplete={handleComplete} isOverdue />
            ))}
          </div>
        </div>
      )}

      {/* Today */}
      {todayTasks.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-yellow-600 mb-3">📅 วันนี้ ({todayTasks.length})</h3>
          <div className="grid gap-3">
            {todayTasks.map(schedule => (
              <ScheduleCard key={schedule.id} schedule={schedule} onComplete={handleComplete} isToday />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-blue-600 mb-3">📆 กำลังจะมา ({upcoming.length})</h3>
          <div className="grid gap-3">
            {upcoming.map(schedule => (
              <ScheduleCard key={schedule.id} schedule={schedule} onComplete={handleComplete} />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {showCompleted && completed.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-green-600 mb-3">✅ เสร็จแล้ว ({completed.length})</h3>
          <div className="grid gap-3">
            {completed.map(schedule => (
              <ScheduleCard key={schedule.id} schedule={schedule} onComplete={handleComplete} isCompleted />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {schedules.length === 0 && !isLoading && (
        <Card><div className="p-8 text-center text-gray-500">ยังไม่มีตารางใส่ปุ๋ย</div></Card>
      )}

      {/* Modal */}
      {showModal && (
        <FertilizerModal
          projects={projects}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchSchedules(); }}
        />
      )}
    </PageContainer>
  );
}

function ScheduleCard({ schedule, onComplete, isOverdue, isToday, isCompleted }: {
  schedule: FertilizerSchedule;
  onComplete: (s: FertilizerSchedule) => void;
  isOverdue?: boolean;
  isToday?: boolean;
  isCompleted?: boolean;
}) {
  const borderColor = isOverdue ? 'border-l-red-500' : isToday ? 'border-l-yellow-500' : isCompleted ? 'border-l-green-500' : 'border-l-blue-500';
  
  return (
    <Card className={`p-4 border-l-4 ${borderColor} ${isCompleted ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
            <Droplets className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h4 className="font-semibold">{schedule.fertilizer_name}</h4>
            <p className="text-sm text-gray-500">
              {schedule.greenhouse_name}
              {schedule.crop_name && ` • ${schedule.crop_name}`}
            </p>
            <div className="flex gap-2 mt-1">
              {schedule.fertilizer_type && <Badge variant="secondary">{schedule.fertilizer_type}</Badge>}
              {schedule.amount && <Badge variant="primary">{schedule.amount} {schedule.unit}</Badge>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">{new Date(schedule.schedule_date).toLocaleDateString('th-TH')}</p>
          {!isCompleted && (
            <Button size="sm" className="mt-2" onClick={() => onComplete(schedule)}>
              <Check className="w-4 h-4" /> เสร็จ
            </Button>
          )}
          {isCompleted && schedule.completed_at && (
            <p className="text-xs text-gray-400 mt-1">เสร็จ: {new Date(schedule.completed_at).toLocaleString('th-TH')}</p>
          )}
        </div>
      </div>
      {schedule.notes && <p className="text-sm text-gray-500 mt-2 pl-16">{schedule.notes}</p>}
    </Card>
  );
}

function FertilizerModal({ projects, onClose, onSuccess }: {
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
    fertilizer_name: '',
    fertilizer_type: '',
    amount: '',
    unit: 'g',
    schedule_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    if (form.project_key) adminApi.getAdminGreenhouses(form.project_key).then(setGreenhouses).catch(() => {});
  }, [form.project_key]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.post('/agriculture/fertilizer', form);
      addToast({ type: 'success', message: 'เพิ่มตารางสำเร็จ' });
      onSuccess();
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'เกิดข้อผิดพลาด' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">เพิ่มตารางใส่ปุ๋ย</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <Input label="ชื่อปุ๋ย" value={form.fertilizer_name} onChange={(e) => setForm({ ...form, fertilizer_name: e.target.value })} required placeholder="เช่น ปุ๋ยเคมี 16-16-16" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
                <select value={form.fertilizer_type} onChange={(e) => setForm({ ...form, fertilizer_type: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">เลือก...</option>
                  <option value="chemical">ปุ๋ยเคมี</option>
                  <option value="organic">ปุ๋ยอินทรีย์</option>
                  <option value="bio">ปุ๋ยชีวภาพ</option>
                  <option value="foliar">ปุ๋ยทางใบ</option>
                </select>
              </div>
              <Input label="วันที่" type="date" value={form.schedule_date} onChange={(e) => setForm({ ...form, schedule_date: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="ปริมาณ" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="เช่น 500" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">หน่วย</label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="g">กรัม (g)</option>
                  <option value="kg">กิโลกรัม (kg)</option>
                  <option value="ml">มิลลิลิตร (ml)</option>
                  <option value="l">ลิตร (l)</option>
                </select>
              </div>
            </div>
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
