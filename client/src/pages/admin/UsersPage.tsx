import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { adminApi, AdminUser, AdminProject } from '@/lib/adminApi';
import { useToast } from '@/hooks/useToast';
import {
  Pencil,
  Trash2,
  Search,
  UserPlus,
  Shield,
  FolderKanban
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLE_RANK: Record<string, number> = {
  superadmin: 0,
  admin: 1,
  operator: 2,
  viewer: 3,
};

const isAllAccessRole = (role: string) => role === 'admin' || role === 'superadmin';
const isSuperadmin = (role: string) => role === 'superadmin';

export function UsersPage() {
  const { addToast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // ✅ actor info (ใช้ปิดปุ่มแก้ superadmin สำหรับ admin)
  const [actorRole, setActorRole] = useState<string | null>(null);
  const [actorId, setActorId] = useState<number | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showAccessModal, setShowAccessModal] = useState<AdminUser | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersData, projectsData] = await Promise.all([
        adminApi.getUsers(),
        adminApi.getAdminProjects(),
      ]);
      setUsers(usersData);
      setProjects(projectsData);
    } catch (error) {
      addToast({ type: 'error', message: 'ไม่สามารถโหลดข้อมูลได้' });
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ โหลด me เพื่อรู้ role/id (ถ้าพังไม่เป็นไร UI ยังทำงานเหมือนเดิม)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/auth/me', { credentials: 'include' });
        if (!r.ok) return;
        const data: any = await r.json();
        if (!data?.success) return;
        const u = data?.data?.user;
        if (typeof u?.role === 'string') setActorRole(u.role);
        if (typeof u?.id === 'number') setActorId(u.id);
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const filteredUsers = users
    .filter(user =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const ra = ROLE_RANK[a.role] ?? 99;
      const rb = ROLE_RANK[b.role] ?? 99;
      if (ra !== rb) return ra - rb;
      return a.username.localeCompare(b.username);
    });

  const handleDelete = async (user: AdminUser) => {
    if (isSuperadmin(user.role)) {
      addToast({ type: 'error', message: 'ไม่อนุญาตให้ลบ Super Admin' });
      return;
    }

    if (!confirm(`ต้องการลบผู้ใช้ "${user.username}" หรือไม่?`)) return;

    try {
      await adminApi.deleteUser(user.id);
      addToast({ type: 'success', message: 'ลบผู้ใช้สำเร็จ' });
      fetchData();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด' });
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    if (isSuperadmin(user.role)) {
      addToast({ type: 'error', message: 'ไม่อนุญาตให้ปิด/เปิด Super Admin' });
      return;
    }

    try {
      await adminApi.updateUser(user.id, { isActive: !user.isActive });
      addToast({ type: 'success', message: user.isActive ? 'ปิดใช้งานผู้ใช้แล้ว' : 'เปิดใช้งานผู้ใช้แล้ว' });
      fetchData();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด' });
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'superadmin':
        return <Badge variant="destructive">Super Admin</Badge>;
      case 'admin':
        return <Badge variant="purple">ผู้ดูแล</Badge>;
      case 'operator':
        return <Badge variant="primary">ผู้ควบคุม</Badge>;
      default:
        return <Badge variant="secondary">ผู้ชม</Badge>;
    }
  };

  return (
    <AdminLayout title="จัดการผู้ใช้" subtitle="เพิ่ม แก้ไข และจัดการสิทธิ์ผู้ใช้งานระบบ">
      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="ค้นหาผู้ใช้..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <UserPlus className="w-4 h-4" />
          เพิ่มผู้ใช้
        </Button>
      </div>

      {/* Users table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">ผู้ใช้</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">สิทธิ์</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">โปรเจกต์</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">สถานะ</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    ไม่พบผู้ใช้
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const lockSuper = isSuperadmin(user.role);

                  const actorIsSuper = actorRole === 'superadmin';
                  // ✅ ปิดปุ่มแก้ superadmin สำหรับ admin (เฉพาะเมื่อรู้ actorRole)
                  const disableEditSuper = lockSuper && actorRole !== null && !actorIsSuper;

                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900">{user.username}</div>
                          <div className="text-sm text-gray-500">{user.email || '-'}</div>
                        </div>
                      </td>

                      <td className="px-4 py-3">{getRoleBadge(user.role)}</td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <FolderKanban className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {isAllAccessRole(user.role)
                              ? 'ทั้งหมด'
                              : `${(user.projectAccess?.length ?? user.projectKeys?.length ?? 0)} โปรเจกต์`}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(user)}
                          disabled={lockSuper}
                          className={cn(
                            'px-2 py-1 rounded text-xs font-medium transition-colors',
                            lockSuper && 'opacity-60 cursor-not-allowed',
                            user.isActive
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          )}
                          title={lockSuper ? 'Super Admin ไม่สามารถปิด/เปิดได้' : undefined}
                        >
                          {user.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        </button>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAccessModal(user)}
                            disabled={lockSuper || isAllAccessRole(user.role)}
                            title={
                              lockSuper
                                ? 'Super Admin เข้าถึงทั้งหมด'
                                : isAllAccessRole(user.role)
                                  ? 'Admin เข้าถึงทั้งหมดอยู่แล้ว'
                                  : 'จัดการสิทธิ์โปรเจกต์'
                            }
                          >
                            <Shield className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                            if (actorRole === null) return; // หรือโชว์ toast ว่า "กำลังโหลดสิทธิ์..."
                              setEditingUser(user);
                  }}
                            disabled={disableEditSuper}
                            title={
                              disableEditSuper
                                ? 'ไม่อนุญาตให้ Admin แก้ไข Super Admin'
                                : lockSuper
                                  ? 'Super Admin แก้ไขได้ (role ล็อก)'
                                  : 'แก้ไข'
                            }
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(user)}
                            disabled={lockSuper}
                            className={cn(
                              'text-red-600 hover:text-red-700 hover:bg-red-50',
                              lockSuper && 'opacity-60 cursor-not-allowed'
                            )}
                            title={lockSuper ? 'ไม่อนุญาตให้ลบ Super Admin' : 'ลบ'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchData();
          }}
        />
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          actorRole={actorRole}
          actorId={actorId}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null);
            fetchData();
          }}
        />
      )}

      {/* Project Access Modal */}
      {showAccessModal && (
        <ProjectAccessModal
          user={showAccessModal}
          projects={projects}
          onClose={() => setShowAccessModal(null)}
          onSuccess={() => {
            setShowAccessModal(null);
            fetchData();
          }}
        />
      )}
    </AdminLayout>
  );
}

