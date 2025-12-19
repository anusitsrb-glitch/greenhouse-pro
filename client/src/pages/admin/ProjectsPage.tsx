import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { adminApi, AdminProject } from '@/lib/adminApi';
import { useToast } from '@/hooks/useToast';
import { Pencil, Trash2, Search, FolderPlus, Home, Server, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ProjectsPage() {
  const { addToast } = useToast();
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<AdminProject | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getAdminProjects();
      setProjects(data);
    } catch (error) {
      addToast({ type: 'error', message: 'ไม่สามารถโหลดข้อมูลได้' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredProjects = projects.filter(p => p.nameTh.toLowerCase().includes(searchTerm.toLowerCase()) || p.key.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleDelete = async (project: AdminProject) => {
    if (!confirm(`ต้องการลบโปรเจกต์ "${project.nameTh}" หรือไม่?`)) return;
    try {
      await adminApi.deleteProject(project.key);
      addToast({ type: 'success', message: 'ลบโปรเจกต์สำเร็จ' });
      fetchData();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด' });
    }
  };

  return (
    <AdminLayout title="จัดการโปรเจกต์" subtitle="เพิ่ม แก้ไข และตั้งค่าโปรเจกต์">
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input type="text" placeholder="ค้นหาโปรเจกต์..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Button onClick={() => setShowCreateModal(true)}><FolderPlus className="w-4 h-4" />เพิ่มโปรเจกต์</Button>
      </div>

      {isLoading ? (<div className="text-center py-12 text-gray-500">กำลังโหลด...</div>) : filteredProjects.length === 0 ? (<div className="text-center py-12 text-gray-500">ไม่พบโปรเจกต์</div>) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="overflow-hidden">
              <div className={cn('h-1.5', project.status === 'ready' ? 'bg-green-500' : 'bg-yellow-500')} />
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div><h3 className="font-semibold text-gray-900">{project.nameTh}</h3><p className="text-sm text-gray-500">{project.key}</p></div>
                  <Badge variant={project.status === 'ready' ? 'success' : 'warning'}>{project.status === 'ready' ? 'พร้อม' : 'กำลังพัฒนา'}</Badge>
                </div>
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-2"><Home className="w-4 h-4 text-gray-400" /><span>{project.greenhouseCount} โรงเรือน</span></div>
                  <div className="flex items-center gap-2"><Server className="w-4 h-4 text-gray-400" /><span className="truncate text-xs">{project.tbBaseUrl}</span></div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingProject(project)} className="flex-1"><Pencil className="w-4 h-4" />แก้ไข</Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(project)} className="text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCreateModal && <ProjectModal onClose={() => setShowCreateModal(false)} onSuccess={() => { setShowCreateModal(false); fetchData(); }} />}
      {editingProject && <ProjectModal project={editingProject} onClose={() => setEditingProject(null)} onSuccess={() => { setEditingProject(null); fetchData(); }} />}
    </AdminLayout>
  );
}

function ProjectModal({ project, onClose, onSuccess }: { project?: AdminProject; onClose: () => void; onSuccess: () => void }) {
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ key: project?.key || '', name_th: project?.nameTh || '', status: project?.status || 'developing', tb_base_url: project?.tbBaseUrl || '', tb_username: project?.tbUsername || '', tb_password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (project) { await adminApi.updateProject(project.key, formData); addToast({ type: 'success', message: 'บันทึกโปรเจกต์สำเร็จ' }); }
      else { await adminApi.createProject(formData); addToast({ type: 'success', message: 'สร้างโปรเจกต์สำเร็จ' }); }
      onSuccess();
    } catch (error) { addToast({ type: 'error', message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด' }); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">{project ? 'แก้ไขโปรเจกต์' : 'เพิ่มโปรเจกต์ใหม่'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Key" value={formData.key} onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} required disabled={!!project} />
            <Input label="ชื่อโปรเจกต์" value={formData.name_th} onChange={(e) => setFormData({ ...formData, name_th: e.target.value })} required />
            <div><label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label><select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg"><option value="developing">กำลังพัฒนา</option><option value="ready">พร้อมใช้งาน</option></select></div>
            <hr /><p className="text-sm text-gray-500">ThingsBoard</p>
            <Input label="URL" value={formData.tb_base_url} onChange={(e) => setFormData({ ...formData, tb_base_url: e.target.value })} placeholder="http://thingsboard:8080" required={!project} />
            <Input label="Username" value={formData.tb_username} onChange={(e) => setFormData({ ...formData, tb_username: e.target.value })} required={!project} />
            <div className="relative"><Input label="Password" type={showPassword ? 'text' : 'password'} value={formData.tb_password} onChange={(e) => setFormData({ ...formData, tb_password: e.target.value })} placeholder={project ? '(ไม่เปลี่ยน)' : ''} required={!project} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-8 text-gray-400">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
            <div className="flex gap-2 pt-4"><Button type="button" variant="outline" onClick={onClose} className="flex-1">ยกเลิก</Button><Button type="submit" isLoading={isLoading} className="flex-1">{project ? 'บันทึก' : 'สร้าง'}</Button></div>
          </form>
        </div>
      </Card>
    </div>
  );
}
