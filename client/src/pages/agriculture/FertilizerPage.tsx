import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, Button, Input } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import { adminApi, AdminProject, AdminGreenhouse } from '@/lib/adminApi';
import { Plus, Check, Calendar, Droplets, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import { useT } from '@/i18n';

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
  const { t } = useT();
  const { addToast } = useToast();
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [greenhouses, setGreenhouses] = useState<AdminGreenhouse[]>([]);
  const [schedules, setSchedules] = useState<FertilizerSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedGh, setSelectedGh] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<FertilizerSchedule | null>(null);

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
    } catch { addToast({ type: 'error', message: t('common.error') }); }
    finally { setIsLoading(false); }
  };

  const handleComplete = async (schedule: FertilizerSchedule) => {
    try {
      await api.put(`/agriculture/fertilizer/${schedule.id}/complete`, {});
      addToast({ type: 'success', message: t('agri.fertilizer.completeSuccess') });
      fetchSchedules();
    } catch { addToast({ type: 'error', message: t('common.error') }); }
  };

  const handleDelete = async (schedule: FertilizerSchedule) => {
    if (!confirm(`${t('agri.fertilizer.confirmDelete')} "${schedule.fertilizer_name}"?`)) return;
    try {
      await api.delete(`/agriculture/fertilizer/${schedule.id}`);
      addToast({ type: 'success', message: t('msg.deleted') });
      fetchSchedules();
    } catch { addToast({ type: 'error', message: t('common.error') }); }
  };

  const today = new Date().toISOString().split('T')[0];
  const overdue = schedules.filter(s => s.schedule_date < today && !s.is_completed);
  const todayTasks = schedules.filter(s => s.schedule_date === today && !s.is_completed);
  const upcoming = schedules.filter(s => s.schedule_date > today && !s.is_completed);
  const completed = schedules.filter(s => s.is_completed);

  return (
    <PageContainer title={t('agri.menu.fertilizer')} subtitle={t('agri.menu.fertilizerDesc')}>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 border-l-4 border-red-500">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <div><p className="text-2xl font-bold text-red-600">{overdue.length}</p><p className="text-sm text-gray-500">{t('agri.fertilizer.overdue')}</p></div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-yellow-500">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-yellow-500" />
            <div><p className="text-2xl font-bold text-yellow-600">{todayTasks.length}</p><p className="text-sm text-gray-500">{t('agri.fertilizer.today')}</p></div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <Droplets className="w-8 h-8 text-blue-500" />
            <div><p className="text-2xl font-bold text-blue-600">{upcoming.length}</p><p className="text-sm text-gray-500">{t('agri.fertilizer.upcoming')}</p></div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-green-500">
          <div className="flex items-center gap-3">
            <Check className="w-8 h-8 text-green-500" />
            <div><p className="text-2xl font-bold text-green-600">{completed.length}</p><p className="text-sm text-gray-500">{t('agri.fertilizer.completed')}</p></div>
          </div>
        </Card>
      </div>

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
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} className="rounded" />
          <span className="text-sm">{t('agri.fertilizer.showCompleted')}</span>
        </label>
        <div className="flex-1" />
        <Button onClick={() => { setEditingSchedule(null); setShowModal(true); }}>
          <Plus className="w-4 h-4" /> {t('agri.fertilizer.addSchedule')}
        </Button>
      </div>

      {overdue.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-red-600 mb-3">⚠️ {t('agri.fertilizer.overdue')} ({overdue.length})</h3>
          <div className="grid gap-3">
            {overdue.map(s => <ScheduleCard key={s.id} schedule={s} onComplete={handleComplete} onEdit={(s) => { setEditingSchedule(s); setShowModal(true); }} onDelete={handleDelete} isOverdue />)}
          </div>
        </div>
      )}

      {todayTasks.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-yellow-600 mb-3">📅 {t('agri.fertilizer.today')} ({todayTasks.length})</h3>
          <div className="grid gap-3">
            {todayTasks.map(s => <ScheduleCard key={s.id} schedule={s} onComplete={handleComplete} onEdit={(s) => { setEditingSchedule(s); setShowModal(true); }} onDelete={handleDelete} isToday />)}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-blue-600 mb-3">📆 {t('agri.fertilizer.upcoming')} ({upcoming.length})</h3>
          <div className="grid gap-3">
            {upcoming.map(s => <ScheduleCard key={s.id} schedule={s} onComplete={handleComplete} onEdit={(s) => { setEditingSchedule(s); setShowModal(true); }} onDelete={handleDelete} />)}
          </div>
        </div>
      )}

      {showCompleted && completed.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-green-600 mb-3">✅ {t('agri.fertilizer.completed')} ({completed.length})</h3>
          <div className="grid gap-3">
            {completed.map(s => <ScheduleCard key={s.id} schedule={s} onComplete={handleComplete} onEdit={(s) => { setEditingSchedule(s); setShowModal(true); }} onDelete={handleDelete} isCompleted />)}
          </div>
        </div>
      )}

      {schedules.length === 0 && !isLoading && (
        <Card><div className="p-8 text-center text-gray-500">{t('agri.fertilizer.noData')}</div></Card>
      )}

      {showModal && (
        <FertilizerModal
          schedule={editingSchedule}
          projects={projects}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchSchedules(); }}
        />
      )}
    </PageContainer>
  );
}

