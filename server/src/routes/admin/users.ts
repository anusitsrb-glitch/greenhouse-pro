import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../../utils/response.js';
import { requireAdmin } from '../../middleware/auth.js';
import { logAudit, AuditActions } from '../../utils/audit.js';
import { z } from 'zod';
import type { User, UserRole } from '../../types/index.js';

const router = Router();
router.use(requireAdmin);

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().optional().nullable(),
  password: z.string().min(6),
  role: z.enum(['admin', 'operator', 'viewer']),
});

const updateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().optional().nullable(),
  role: z.enum(['admin', 'operator', 'viewer']).optional(),
  is_active: z.boolean().optional(),
});

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'operator', 'viewer']),
});

const updateProjectAccessSchema = z.object({
  project_ids: z.array(z.number().int().positive()),
});

const activateUserSchema = z.object({
  is_active: z.boolean(),
});

const getActorRole = async (req: Request): Promise<UserRole | null> => {
  const actorId = (req as any)?.session?.userId ?? null;
  if (!actorId) return null;
  const sessionRole = (req as any)?.session?.role;
  if (typeof sessionRole === 'string' && sessionRole.length > 0) return sessionRole as UserRole;
  try {
    const res = await query('SELECT role FROM users WHERE id = $1', [actorId]);
    return res.rows[0]?.role ?? null;
  } catch { return null; }
};

const denyIfTargetIsSuperadmin = async (targetRole: UserRole, req: Request, res: Response): Promise<boolean> => {
  const actorRole = await getActorRole(req);
  if (targetRole === 'superadmin' && actorRole !== 'superadmin') {
    sendError(res, 'ไม่อนุญาตให้แก้ไข Super Admin', 403);
    return true;
  }
  return false;
};

