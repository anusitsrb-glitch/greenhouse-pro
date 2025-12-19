import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import { adminApi, AdminProject, AdminGreenhouse } from '@/lib/adminApi';
import { Plus, Pencil, Trash2, Search, Thermometer, Wand2 } from 'lucide-react';
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

const SENSOR_TYPES = [
  { value: 'air', label: 'อากาศ' },
  { value: 'soil', label: 'ดิน' },
  { value: 'water', label: 'น้ำ' },
  { value: 'light', label: 'แสง' },
  { value: 'custom', label: 'อื่นๆ' },
];

export function SensorsPage() {
  const { addToast } = useToast();
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
    } catch { addToast({ type: 'error', message: 'ไม่สามารถโหลดข้อมูลได้' }); }
    finally { setIsLoading(false); }
  };

  const handleDelete = async (sensor: SensorConfig) => {
    if (!confirm(`ลบ "${sensor.name_th}"?`)) return;
    try {
      await api.delete(`/admin/sensors/${selectedProject}/${selectedGh}/${sensor.sensor_key}`);
      addToast({ type: 'success', message: 'ลบสำเร็จ' }); fetchSensors();
    } catch { addToast({ type: 'error', message: 'เกิดข้อผิดพลาด' }); }
  };

  const handleApplyTemplate = async (template: string) => {
    try {
      await api.post(`/admin/sensors/${selectedProject}/${selectedGh}/bulk-create`, { template });
      addToast({ type: 'success', message: 'สร้าง Sensor สำเร็จ' }); fetchSensors(); setShowTemplateModal(false);
    } catch { addToast({ type: 'error', message: 'เกิดข้อผิดพลาด' }); }
  };

  const filteredSensors = sensors.filter(s => s.name_th.includes(searchTerm) || s.sensor_key.includes(searchTerm));

  return (
    <AdminLayout title="จัดการ Sensor" subtitle="เพิ่ม แก้ไข Sensor แบบ Dynamic รองรับการขยายในอนาคต">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">โปรเจกต์ <span className="text-red-500">*</span></label>
          <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
            <option value="">เลือกโปรเจกต์...</option>
            {projects.map(p => <option key={p.key} value={p.key}>{p.nameTh}</option>)}
          </select>
          <p className="text-xs text-gray-500 mt-1">เลือกโปรเจกต์ที่ต้องการจัดการ</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">โรงเรือน <span className="text-red-500">*</span></label>
          <select value={selectedGh} onChange={(e) => setSelectedGh(e.target.value)} className="w-full px-3 py-2 border rounded-lg" disabled={!selectedProject}>
            <option value="">เลือกโรงเรือน...</option>
            {greenhouses.map(g => <option key={g.ghKey} value={g.ghKey}>{g.nameTh}</option>)}
          </select>
          <p className="text-xs text-gray-500 mt-1">เลือกโรงเรือนที่ต้องการตั้งค่า Sensor</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ค้นหา</label>
          <Input placeholder="ค้นหา..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={() => setShowTemplateModal(true)} variant="outline" disabled={!selectedGh}><Wand2 className="w-4 h-4" />Template</Button>
          <Button onClick={() => { setEditingSensor(null); setShowModal(true); }} disabled={!selectedGh}><Plus className="w-4 h-4" />เพิ่ม</Button>
        </div>
      </div>

      {!selectedGh ? (
        <Card><div className="p-8 text-center text-gray-500">กรุณาเลือกโปรเจกต์และโรงเรือน</div></Card>
      ) : isLoading ? (
        <Card><div className="p-8 text-center">กำลังโหลด...</div></Card>
      ) : (
        <Card>
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm">Sensor</th>
                <th className="text-left px-4 py-3 text-sm">ประเภท</th>
                <th className="text-left px-4 py-3 text-sm">Data Key</th>
                <th className="text-left px-4 py-3 text-sm">หน่วย</th>
                <th className="text-left px-4 py-3 text-sm">แจ้งเตือน</th>
                <th className="text-right px-4 py-3 text-sm">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSensors.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">ไม่มี Sensor - กด Template เพื่อสร้างชุดมาตรฐาน</td></tr>
              ) : filteredSensors.map((s) => (
                <tr key={s.id} className={cn(!s.is_active && 'opacity-50')}>
                  <td className="px-4 py-3"><div className="font-medium">{s.name_th}</div><div className="text-xs text-gray-500">{s.sensor_key}</div></td>
                  <td className="px-4 py-3"><Badge variant="secondary">{SENSOR_TYPES.find(t => t.value === s.sensor_type)?.label}</Badge></td>
                  <td className="px-4 py-3 font-mono text-sm">{s.data_key}</td>
                  <td className="px-4 py-3">{s.unit}</td>
                  <td className="px-4 py-3 text-sm">{s.alert_min ?? '-'} ~ {s.alert_max ?? '-'}</td>
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

      {showModal && <SensorModal projectKey={selectedProject} ghKey={selectedGh} sensor={editingSensor} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); fetchSensors(); }} />}
      {showTemplateModal && <TemplateModal onApply={handleApplyTemplate} onClose={() => setShowTemplateModal(false)} />}
    </AdminLayout>
  );
}