function ScheduleCard({ schedule, onComplete, onEdit, onDelete, isOverdue, isToday, isCompleted }: {
  schedule: FertilizerSchedule;
  onComplete: (s: FertilizerSchedule) => void;
  onEdit: (s: FertilizerSchedule) => void;
  onDelete: (s: FertilizerSchedule) => void;
  isOverdue?: boolean;
  isToday?: boolean;
  isCompleted?: boolean;
}) {
  const { t } = useT();
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
            <div className="flex gap-2 mt-1 flex-wrap">
              {schedule.fertilizer_type && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{schedule.fertilizer_type}</span>}
              {schedule.amount && <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded text-xs">{schedule.amount} {schedule.unit}</span>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">{new Date(schedule.schedule_date).toLocaleDateString('th-TH')}</p>
          {!isCompleted && (
            <div className="flex gap-1 mt-2 justify-end">
              <Button size="sm" onClick={() => onComplete(schedule)}><Check className="w-4 h-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => onEdit(schedule)}><Pencil className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(schedule)} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
            </div>
          )}
          {isCompleted && (
            <div className="text-right">
              {schedule.completed_at && (
                <p className="text-xs text-gray-400 mt-1">{t('agri.fertilizer.completedAt')}: {new Date(schedule.completed_at).toLocaleString('th-TH')}</p>
              )}
              <div className="flex gap-1 mt-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => onEdit(schedule)}><Pencil className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(schedule)} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </div>
      </div>
      {schedule.notes && <p className="text-sm text-gray-500 mt-2 pl-16">{schedule.notes}</p>}
    </Card>
  );
}

function FertilizerModal({ schedule, projects, onClose, onSuccess }: {
  schedule: FertilizerSchedule | null;
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
    fertilizer_name: schedule?.fertilizer_name || '',
    fertilizer_type: schedule?.fertilizer_type || '',
    amount: schedule?.amount?.toString() || '',
    unit: schedule?.unit || 'g',
    schedule_date: schedule?.schedule_date || new Date().toISOString().split('T')[0],
    notes: schedule?.notes || '',
  });

  useEffect(() => {
    if (form.project_key) adminApi.getAdminGreenhouses(form.project_key).then(setGreenhouses).catch(() => {});
  }, [form.project_key]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (schedule) {
        await api.put(`/agriculture/fertilizer/${schedule.id}`, form);
        addToast({ type: 'success', message: t('msg.saved') });
      } else {
        await api.post('/agriculture/fertilizer', form);
        addToast({ type: 'success', message: t('agri.fertilizer.addSuccess') });
      }
      onSuccess();
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || t('common.error') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">{schedule ? t('agri.fertilizer.editTitle') : t('agri.fertilizer.addTitle')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!schedule && (
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
            <Input label={t('agri.fertilizer.fieldName')} value={form.fertilizer_name} onChange={(e) => setForm({ ...form, fertilizer_name: e.target.value })} required placeholder={t('agri.fertilizer.fieldNamePlaceholder')} />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('agri.fertilizer.fieldType')}</label>
                <select value={form.fertilizer_type} onChange={(e) => setForm({ ...form, fertilizer_type: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">{t('agri.label.select')}</option>
                  <option value="chemical">{t('agri.fertilizer.typeChemical')}</option>
                  <option value="organic">{t('agri.fertilizer.typeOrganic')}</option>
                  <option value="bio">{t('agri.fertilizer.typeBio')}</option>
                  <option value="foliar">{t('agri.fertilizer.typeFoliar')}</option>
                </select>
              </div>
              <Input label={t('agri.fertilizer.fieldDate')} type="date" value={form.schedule_date} onChange={(e) => setForm({ ...form, schedule_date: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('agri.fertilizer.fieldAmount')} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="500" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('agri.col.unit')}</label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="ml">ml</option>
                  <option value="l">l</option>
                </select>
              </div>
            </div>
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