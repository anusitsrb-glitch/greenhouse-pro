import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
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
  conditions: Array<{
    sensor_key: string;
    condition: string;
    value: number;
  }>;
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

const TRIGGER_TYPES = [
  { value: 'sensor', label: 'เมื่อค่า Sensor', icon: Activity },
  { value: 'time', label: 'ตามเวลา', icon: Clock },
  { value: 'manual', label: 'กดเอง', icon: Zap },
];

const CONDITIONS = [
  { value: 'above', label: 'มากกว่า' },
  { value: 'below', label: 'น้อยกว่า' },
  { value: 'equal', label: 'เท่ากับ' },
  { value: 'between', label: 'อยู่ระหว่าง' },
];

export function AutomationPage() {
  const { addToast } = useToast();
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [greenhouses, setGreenhouses] = useState<AdminGreenhouse[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedGh, setSelectedGh] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

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
    } catch { addToast({ type: 'error', message: 'ไม่สามารถโหลดข้อมูลได้' }); }
    finally { setIsLoading(false); }
  };

  const handleToggle = async (rule: AutomationRule) => {
    try {
      await api.put(`/admin/automation/${selectedProject}/${selectedGh}/${rule.id}/toggle`, {});
      addToast({ type: 'success', message: rule.is_active ? 'ปิดกฎแล้ว' : 'เปิดกฎแล้ว' });
      fetchRules();
    } catch { addToast({ type: 'error', message: 'เกิดข้อผิดพลาด' }); }
  };

  const handleDelete = async (rule: AutomationRule) => {
    if (!confirm(`ลบกฎ "${rule.name}"?`)) return;
    try {
      await api.delete(`/admin/automation/${selectedProject}/${selectedGh}/${rule.id}`);
      addToast({ type: 'success', message: 'ลบสำเร็จ' }); fetchRules();
    } catch { addToast({ type: 'error', message: 'เกิดข้อผิดพลาด' }); }
  };

  const getTriggerIcon = (type: string) => {
    const found = TRIGGER_TYPES.find(t => t.value === type);
    return found ? found.icon : Zap;
  };

  const getTriggerLabel = (type: string) => {
    const found = TRIGGER_TYPES.find(t => t.value === type);
    return found ? found.label : type;
  };

  return (
    <AdminLayout title="Automation Rules" subtitle="กฎอัตโนมัติ - ถ้า X แล้ว Y">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">โปรเจกต์</label>
          <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
            <option value="">เลือกโปรเจกต์...</option>
            {projects.map(p => <option key={p.key} value={p.key}>{p.nameTh}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">โรงเรือน</label>
          <select value={selectedGh} onChange={(e) => setSelectedGh(e.target.value)} className="w-full px-3 py-2 border rounded-lg" disabled={!selectedProject}>
            <option value="">เลือกโรงเรือน...</option>
            {greenhouses.map(g => <option key={g.ghKey} value={g.ghKey}>{g.nameTh}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={() => { setEditingRule(null); setShowModal(true); }} disabled={!selectedGh}>
            <Plus className="w-4 h-4" /> เพิ่มกฎ
          </Button>
        </div>
      </div>

      {/* Rules List */}
      {!selectedGh ? (
        <Card><div className="p-8 text-center text-gray-500">กรุณาเลือกโปรเจกต์และโรงเรือน</div></Card>
      ) : isLoading ? (
        <Card><div className="p-8 text-center">กำลังโหลด...</div></Card>
      ) : rules.length === 0 ? (
        <Card><div className="p-8 text-center text-gray-500">ยังไม่มีกฎอัตโนมัติ</div></Card>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => {
            const TriggerIcon = getTriggerIcon(rule.trigger_type);
            return (
              <Card key={rule.id} className={`p-4 ${!rule.is_active && 'opacity-50'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${rule.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <TriggerIcon className={`w-6 h-6 ${rule.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{rule.name}</h3>
                      {rule.description && <p className="text-sm text-gray-500">{rule.description}</p>}
                      
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="secondary">{getTriggerLabel(rule.trigger_type)}</Badge>
                        
                        {rule.trigger_type === 'sensor' && rule.trigger_config.sensor_key && (
                          <Badge variant="primary">
                            {rule.trigger_config.sensor_key} {CONDITIONS.find(c => c.value === rule.trigger_config.condition)?.label} {rule.trigger_config.value}
                          </Badge>
                        )}
                        
                        {rule.trigger_type === 'time' && rule.trigger_config.time && (
                          <Badge variant="primary">เวลา {rule.trigger_config.time}</Badge>
                        )}

                        <Badge variant="success">{rule.actions.length} Actions</Badge>
                      </div>

                      {rule.last_triggered_at && (
                        <p className="text-xs text-gray-400 mt-2">
                          ทำงานล่าสุด: {new Date(rule.last_triggered_at).toLocaleString('th-TH')} ({rule.trigger_count} ครั้ง)
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
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    name: rule?.name || '',
    description: rule?.description || '',
    trigger_type: rule?.trigger_type || 'sensor',
    trigger_config: rule?.trigger_config || { sensor_key: '', condition: 'above', value: 0 },
    actions: rule?.actions || [{ type: 'control', control_key: '', action: 'on' }],
  });

  const handleAddAction = () => {
    setForm({
      ...form,
      actions: [...form.actions, { type: 'control', control_key: '', action: 'on' }],
    });
  };

  const handleRemoveAction = (index: number) => {
    setForm({
      ...form,
      actions: form.actions.filter((_, i) => i !== index),
    });
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
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">{rule ? 'แก้ไขกฎ' : 'สร้างกฎใหม่'}</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="ชื่อกฎ"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="เช่น เปิดพัดลมเมื่อร้อน"
            />

            <Input
              label="คำอธิบาย (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="รายละเอียดเพิ่มเติม"
            />

            {/* Trigger Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ประเภท Trigger</label>
              <div className="flex gap-2">
                {TRIGGER_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setForm({ ...form, trigger_type: type.value as any })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      form.trigger_type === type.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <type.icon className="w-4 h-4" />
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Trigger Config based on type */}
            {form.trigger_type === 'sensor' && (
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Sensor Key"
                  value={form.trigger_config.sensor_key || ''}
                  onChange={(e) => setForm({
                    ...form,
                    trigger_config: { ...form.trigger_config, sensor_key: e.target.value }
                  })}
                  placeholder="เช่น air_temp"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เงื่อนไข</label>
                  <select
                    value={form.trigger_config.condition || 'above'}
                    onChange={(e) => setForm({
                      ...form,
                      trigger_config: { ...form.trigger_config, condition: e.target.value as any }
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <Input
                  label="ค่า"
                  type="number"
                  value={form.trigger_config.value || 0}
                  onChange={(e) => setForm({
                    ...form,
                    trigger_config: { ...form.trigger_config, value: parseFloat(e.target.value) }
                  })}
                />
              </div>
            )}

            {form.trigger_type === 'time' && (
              <Input
                label="เวลา"
                type="time"
                value={form.trigger_config.time || ''}
                onChange={(e) => setForm({
                  ...form,
                  trigger_config: { ...form.trigger_config, time: e.target.value }
                })}
              />
            )}

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Actions (สิ่งที่จะทำ)</label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddAction}>
                  <Plus className="w-4 h-4" /> เพิ่ม Action
                </Button>
              </div>
              
              <div className="space-y-2">
                {form.actions.map((action, index) => (
                  <div key={index} className="flex gap-2 items-center p-3 bg-gray-50 rounded-lg">
                    <select
                      value={action.type}
                      onChange={(e) => {
                        const newActions = [...form.actions];
                        newActions[index] = { ...action, type: e.target.value as any };
                        setForm({ ...form, actions: newActions });
                      }}
                      className="px-3 py-2 border rounded-lg"
                    >
                      <option value="control">ควบคุมอุปกรณ์</option>
                      <option value="notification">ส่งแจ้งเตือน</option>
                    </select>

                    {action.type === 'control' && (
                      <>
                        <Input
                          placeholder="Control Key (เช่น fan_1)"
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
                          className="px-3 py-2 border rounded-lg"
                        >
                          <option value="on">เปิด</option>
                          <option value="off">ปิด</option>
                          <option value="toggle">สลับ</option>
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
                          className="px-3 py-2 border rounded-lg"
                        >
                          <option value="line">Line</option>
                          <option value="sms">SMS</option>
                        </select>
                        <Input
                          placeholder="ข้อความ"
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
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">ยกเลิก</Button>
              <Button type="submit" isLoading={isLoading} className="flex-1">บันทึก</Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