// Create User Modal Component
function CreateUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'viewer',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await adminApi.createUser(formData);
      addToast({ type: 'success', message: 'สร้างผู้ใช้สำเร็จ' });
      onSuccess();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">เพิ่มผู้ใช้ใหม่</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label htmlFor="create-username" className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อผู้ใช้ <span className="text-red-600">*</span>
              </label>
              <Input
                id="create-username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                placeholder="เช่น somchai"
              />
              <p className="mt-1 text-xs text-gray-500">
                ใช้สำหรับเข้าสู่ระบบ (อย่างน้อย 3 ตัวอักษร)
              </p>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="create-email" className="block text-sm font-medium text-gray-700 mb-1">
                อีเมล (ไม่บังคับ)
              </label>
              <Input
                id="create-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="name@example.com"
              />
              <p className="mt-1 text-xs text-gray-500">
                ใช้สำหรับติดต่อ/กู้รหัสผ่าน (ปล่อยว่างได้)
              </p>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="create-password" className="block text-sm font-medium text-gray-700 mb-1">
                รหัสผ่าน <span className="text-red-600">*</span>
              </label>
              <Input
                id="create-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                placeholder="อย่างน้อย 6 ตัวอักษร"
              />
              <p className="mt-1 text-xs text-gray-500">
                แนะนำ: ผสมตัวอักษรและตัวเลขเพื่อความปลอดภัย
              </p>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">สิทธิ์</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="viewer">ผู้ชม (Viewer)</option>
                <option value="operator">ผู้ควบคุม (Operator)</option>
                <option value="admin">ผู้ดูแล (Admin)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Viewer = ดูอย่างเดียว, Operator = ควบคุม/ตั้งเวลาได้, Admin = จัดการผู้ใช้/โปรเจกต์ได้
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                ยกเลิก
              </Button>
              <Button type="submit" isLoading={isLoading} className="flex-1">
                สร้างผู้ใช้
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}