function SensorModal({ projectKey, ghKey, sensor, onClose, onSuccess }: { projectKey: string; ghKey: string; sensor: SensorConfig | null; onClose: () => void; onSuccess: () => void }) {
  const { addToast } = useToast();
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
      addToast({ type: 'success', message: 'บันทึกสำเร็จ' }); onSuccess();
    } catch { addToast({ type: 'error', message: 'เกิดข้อผิดพลาด' }); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">{sensor ? 'แก้ไข Sensor' : 'เพิ่ม Sensor'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Input label="Sensor Key (ภาษาอังกฤษ)" value={form.sensor_key} onChange={(e) => setForm({ ...form, sensor_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} required disabled={!!sensor} /><p className="text-xs text-gray-500 mt-1">รหัสเฉพาะ เช่น air_temp, soil1_moisture ใช้ตัวพิมพ์เล็ก ขีดล่าง และตัวเลข</p></div>
            <div><Input label="ชื่อ Sensor (ภาษาไทย)" value={form.name_th} onChange={(e) => setForm({ ...form, name_th: e.target.value })} required /><p className="text-xs text-gray-500 mt-1">ชื่อที่แสดงบนหน้าจอ เช่น อุณหภูมิอากาศ</p></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">ประเภท</label><select value={form.sensor_type} onChange={(e) => setForm({ ...form, sensor_type: e.target.value })} className="w-full px-3 py-2 border rounded-lg">{SENSOR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select><p className="text-xs text-gray-500 mt-1">จัดกลุ่มการแสดงผล</p></div>
              <div><Input label="หน่วย" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="°C, %, ppm" /><p className="text-xs text-gray-500 mt-1">หน่วยวัด</p></div>
            </div>
            <div><Input label="Data Key (ThingsBoard)" value={form.data_key} onChange={(e) => setForm({ ...form, data_key: e.target.value })} required /><p className="text-xs text-gray-500 mt-1">ชื่อ Telemetry Key จาก ThingsBoard ต้องตรงกับที่ Device ส่งมา</p></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Input label="แจ้งเตือนต่ำกว่า" type="number" step="any" value={form.alert_min} onChange={(e) => setForm({ ...form, alert_min: e.target.value })} /><p className="text-xs text-gray-500 mt-1">ว่างไว้ = ไม่แจ้งเตือน</p></div>
              <div><Input label="แจ้งเตือนสูงกว่า" type="number" step="any" value={form.alert_max} onChange={(e) => setForm({ ...form, alert_max: e.target.value })} /><p className="text-xs text-gray-500 mt-1">ว่างไว้ = ไม่แจ้งเตือน</p></div>
            </div>
            <hr /><p className="text-sm font-medium">Calibration</p>
            <div className="grid grid-cols-2 gap-4">
              <div><Input label="Offset (+/-)" type="number" step="any" value={form.calibration_offset} onChange={(e) => setForm({ ...form, calibration_offset: parseFloat(e.target.value) || 0 })} /><p className="text-xs text-gray-500 mt-1">ค่าที่บวก/ลบจากค่าจริง</p></div>
              <div><Input label="Scale (x)" type="number" step="any" value={form.calibration_scale} onChange={(e) => setForm({ ...form, calibration_scale: parseFloat(e.target.value) || 1 })} /><p className="text-xs text-gray-500 mt-1">ตัวคูณ (1 = ไม่เปลี่ยน)</p></div>
            </div>
            <div className="flex gap-2 pt-4"><Button type="button" variant="outline" onClick={onClose} className="flex-1">ยกเลิก</Button><Button type="submit" isLoading={isLoading} className="flex-1">บันทึก</Button></div>
          </form>
        </div>
      </Card>
    </div>
  );
}

function TemplateModal({ onApply, onClose }: { onApply: (t: string) => void; onClose: () => void }) {
  const templates = [
    { key: 'standard_10_soil', name: 'มาตรฐาน 10 จุดดิน', desc: 'อากาศ 4 ค่า + ดิน 10 จุด (moisture + temp)' },
    { key: 'simple_air_only', name: 'อากาศอย่างเดียว', desc: 'อุณหภูมิ + ความชื้นอากาศ' },
  ];
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-2">เลือก Template</h2>
          <p className="text-sm text-gray-500 mb-4">สร้างชุด Sensor อัตโนมัติ (ข้ามรายการที่มีอยู่แล้ว)</p>
          <div className="space-y-3">{templates.map(t => (<button key={t.key} onClick={() => onApply(t.key)} className="w-full text-left p-4 border rounded-lg hover:border-primary transition-colors"><p className="font-medium">{t.name}</p><p className="text-sm text-gray-500">{t.desc}</p></button>))}</div>
          <Button variant="outline" onClick={onClose} className="w-full mt-4">ยกเลิก</Button>
        </div>
      </Card>
    </div>
  );
}
