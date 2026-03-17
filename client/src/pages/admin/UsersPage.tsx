import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { adminApi, AdminUser, AdminProject } from '@/lib/adminApi';
import { useToast } from '@/hooks/useToast';
import { useT } from '@/i18n';
import {
  Pencil, Trash2, Search, UserPlus, Shield, FolderKanban, KeyRound, Eye, EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';
import { api } from '@/lib/api';

const ROLE_RANK: Record<string, number> = {
  superadmin: 0, admin: 1, operator: 2, viewer: 3,
};

const isAllAccessRole = (role: string) => role === 'admin' || role === 'superadmin';
const isSuperadmin = (role: string) => role === 'superadmin';

export function UsersPage() {
  const { addToast } = useToast();
  const { t } = useT();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actorRole, setActorRole] = useState<string | null>(null);
  const [actorId, setActorId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showAccessModal, setShowAccessModal] = useState<AdminUser | null>(null);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersData, projectsData] = await Promise.all([
        adminApi.getUsers(),
        adminApi.getAdminProjects(),
      ]);
      setUsers(usersData);
      setProjects(projectsData);
    } catch {
      addToast({ type: 'error', message: t('common.error') });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const data: any = await api.get('/auth/me');
        if (!data?.success) return;
        const u = data?.data?.user;
        if (typeof u?.role === 'string') setActorRole(u.role);
        if (typeof u?.id === 'number') setActorId(u.id);
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => { fetchData(); }, []);

  const filteredUsers = users
    .filter(u =>
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const ra = ROLE_RANK[a.role] ?? 99;
      const rb = ROLE_RANK[b.role] ?? 99;
      if (ra !== rb) return ra - rb;
      return a.username.localeCompare(b.username);
    });

  const handleDelete = async (user: AdminUser) => {
    if (isSuperadmin(user.role)) {
      addToast({ type: 'error', message: t('admin.user.noDeleteSuper') });
      return;
    }
    if (!confirm(t('admin.user.deleteConfirm').replace('{name}', user.username))) return;
    try {
      await adminApi.deleteUser(user.id);
      addToast({ type: 'success', message: t('admin.user.deleteSuccess') });
      fetchData();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : t('common.error') });
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    if (isSuperadmin(user.role)) {
      addToast({ type: 'error', message: t('admin.user.noToggleSuper') });
      return;
    }
    try {
      await adminApi.updateUser(user.id, { isActive: !user.isActive });
      addToast({ type: 'success', message: user.isActive ? t('admin.user.deactivatedMsg') : t('admin.user.activatedMsg') });
      fetchData();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : t('common.error') });
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'superadmin': return <Badge variant="destructive">Super Admin</Badge>;
      case 'admin':      return <Badge variant="purple">{t('admin.user.roleAdmin')}</Badge>;
      case 'operator':   return <Badge variant="primary">{t('admin.user.roleOperator')}</Badge>;
      default:           return <Badge variant="secondary">{t('admin.user.roleViewer')}</Badge>;
    }
  };

  return (
    <AdminLayout title={t('admin.users')} subtitle={t('admin.user.subtitle')}>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder={t('admin.user.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <UserPlus className="w-4 h-4" />
          {t('admin.user.addUser')}
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">{t('admin.user.colUser')}</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">{t('admin.user.colRole')}</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">{t('admin.user.colProject')}</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">{t('common.status')}</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">{t('common.loading')}</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">{t('admin.user.noUser')}</td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const lockSuper = isSuperadmin(user.role);
                  const actorIsSuper = actorRole === 'superadmin';
                  const disableEditSuper = lockSuper && actorRole !== null && !actorIsSuper;

                  return (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{user.username}</div>
                        <div className="text-sm text-gray-500">{user.email || '-'}</div>
                      </td>

                      <td className="px-4 py-3">{getRoleBadge(user.role)}</td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <FolderKanban className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {isAllAccessRole(user.role)
                              ? t('admin.user.allProjects')
                              : t('admin.user.projectCount').replace('{n}', String(user.projectAccess?.length ?? user.projectKeys?.length ?? 0))}
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
                          title={lockSuper ? t('admin.user.noToggleSuper') : undefined}
                        >
                          {user.isActive ? t('admin.user.active') : t('admin.user.inactive')}
                        </button>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => setShowAccessModal(user)}
                            disabled={lockSuper || isAllAccessRole(user.role)}
                            title={lockSuper ? t('admin.user.superAllAccess') : isAllAccessRole(user.role) ? t('admin.user.adminAllAccess') : t('admin.user.manageAccess')}
                          >
                            <Shield className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost" size="sm"
                            onClick={() => setResetUser(user)}
                            disabled={actorRole !== 'superadmin'}
                            title={actorRole !== 'superadmin' ? t('admin.user.onlySuperReset') : t('admin.user.resetPassword')}
                          >
                            <KeyRound className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost" size="sm"
                            onClick={() => { if (actorRole === null) return; setEditingUser(user); }}
                            disabled={disableEditSuper}
                            title={disableEditSuper ? t('admin.user.noEditSuper') : t('common.edit')}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost" size="sm"
                            onClick={() => handleDelete(user)}
                            disabled={lockSuper}
                            className={cn('text-red-600 hover:text-red-700 hover:bg-red-50', lockSuper && 'opacity-60 cursor-not-allowed')}
                            title={lockSuper ? t('admin.user.noDeleteSuper') : t('common.delete')}
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

      {showCreateModal && (
        <CreateUserModal onClose={() => setShowCreateModal(false)} onSuccess={() => { setShowCreateModal(false); fetchData(); }} />
      )}
      {editingUser && (
        <EditUserModal user={editingUser} actorRole={actorRole} actorId={actorId} onClose={() => setEditingUser(null)} onSuccess={() => { setEditingUser(null); fetchData(); }} />
      )}
      {showAccessModal && (
        <ProjectAccessModal user={showAccessModal} projects={projects} onClose={() => setShowAccessModal(null)} onSuccess={() => { setShowAccessModal(null); fetchData(); }} />
      )}
      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} onSuccess={() => { setResetUser(null); fetchData(); }} />
      )}
    </AdminLayout>
  );
}