// Edit User Modal Component
function EditUserModal({
  user,
  actorRole,
  actorId,
  onClose,
  onSuccess
}: {
  user: AdminUser;
  actorRole: string | null;
  actorId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const lockRole = user.role === 'superadmin';

  // ✅ เงื่อนไขสำคัญ: admin ห้ามแก้ superadmin
  const targetIsSuper = user.role === 'superadmin';
  const actorIsSuper = actorRole === 'superadmin';
  const canEditThisUser = !targetIsSuper || actorIsSuper;

  const [formData, setFormData] = useState({
    username: user.username,
    email: user.email ?? '',
    role: user.role,
  });

  const handleSave = async () => {
    // ✅ กันไว้ชัด ๆ (แม้เปิด modal ได้จากกรณี actorRole ไม่รู้)
    if (!canEditThisUser) {
      addToast({ type: 'error', message: 'ไม่อนุญาตให้แก้ไข Super Admin' });
      return;
    }

    setIsLoading(true);

    try {
      // ✅ ส่งเฉพาะสิ่งที่จำเป็นจริง ๆ (กัน zod ฝั่ง backend reject)
      const payload: any = {};

      // --- username: ถ้าไม่แก้ ก็ไม่ต้องส่ง ---
      const usernameTrimmed = (formData.username ?? '').trim();
      const originalUsernameTrimmed = (user.username ?? '').trim();

      if (usernameTrimmed !== originalUsernameTrimmed) {
        payload.username = usernameTrimmed;
      }

      // --- email: ถ้าไม่แก้ ก็ไม่ต้องส่ง / ถ้าเป็นค่าว่างให้เป็น null ---
      const emailTrimmed = (formData.email ?? '').trim();
      const originalEmailTrimmed = (user.email ?? '').trim();

      if (emailTrimmed !== originalEmailTrimmed) {
        payload.email = emailTrimmed === '' ? null : emailTrimmed;
      }

      // --- role: ส่งได้เฉพาะกรณีไม่ใช่ superadmin และมีการเปลี่ยนจริง ---
      if (!lockRole && formData.role !== user.role) {
        payload.role = formData.role;
      }

      if (Object.keys(payload).length === 0) {
        addToast({ type: 'info', message: 'ไม่มีการเปลี่ยนแปลง' });
        onSuccess();
        return;
      }

      await adminApi.updateUser(user.id, payload);

      addToast({ type: 'success', message: 'บันทึกข้อมูลสำเร็จ' });
      // ✅ ถ้าแก้ "ตัวเอง" และมีการเปลี่ยน username → รีโหลดเพื่อให้ทุกส่วนอัปเดตทันที
      const changedUsername = typeof payload.username === 'string' && payload.username.trim().length > 0;
      if (changedUsername && actorId != null && actorId === user.id) {
        onSuccess(); // ปิด modal + refresh ตารางผู้ใช้
        setTimeout(() => window.location.reload(), 200); // รีโหลดเบาๆ หลัง UI ปิด modal
        return;
      }
      onSuccess();

    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">แก้ไขผู้ใช้: {user.username}</h2>

          {!canEditThisUser && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-800 text-sm">
              ไม่อนุญาตให้ <b>Admin</b> แก้ไข <b>Super Admin</b>
            </div>
          )}

          {lockRole && canEditThisUser && (
            <div className="mb-4 p-3 rounded-lg bg-yellow-50 text-yellow-800 text-sm">
              ผู้ใช้เป็น <b>Super Admin</b> (ล็อกการเปลี่ยน Role) — แก้ได้เฉพาะชื่อผู้ใช้และอีเมล
            </div>
          )}

          <div className="space-y-4">
            {/* Username */}
            <div>
              <label htmlFor="edit-username" className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อผู้ใช้ (Username)
              </label>
              <Input
                id="edit-username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="เช่น somchai"
                disabled={!canEditThisUser}
              />
              <p className="mt-1 text-xs text-gray-500">
                ใช้สำหรับเข้าสู่ระบบ (อย่างน้อย 3 ตัวอักษร)
              </p>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700 mb-1">
                อีเมล (ไม่บังคับ)
              </label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="name@example.com"
                disabled={!canEditThisUser}
              />
              <p className="mt-1 text-xs text-gray-500">
                ใช้สำหรับติดต่อ/กู้รหัสผ่าน (ปล่อยว่างได้)
              </p>
            </div>

            {!lockRole && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">สิทธิ์</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  disabled={!canEditThisUser}
                >
                  <option value="viewer">ผู้ชม (Viewer)</option>
                  <option value="operator">ผู้ควบคุม (Operator)</option>
                  <option value="admin">ผู้ดูแล (Admin)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Viewer = ดูอย่างเดียว, Operator = ควบคุม/ตั้งเวลาได้, Admin = จัดการผู้ใช้/โปรเจกต์ได้
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                ยกเลิก
              </Button>

              <Button
                type="button"
                onClick={handleSave}
                isLoading={isLoading}
                className="flex-1"
                disabled={!canEditThisUser}
              >
                บันทึก
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}


// Project Access Modal Component
function ProjectAccessModal({
  user,
  projects,
  onClose,
  onSuccess
}: {
  user: AdminUser;
  projects: AdminProject[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { addToast } = useToast();

  const [isLoadingAccess, setIsLoadingAccess] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const allAccess = isAllAccessRole(user.role);

  // โหลด user detail (ที่มี projects array + id) ก่อน
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setIsLoadingAccess(true);

        // ถ้าเป็น admin/superadmin ไม่ต้องโหลดสิทธิ์รายโปรเจกต์
        if (allAccess) {
          if (alive) setSelectedIds([]);
          return;
        }

        const detail = await adminApi.getUser(user.id);

        const u = (detail as any)?.user ?? detail;
        const accessProjects = u?.projects ?? u?.projectAccess ?? [];

        const ids = Array.isArray(accessProjects)
          ? accessProjects.map((p: any) => p.id).filter((x: any) => typeof x === 'number')
          : [];

        if (alive) setSelectedIds(ids);
      } catch (e) {
        if (alive) addToast({ type: 'error', message: 'โหลดสิทธิ์โปรเจกต์ไม่สำเร็จ' });
      } finally {
        if (alive) setIsLoadingAccess(false);
      }
    })();

    return () => { alive = false; };
  }, [user.id]);

  const handleToggle = (projectId: number) => {
    setSelectedIds(prev =>
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    );
  };

  const handleSubmit = async () => {
    if (allAccess) return;

    setIsSaving(true);
    try {
      await adminApi.updateUserProjectAccess(user.id, selectedIds);
      addToast({ type: 'success', message: 'บันทึกสิทธิ์สำเร็จ' });
      onSuccess();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-2">สิทธิ์โปรเจกต์: {user.username}</h2>
          <p className="text-sm text-gray-500 mb-4">เลือกโปรเจกต์ที่ผู้ใช้สามารถเข้าถึงได้</p>

          {allAccess ? (
            <div className="p-3 rounded-lg bg-blue-50 text-blue-700 text-sm mb-4">
              ผู้ใช้ role = <b>{user.role}</b> เข้าถึงได้ “ทั้งหมด” (ไม่จำเป็นต้องกำหนดรายโปรเจกต์)
            </div>
          ) : isLoadingAccess ? (
            <div className="py-6 text-center text-gray-500">กำลังโหลดสิทธิ์...</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {projects.map(project => (
                <label
                  key={project.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    selectedIds.includes(project.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(project.id)}
                    onChange={() => handleToggle(project.id)}
                    className="w-4 h-4 text-primary rounded focus:ring-primary"
                  />
                  <div>
                    <div className="font-medium">{project.nameTh}</div>
                    <div className="text-sm text-gray-500">{project.key}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-4 mt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              ยกเลิก
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={isSaving}
              className="flex-1"
              disabled={allAccess || isLoadingAccess}
              title={allAccess ? 'Admin/Superadmin เข้าถึงทั้งหมดอยู่แล้ว' : undefined}
            >
              บันทึก
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