// GET /api/admin/users
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        u.id, u.username, u.email, u.role, u.is_active, u.created_at, u.updated_at,
        STRING_AGG(DISTINCT p.key, ',') as project_keys
      FROM users u
      LEFT JOIN user_project_access upa ON u.id = upa.user_id
      LEFT JOIN projects p ON upa.project_id = p.id
      GROUP BY u.id
      ORDER BY
        CASE u.role
          WHEN 'superadmin' THEN 0
          WHEN 'admin' THEN 1
          WHEN 'operator' THEN 2
          WHEN 'viewer' THEN 3
          ELSE 99
        END,
        u.created_at DESC
    `);
    const formattedUsers = result.rows.map((user: any) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: Boolean(user.is_active),
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      projectKeys: user.project_keys ? user.project_keys.split(',') : [],
    }));
    sendSuccess(res, { users: formattedUsers });
  } catch (error) {
    console.error('Error listing users:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// GET /api/admin/users/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const userRes = await query(`SELECT id, username, email, role, is_active, created_at, updated_at FROM users WHERE id = $1`, [userId]);
    const user = userRes.rows[0];
    if (!user) { sendError(res, ThaiErrors.USER_NOT_FOUND, 404); return; }

    const accessRes = await query(`
      SELECT p.id, p.key, p.name_th FROM user_project_access upa
      JOIN projects p ON upa.project_id = p.id WHERE upa.user_id = $1
    `, [userId]);

    sendSuccess(res, {
      user: {
        id: user.id, username: user.username, email: user.email, role: user.role,
        isActive: Boolean(user.is_active), createdAt: user.created_at, updatedAt: user.updated_at,
        projects: accessRes.rows,
      },
    });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// POST /api/admin/users
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const { username, email, password, role } = parsed.data;

    const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) { sendError(res, ThaiErrors.USERNAME_EXISTS, 409); return; }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (username, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, 1) RETURNING id`,
      [username, email ?? null, passwordHash, role]
    );
    const newId = result.rows[0].id;

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.USER_CREATED, detail: { newUserId: newId, username, role } });
    sendSuccess(res, { user: { id: newId, username, email: email ?? null, role }, message: 'สร้างผู้ใช้สำเร็จ' }, undefined, 201);
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// PUT /api/admin/users/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const userRes = await query('SELECT id, username, role, email FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];
    if (!user) { sendError(res, ThaiErrors.USER_NOT_FOUND, 404); return; }
    if (await denyIfTargetIsSuperadmin(user.role, req, res)) return;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (parsed.data.username !== undefined) {
      const uname = String(parsed.data.username).trim();
      if (uname.length < 3) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }
      const dup = await query('SELECT id FROM users WHERE username = $1 AND id != $2', [uname, userId]);
      if (dup.rows.length > 0) { sendError(res, ThaiErrors.USERNAME_EXISTS, 409); return; }
      updates.push(`username = $${idx++}`); values.push(uname);
    }
    if (parsed.data.email !== undefined) { updates.push(`email = $${idx++}`); values.push(parsed.data.email); }
    if (parsed.data.role !== undefined) { updates.push(`role = $${idx++}`); values.push(parsed.data.role); }
    if (parsed.data.is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(parsed.data.is_active ? 1 : 0); }

    if (updates.length === 0) { sendError(res, 'ไม่มีข้อมูลที่จะอัปเดต', 400); return; }

    updates.push(`updated_at = now()::text`);
    values.push(userId);

    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values);

    try {
      logAudit({ userId: req.session.userId ?? null, action: AuditActions.USER_UPDATED, detail: { targetUserId: userId, targetUsername: user.username, updates: parsed.data } });
    } catch {}

    sendSuccess(res, { message: 'อัปเดตผู้ใช้สำเร็จ' });
  } catch (error) {
    console.error('Error updating user:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// POST /api/admin/users/:id/roles
router.post('/:id/roles', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const userRes = await query('SELECT id, username, role FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];
    if (!user) { sendError(res, ThaiErrors.USER_NOT_FOUND, 404); return; }
    if (await denyIfTargetIsSuperadmin(user.role, req, res)) return;

    const { role: newRole } = parsed.data;
    await query(`UPDATE users SET role = $1, updated_at = now()::text WHERE id = $2`, [newRole, userId]);

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.ROLE_CHANGED, detail: { targetUserId: userId, oldRole: user.role, newRole } });
    sendSuccess(res, { message: `เปลี่ยนบทบาทเป็น ${newRole} สำเร็จ` });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// POST /api/admin/users/:id/project-access
router.post('/:id/project-access', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const parsed = updateProjectAccessSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const userRes = await query('SELECT id, username, role FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];
    if (!user) { sendError(res, ThaiErrors.USER_NOT_FOUND, 404); return; }
    if (await denyIfTargetIsSuperadmin(user.role, req, res)) return;

    const { project_ids } = parsed.data;

    const currentRes = await query('SELECT project_id FROM user_project_access WHERE user_id = $1', [userId]);
    const currentIds = currentRes.rows.map((r: any) => r.project_id);
    const toAdd = project_ids.filter(id => !currentIds.includes(id));
    const toRemove = currentIds.filter((id: number) => !project_ids.includes(id));

    if (toRemove.length > 0) {
      await query(`DELETE FROM user_project_access WHERE user_id = $1 AND project_id = ANY($2)`, [userId, toRemove]);
    }
    for (const projectId of toAdd) {
      await query(`INSERT INTO user_project_access (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, projectId]);
    }

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.PROJECT_ACCESS_GRANTED, detail: { targetUserId: userId, project_ids, added: toAdd.length, removed: toRemove.length } });
    sendSuccess(res, { message: 'อัปเดตสิทธิ์การเข้าถึงโปรเจกต์สำเร็จ', added: toAdd.length, removed: toRemove.length });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// POST /api/admin/users/:id/activate
router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const parsed = activateUserSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    if (userId === req.session.userId && !parsed.data.is_active) {
      sendError(res, 'ไม่สามารถปิดบัญชีตัวเองได้', 400); return;
    }

    const userRes = await query('SELECT id, username, role FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];
    if (!user) { sendError(res, ThaiErrors.USER_NOT_FOUND, 404); return; }
    if (await denyIfTargetIsSuperadmin(user.role, req, res)) return;

    await query(`UPDATE users SET is_active = $1, updated_at = now()::text WHERE id = $2`, [parsed.data.is_active ? 1 : 0, userId]);

    logAudit({ userId: req.session.userId ?? null, action: parsed.data.is_active ? AuditActions.USER_ENABLED : AuditActions.USER_DISABLED, detail: { targetUserId: userId, targetUsername: user.username } });
    sendSuccess(res, { message: parsed.data.is_active ? 'เปิดใช้งานบัญชีสำเร็จ' : 'ปิดใช้งานบัญชีสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// DELETE /api/admin/users/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }
    if (userId === req.session.userId) { sendError(res, 'ไม่สามารถลบบัญชีตัวเองได้', 400); return; }

    const targetRes = await query('SELECT id, username, role FROM users WHERE id = $1', [userId]);
    const target = targetRes.rows[0];
    if (!target) { sendError(res, ThaiErrors.USER_NOT_FOUND, 404); return; }
    if (await denyIfTargetIsSuperadmin(target.role, req, res)) return;

    if (target.role === 'superadmin') {
      const cnt = await query(`SELECT COUNT(*) as c FROM users WHERE role = 'superadmin'`);
      if (parseInt(cnt.rows[0].c) <= 1) {
        sendError(res, 'ไม่สามารถลบ Super Admin คนสุดท้ายได้', 400); return;
      }
    }

    await query('DELETE FROM user_project_access WHERE user_id = $1', [userId]);
    await query('UPDATE audit_log SET user_id = NULL WHERE user_id = $1', [userId]);
    await query('DELETE FROM users WHERE id = $1', [userId]);

    try {
      logAudit({ userId: req.session.userId ?? null, action: AuditActions.USER_DELETED, detail: { targetUserId: userId, targetUsername: target.username } });
    } catch {}

    sendSuccess(res, { message: 'ลบผู้ใช้สำเร็จ' });
  } catch (error) {
    console.error('Error deleting user:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;