// ─── CreateUserModal ──────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { addToast } = useToast();
  const { t } = useT();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<{ username: string; email: string; password: string; role: UserRole }>({
    username: '', email: '', password: '', role: 'viewer',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await adminApi.createUser({ ...formData, email: formData.email.trim() || undefined });
      addToast({ type: 'success', message: t('admin.user.createSuccess') });
      onSuccess();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : t('common.error') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">{t('admin.user.createTitle')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="create-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin.user.fieldUsername')} <span className="text-red-600">*</span>
              </label>
              <Input id="create-username" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} required placeholder={t('admin.user.fieldUsernamePlaceholder')} />
              <p className="mt-1 text-xs text-gray-500">{t('admin.user.fieldUsernameHint')}</p>
            </div>

            <div>
              <label htmlFor="create-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin.user.fieldEmail')}
              </label>
              <Input id="create-email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder={t('admin.user.fieldEmailPlaceholder')} />
              <p className="mt-1 text-xs text-gray-500">{t('admin.user.fieldEmailHint')}</p>
            </div>

            <div>
              <label htmlFor="create-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin.user.fieldPassword')} <span className="text-red-600">*</span>
              </label>
              <Input id="create-password" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required placeholder={t('admin.user.fieldPasswordPlaceholder')} />
              <p className="mt-1 text-xs text-gray-500">{t('admin.user.fieldPasswordHint')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.user.fieldRole')}</label>
              <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100">
                <option value="viewer">{t('admin.user.roleViewer')} (Viewer)</option>
                <option value="operator">{t('admin.user.roleOperator')} (Operator)</option>
                <option value="admin">{t('admin.user.roleAdmin')} (Admin)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">{t('admin.user.roleHint')}</p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
              <Button type="submit" isLoading={isLoading} className="flex-1">{t('admin.user.createTitle')}</Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}

// ─── EditUserModal ────────────────────────────────────────────────────────────
function EditUserModal({ user, actorRole, actorId, onClose, onSuccess }: { user: AdminUser; actorRole: string | null; actorId: number | null; onClose: () => void; onSuccess: () => void }) {
  const { addToast } = useToast();
  const { t } = useT();
  const [isLoading, setIsLoading] = useState(false);
  const lockRole = user.role === 'superadmin';
  const targetIsSuper = user.role === 'superadmin';
  const actorIsSuper = actorRole === 'superadmin';
  const canEditThisUser = !targetIsSuper || actorIsSuper;
  const [formData, setFormData] = useState<{ username: string; email: string; role: UserRole }>({
    username: user.username, email: user.email ?? '', role: user.role as UserRole,
  });

  const handleSave = async () => {
    if (!canEditThisUser) { addToast({ type: 'error', message: t('admin.user.noEditSuper') }); return; }
    setIsLoading(true);
    try {
      const payload: any = {};
      const usernameTrimmed = formData.username.trim();
      if (usernameTrimmed !== user.username.trim()) payload.username = usernameTrimmed;
      const emailTrimmed = formData.email.trim();
      if (emailTrimmed !== (user.email ?? '').trim()) payload.email = emailTrimmed === '' ? null : emailTrimmed;
      if (!lockRole && formData.role !== user.role) payload.role = formData.role;

      if (Object.keys(payload).length === 0) {
        addToast({ type: 'info', message: t('admin.user.noChange') });
        onSuccess();
        return;
      }
      await adminApi.updateUser(user.id, payload);
      addToast({ type: 'success', message: t('admin.user.saveSuccess') });
      if (typeof payload.username === 'string' && payload.username.trim().length > 0 && actorId != null && actorId === user.id) {
        onSuccess(); setTimeout(() => window.location.reload(), 200); return;
      }
      onSuccess();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : t('common.error') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">{t('admin.user.editTitle')}: {user.username}</h2>

          {!canEditThisUser && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-800 text-sm">{t('admin.user.noEditSuper')}</div>
          )}
          {lockRole && canEditThisUser && (
            <div className="mb-4 p-3 rounded-lg bg-yellow-50 text-yellow-800 text-sm">{t('admin.user.superLockRole')}</div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="edit-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin.user.fieldUsername')}
              </label>
              <Input id="edit-username" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder={t('admin.user.fieldUsernamePlaceholder')} disabled={!canEditThisUser} />
              <p className="mt-1 text-xs text-gray-500">{t('admin.user.fieldUsernameHint')}</p>
            </div>

            <div>
              <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin.user.fieldEmail')}
              </label>
              <Input id="edit-email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder={t('admin.user.fieldEmailPlaceholder')} disabled={!canEditThisUser} />
              <p className="mt-1 text-xs text-gray-500">{t('admin.user.fieldEmailHint')}</p>
            </div>

            {!lockRole && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.user.fieldRole')}</label>
                <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100" disabled={!canEditThisUser}>
                  <option value="viewer">{t('admin.user.roleViewer')} (Viewer)</option>
                  <option value="operator">{t('admin.user.roleOperator')} (Operator)</option>
                  <option value="admin">{t('admin.user.roleAdmin')} (Admin)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">{t('admin.user.roleHint')}</p>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
              <Button type="button" onClick={handleSave} isLoading={isLoading} className="flex-1" disabled={!canEditThisUser}>{t('common.save')}</Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── ProjectAccessModal ───────────────────────────────────────────────────────
function ProjectAccessModal({ user, projects, onClose, onSuccess }: { user: AdminUser; projects: AdminProject[]; onClose: () => void; onSuccess: () => void }) {
  const { addToast } = useToast();
  const { t } = useT();
  const [isLoadingAccess, setIsLoadingAccess] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const allAccess = isAllAccessRole(user.role);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setIsLoadingAccess(true);
        if (allAccess) { if (alive) setSelectedIds([]); return; }
        const detail = await adminApi.getUser(user.id);
        const u = (detail as any)?.user ?? detail;
        const accessProjects = u?.projects ?? u?.projectAccess ?? [];
        const ids = Array.isArray(accessProjects) ? accessProjects.map((p: any) => p.id).filter((x: any) => typeof x === 'number') : [];
        if (alive) setSelectedIds(ids);
      } catch {
        if (alive) addToast({ type: 'error', message: t('admin.user.accessLoadError') });
      } finally {
        if (alive) setIsLoadingAccess(false);
      }
    })();
    return () => { alive = false; };
  }, [user.id]);

  const handleToggle = (projectId: number) => {
    setSelectedIds(prev => prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]);
  };

  const handleSubmit = async () => {
    if (allAccess) return;
    setIsSaving(true);
    try {
      await adminApi.updateUserProjectAccess(user.id, selectedIds);
      addToast({ type: 'success', message: t('admin.user.accessSaveSuccess') });
      onSuccess();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : t('common.error') });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-2">{t('admin.user.accessTitle')}: {user.username}</h2>
          <p className="text-sm text-gray-500 mb-4">{t('admin.user.accessDesc')}</p>

          {allAccess ? (
            <div className="p-3 rounded-lg bg-blue-50 text-blue-700 text-sm mb-4">
              {t('admin.user.accessAll').replace('{role}', user.role)}
            </div>
          ) : isLoadingAccess ? (
            <div className="py-6 text-center text-gray-500">{t('admin.user.accessLoading')}</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {projects.map(project => (
                <label key={project.id} className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors', selectedIds.includes(project.id) ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300')}>
                  <input type="checkbox" checked={selectedIds.includes(project.id)} onChange={() => handleToggle(project.id)} className="w-4 h-4 text-primary rounded focus:ring-primary" />
                  <div>
                    <div className="font-medium">{project.nameTh}</div>
                    <div className="text-sm text-gray-500">{project.key}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-4 mt-4 border-t dark:border-gray-700">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
            <Button onClick={handleSubmit} isLoading={isSaving} className="flex-1" disabled={allAccess || isLoadingAccess} title={allAccess ? t('admin.user.adminAllAccess') : undefined}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── ResetPasswordModal ───────────────────────────────────────────────────────
function ResetPasswordModal({ user, onClose, onSuccess }: { user: AdminUser; onClose: () => void; onSuccess: () => void }) {
  const { addToast } = useToast();
  const { t } = useT();
  const [isLoading, setIsLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const canSubmit = newPassword.length >= 6 && confirmPassword.length >= 6 && newPassword === confirmPassword;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { addToast({ type: 'error', message: t('profile.passwordMin6') }); return; }
    if (newPassword !== confirmPassword) { addToast({ type: 'error', message: t('profile.passwordMismatch') }); return; }
    setIsLoading(true);
    try {
      await adminApi.resetUserPassword(user.id, newPassword);
      addToast({ type: 'success', message: t('admin.user.resetSuccess').replace('{name}', user.username) });
      onSuccess();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : t('common.error') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">{t('admin.user.resetTitle')}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {t('admin.user.resetFor')}: <span className="font-medium text-gray-900 dark:text-gray-100">{user.username}</span>
              </p>
            </div>
            <Button type="button" variant="ghost" onClick={onClose}>✕</Button>
          </div>

          <form onSubmit={handleReset} className="space-y-4 mt-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin.user.newPassword')} <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <Input type={showPw ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('admin.user.newPasswordPlaceholder')} autoComplete="new-password" disabled={isLoading} className="pr-10" />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label={showPw ? t('admin.user.hidePassword') : t('admin.user.showPassword')}>
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">{t('admin.user.newPasswordHint')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin.user.confirmPassword')} <span className="text-red-600">*</span>
              </label>
              <Input type={showPw ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t('admin.user.confirmPasswordPlaceholder')} autoComplete="new-password" disabled={isLoading} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={isLoading}>{t('common.cancel')}</Button>
              <Button type="submit" className="flex-1" isLoading={isLoading} disabled={!canSubmit || isLoading}>{t('admin.user.resetBtn')}</Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}