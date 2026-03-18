import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { adminApi, AdminProject, AdminGreenhouse } from '@/lib/adminApi';
import { Plus, Pencil, Trash2, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ControlConfig {
  id: number;
  control_key: string;
  name_th: string;
  control_type: string;
  rpc_method: string;
  attribute_key: string;
  icon: string;
  color: string;
  auto_mode_key: string | null;
  timer_on_key: string | null;
  timer_off_key: string | null;
  sort_order: number;
  is_active: number;
}

const CONTROL_TYPES = [
  { value: 'relay',  label: 'Relay (เปิด/ปิด)' },
  { value: 'motor',  label: 'Motor (เดินหน้า/ถอยหลัง)' },
  { value: 'dimmer', label: 'Dimmer (ปรับระดับ)' },
  { value: 'custom', label: 'Custom' },
];

const ICON_OPTIONS = [
  'Fan', 'Droplets', 'Waves', 'Lightbulb', 'Power',
  'Cog', 'Zap', 'Wind', 'Thermometer', 'Sun',
];

export function ControlsPage() {
  const { addToast } = useToast();
  const { t } = useT();

  const [projects, setProjects]     = useState<AdminProject[]>([]);
  const [greenhouses, setGreenhouses] = useState<AdminGreenhouse[]>([]);
  const [controls, setControls]     = useState<ControlConfig[]>([]);
  const [isLoading, setIsLoading]   = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedGh, setSelectedGh] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [editingControl, setEditingControl] = useState<ControlConfig | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  useEffect(() => {
    adminApi.getAdminProjects().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedProject) {
      adminApi.getAdminGreenhouses(selectedProject).then(setGreenhouses).catch(() => {});
      setSelectedGh(''); setControls([]);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProject && selectedGh) fetchControls();
  }, [selectedProject, selectedGh]);

  const fetchControls = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<{ controls: ControlConfig[] }>(
        `/admin/controls/${selectedProject}/${selectedGh}`
      );
      if (response.success && response.data) setControls(response.data.controls);
    } catch {
      addToast({ type: 'error', message: t('common.error') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (control: ControlConfig) => {
    if (!confirm(`ลบ "${control.name_th}" ใช่ไหม?`)) return;
    try {
      await api.delete(`/admin/controls/${selectedProject}/${selectedGh}/${control.control_key}`);
      addToast({ type: 'success', message: 'ลบ Control สำเร็จ' });
      fetchControls();
    } catch {
      addToast({ type: 'error', message: t('common.error') });
    }
  };

  const handleApplyTemplate = async (template: string) => {
    try {
      await api.post(`/admin/controls/${selectedProject}/${selectedGh}/bulk-create`, { template });
      addToast({ type: 'success', message: 'สร้าง Control จาก Template สำเร็จ' });
      fetchControls(); setShowTemplateModal(false);
    } catch {
      addToast({ type: 'error', message: t('common.error') });
    }
  };

  const filteredControls = controls.filter(c =>
    c.name_th.includes(searchTerm) || c.control_key.includes(searchTerm)
  );

  const getTypeBadgeColor = (type: string) => {
    if (type === 'relay')  return 'bg-blue-100 text-blue-700';
    if (type === 'motor')  return 'bg-purple-100 text-purple-700';
    if (type === 'dimmer') return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <AdminLayout title="จัดการอุปกรณ์ควบคุม" subtitle="เพิ่ม แก้ไข อุปกรณ์ Relay และ Motor ต่อโรงเรือน">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            โปรเจค <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          >
            <option value="">เลือกโปรเจค</option>
            {projects.map(p => <option key={p.key} value={p.key}>{p.nameTh}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            โรงเรือน <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedGh}
            onChange={(e) => setSelectedGh(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            disabled={!selectedProject}
          >
            <option value="">เลือกโรงเรือน</option>
            {greenhouses.map(g => <option key={g.ghKey} value={g.ghKey}>{g.nameTh}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ค้นหา</label>
          <Input
            placeholder="ค้นหา..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={() => setShowTemplateModal(true)} variant="outline" disabled={!selectedGh}>
            <Wand2 className="w-4 h-4" /> Template
          </Button>
          <Button onClick={() => { setEditingControl(null); setShowModal(true); }} disabled={!selectedGh}>
            <Plus className="w-4 h-4" /> เพิ่ม
          </Button>
        </div>
      </div>

      {/* Table */}
      {!selectedGh ? (
        <Card><div className="p-8 text-center text-gray-500">กรุณาเลือกโปรเจคและโรงเรือน</div></Card>
      ) : isLoading ? (
        <Card><div className="p-8 text-center text-gray-500">{t('common.loading')}</div></Card>
      ) : (
        <Card>
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 text-sm text-gray-600 dark:text-gray-400">อุปกรณ์</th>
                <th className="text-left px-4 py-3 text-sm text-gray-600 dark:text-gray-400">ประเภท</th>
                <th className="text-left px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Attribute Key</th>
                <th className="text-left px-4 py-3 text-sm text-gray-600 dark:text-gray-400">RPC Method</th>
                <th className="text-left px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Auto Key</th>
                <th className="text-right px-4 py-3 text-sm text-gray-600 dark:text-gray-400">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {filteredControls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    ยังไม่มีอุปกรณ์ควบคุม กด "เพิ่ม" หรือใช้ Template
                  </td>
                </tr>
              ) : filteredControls.map((c) => (
                <tr key={c.id} className={cn('hover:bg-gray-50 dark:hover:bg-gray-800/50', !c.is_active && 'opacity-50')}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{c.name_th}</div>
                    <div className="text-xs text-gray-500">{c.control_key}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-1 rounded-full text-xs font-medium', getTypeBadgeColor(c.control_type))}>
                      {CONTROL_TYPES.find(tp => tp.value === c.control_type)?.label ?? c.control_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-600 dark:text-gray-400">{c.attribute_key}</td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-600 dark:text-gray-400">{c.rpc_method}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{c.auto_mode_key ?? '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingControl(c); setShowModal(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(c)} className="text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showModal && (
        <ControlModal
          projectKey={selectedProject}
          ghKey={selectedGh}
          control={editingControl}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchControls(); }}
        />
      )}
      {showTemplateModal && (
        <TemplateModal onApply={handleApplyTemplate} onClose={() => setShowTemplateModal(false)} />
      )}
    </AdminLayout>
  );
}

// ─── ControlModal ─────────────────────────────────────────────────────────────
function ControlModal({ projectKey, ghKey, control, onClose, onSuccess }: {
  projectKey: string; ghKey: string;
  control: ControlConfig | null;
  onClose: () => void; onSuccess: () => void;
}) {
  const { addToast } = useToast();
  const { t } = useT();
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    control_key:   control?.control_key   || '',
    name_th:       control?.name_th       || '',
    control_type:  control?.control_type  || 'relay',
    rpc_method:    control?.rpc_method    || '',
    attribute_key: control?.attribute_key || '',
    icon:          control?.icon          || 'Power',
    auto_mode_key: control?.auto_mode_key || '',
    timer_on_key:  control?.timer_on_key  || '',
    timer_off_key: control?.timer_off_key || '',
    sort_order:    control?.sort_order    ?? 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true);
    try {
      const payload = {
        ...form,
        auto_mode_key:  form.auto_mode_key  || null,
        timer_on_key:   form.timer_on_key   || null,
        timer_off_key:  form.timer_off_key  || null,
      };
      if (control) {
        await api.put(`/admin/controls/${projectKey}/${ghKey}/${control.control_key}`, payload);
      } else {
        await api.post(`/admin/controls/${projectKey}/${ghKey}`, payload);
      }
      addToast({ type: 'success', message: 'บันทึก Control สำเร็จ' });
      onSuccess();
    } catch {
      addToast({ type: 'error', message: t('common.error') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">
            {control ? 'แก้ไขอุปกรณ์ควบคุม' : 'เพิ่มอุปกรณ์ควบคุม'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                label="Control Key"
                value={form.control_key}
                onChange={(e) => setForm({ ...form, control_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                required
                disabled={!!control}
              />
              <p className="text-xs text-gray-500 mt-1">เช่น fan_1, valve_2, motor_1 (แก้ไขไม่ได้หลังสร้าง)</p>
            </div>
            <div>
              <Input
                label="ชื่ออุปกรณ์"
                value={form.name_th}
                onChange={(e) => setForm({ ...form, name_th: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500 mt-1">ชื่อที่แสดงในแอพ เช่น พัดลมใหญ่, เปิดน้ำโซน 1</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ประเภท</label>
                <select
                  value={form.control_type}
                  onChange={(e) => setForm({ ...form, control_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                >
                  {CONTROL_TYPES.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Icon</label>
                <select
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                >
                  {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Input
                label="Attribute Key"
                value={form.attribute_key}
                onChange={(e) => setForm({ ...form, attribute_key: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500 mt-1">ThingsBoard attribute key เช่น fan_1_cmd (relay) หรือ motor_1_fw,motor_1_re (motor)</p>
            </div>
            <div>
              <Input
                label="RPC Method"
                value={form.rpc_method}
                onChange={(e) => setForm({ ...form, rpc_method: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500 mt-1">ThingsBoard RPC method เช่น set_fan_1_cmd</p>
            </div>
            <hr className="dark:border-gray-700" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto / Timer Keys (ไม่บังคับ)</p>
            <div>
              <Input
                label="Auto Mode Key"
                value={form.auto_mode_key}
                onChange={(e) => setForm({ ...form, auto_mode_key: e.target.value })}
                placeholder="เช่น fan_1_auto"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Timer On Key"
                value={form.timer_on_key}
                onChange={(e) => setForm({ ...form, timer_on_key: e.target.value })}
                placeholder="เช่น fan_1_on"
              />
              <Input
                label="Timer Off Key"
                value={form.timer_off_key}
                onChange={(e) => setForm({ ...form, timer_off_key: e.target.value })}
                placeholder="เช่น fan_1_off"
              />
            </div>
            <Input
              label="Sort Order"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
            />
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
  const templates = [
    { key: 'standard_5_relay_4_motor', name: 'มาตรฐาน 5 Relay + 4 Motor', desc: 'พัดลม 2 + วาล์ว 1 + ปั๊ม 1 + ไฟ 1 + มอเตอร์พรางแสง 4' },
    { key: 'simple_2_relay',           name: '2 Relay อย่างง่าย',          desc: 'Relay 1 + Relay 2' },
  ];
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-2">เลือก Template</h2>
          <p className="text-sm text-gray-500 mb-4">สร้างชุดอุปกรณ์อัตโนมัติ (ข้ามรายการที่มีอยู่แล้ว)</p>
          <div className="space-y-3">
            {templates.map(tp => (
              <button
                key={tp.key}
                onClick={() => onApply(tp.key)}
                className="w-full text-left p-4 border rounded-lg hover:border-primary transition-colors dark:border-gray-700 dark:hover:border-primary"
              >
                <p className="font-medium text-gray-900 dark:text-gray-100">{tp.name}</p>
                <p className="text-sm text-gray-500">{tp.desc}</p>
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={onClose} className="w-full mt-4">ยกเลิก</Button>
        </div>
      </Card>
    </div>
  );
}
