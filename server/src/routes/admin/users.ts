import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../../utils/response.js';
import { requireAdmin } from '../../middleware/auth.js';
import { logAudit, AuditActions } from '../../utils/audit.js';
import { z } from 'zod';
import type { User, UserRole } from '../../types/index.js';

const router = Router();

// Apply admin middleware to all routes
router.use(requireAdmin);

// Validation schemas
const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().optional().nullable(),
  password: z.string().min(6),
  role: z.enum(['admin', 'operator', 'viewer']),
});

const updateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(), // ✅ เพิ่มให้แก้ username ได้
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

/** ✅ helper: ดู role ของผู้กระทำ (actor) แบบไม่พัง แม้ session.role ไม่มี */
const getActorRole = (req: Request): UserRole | null => {
  const actorId = (req as any)?.session?.userId ?? null;
  if (!actorId) return null;

  // ถ้ามี session.role ใช้ได้เลย (เร็ว)
  const sessionRole = (req as any)?.session?.role;
  if (typeof sessionRole === 'string' && sessionRole.length > 0) {
    return sessionRole as UserRole;
  }

  // fallback: อ่านจาก DB
  try {
    const row = db.prepare('SELECT role FROM users WHERE id = ?').get(actorId) as { role?: UserRole } | undefined;
    return row?.role ?? null;
  } catch {
    return null;
  }
};

/** ✅ helper: admin ห้ามแก้ superadmin (กันหลุดทุก endpoint) */
const denyIfTargetIsSuperadmin = (targetRole: UserRole, req: Request, res: Response) => {
  const actorRole = getActorRole(req);
  if (targetRole === 'superadmin' && actorRole !== 'superadmin') {
    sendError(res, 'ไม่อนุญาตให้แก้ไข Super Admin', 403);
    return true;
  }
  return false;
};

/**
 * GET /api/admin/users
 * List all users
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const users = db.prepare(`
      SELECT 
        u.id, u.username, u.email, u.role, 
        u.is_active, 
        u.created_at, u.updated_at,
        GROUP_CONCAT(DISTINCT p.key) as project_keys
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
    `).all() as (Omit<User, 'password_hash'> & { project_keys: string | null })[];
    
    const formattedUsers = users.map(user => ({
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

/**
 * GET /api/admin/users/:id
 * Get single user with project access
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    
    if (isNaN(userId)) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }
    
    const user = db.prepare(`
      SELECT id, username, email, role, is_active, created_at, updated_at

      FROM users WHERE id = ?
    `).get(userId) as Omit<User, 'password_hash'> | undefined;
    
    if (!user) {
      sendError(res, ThaiErrors.USER_NOT_FOUND, 404);
      return;
    }
    
    // Get project access
    const projectAccess = db.prepare(`
      SELECT p.id, p.key, p.name_th
      FROM user_project_access upa
      JOIN projects p ON upa.project_id = p.id
      WHERE upa.user_id = ?
    `).all(userId) as { id: number; key: string; name_th: string }[];
    
    sendSuccess(res, {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      
        isActive: Boolean(user.is_active),
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        projects: projectAccess,
      },
    });
  } catch (error) {
    console.error('Error getting user:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/admin/users
 * Create new user
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    
    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }
    
    const { username, email, password, role } = parsed.data;
    
    // Check if username exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      sendError(res, ThaiErrors.USERNAME_EXISTS, 409);
      return;
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Insert user
    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(username, email ?? null, passwordHash, role);
    
    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.USER_CREATED,
      detail: { newUserId: result.lastInsertRowid, username, role },
    });
    
    sendSuccess(res, {
      user: {
        id: result.lastInsertRowid,
        username,
        email: email ?? null,
        role,
      },
      message: 'สร้างผู้ใช้สำเร็จ',
    }, undefined, 201);
  } catch (error) {
    console.error('Error creating user:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * PUT /api/admin/users/:id
 * Update user
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    // Check user exists (✅ ต้องรู้ role เพื่อกัน admin แก้ superadmin)
    const user = db
      .prepare('SELECT id, username, role, email FROM users WHERE id = ?')
      .get(userId) as { id: number; username: string; role: UserRole; email: string | null } | undefined;

    if (!user) {
      sendError(res, ThaiErrors.USER_NOT_FOUND, 404);
      return;
    }

    // ✅ กัน admin แก้ superadmin
    if (denyIfTargetIsSuperadmin(user.role, req, res)) return;

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (parsed.data.username !== undefined) {
      const uname = String(parsed.data.username).trim();

      // กันค่าว่างแบบหลุด schema
      if (uname.length < 3) {
        sendError(res, ThaiErrors.INVALID_INPUT, 400);
        return;
      }

      // กัน username ซ้ำ
      const existing = db
        .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
        .get(uname, userId);

      if (existing) {
        sendError(res, ThaiErrors.USERNAME_EXISTS, 409);
        return;
      }

      updates.push('username = ?');
      values.push(uname);
    }

    if (parsed.data.email !== undefined) {
      updates.push('email = ?');
      values.push(parsed.data.email); // string | null
    }

    if (parsed.data.role !== undefined) {
      updates.push('role = ?');
      values.push(parsed.data.role);
    }

    if (parsed.data.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(parsed.data.is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      sendError(res, 'ไม่มีข้อมูลที่จะอัปเดต', 400);
      return;
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");

    values.push(userId);

    // ✅ ดัก DB error ให้ชัด (ไม่ปล่อยเป็น 500 แบบมึน)
    try {
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    } catch (dbErr: any) {
      const msg = String(dbErr?.message || '');

      // ตัวอย่าง: email ซ้ำ
      if (
        dbErr?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
        dbErr?.code === 'SQLITE_CONSTRAINT'
      ) {
        if (msg.toLowerCase().includes('email')) {
          sendError(res, 'อีเมลนี้ถูกใช้งานแล้ว', 409);
          return;
        }
        if (msg.toLowerCase().includes('username')) {
          sendError(res, ThaiErrors.USERNAME_EXISTS, 409);
          return;
        }
      }

      console.error('DB error updating user:', dbErr);
      sendError(res, ThaiErrors.SERVER_ERROR, 500);
      return;
    }

    // ✅ จุดสำคัญ: อย่าอ้าง req.session แบบเสี่ยง throw
    const actorId = (req as any).session?.userId ?? null;

    // Audit (ต่อให้พัง ก็ไม่ทำให้ API พัง)
    try {
      logAudit({
        userId: actorId,
        action: AuditActions.USER_UPDATED,
        detail: { targetUserId: userId, targetUsername: user.username, updates: parsed.data },
      });
    } catch (auditErr) {
      console.warn('Audit log failed (ignored):', auditErr);
    }

    // ✅ ถ้าแก้ตัวเอง: sync username ใน session (กัน UI แสดงชื่อเก่า)
    try {
      if ((req as any)?.session?.userId === userId && parsed.data.username !== undefined) {
        (req as any).session.username = String(parsed.data.username).trim();
      }
    } catch {}

    sendSuccess(res, { message: 'อัปเดตผู้ใช้สำเร็จ' });
  } catch (error) {
    console.error('Error updating user:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});



/**
 * POST /api/admin/users/:id/roles
 * Update user role
 */
router.post('/:id/roles', (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    
    if (isNaN(userId)) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }
    
    const parsed = updateRoleSchema.safeParse(req.body);
    
    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }
    
    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?')
      .get(userId) as { id: number; username: string; role: UserRole } | undefined;
    
    if (!user) {
      sendError(res, ThaiErrors.USER_NOT_FOUND, 404);
      return;
    }

    // ✅ กัน admin แก้ superadmin
    if (denyIfTargetIsSuperadmin(user.role, req, res)) return;
    
    const oldRole = user.role;
    const newRole = parsed.data.role;
    
    db.prepare(`
      UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newRole, userId);
    
    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.ROLE_CHANGED,
      detail: { targetUserId: userId, targetUsername: user.username, oldRole, newRole },
    });
    
    sendSuccess(res, { message: `เปลี่ยนบทบาทเป็น ${newRole} สำเร็จ` });
  } catch (error) {
    console.error('Error updating role:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/admin/users/:id/project-access
 * Update user's project access
 */
router.post('/:id/project-access', (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    
    if (isNaN(userId)) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }
    
    const parsed = updateProjectAccessSchema.safeParse(req.body);
    
    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }
    
    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?')
      .get(userId) as { id: number; username: string; role: UserRole } | undefined;
    
    if (!user) {
      sendError(res, ThaiErrors.USER_NOT_FOUND, 404);
      return;
    }

    // ✅ กัน admin แก้ superadmin
    if (denyIfTargetIsSuperadmin(user.role, req, res)) return;
    
    const { project_ids } = parsed.data;
    
    // Use transaction
    const transaction = db.transaction(() => {
      // Get current access
      const currentAccess = db.prepare('SELECT project_id FROM user_project_access WHERE user_id = ?')
        .all(userId) as { project_id: number }[];
      const currentIds = currentAccess.map(a => a.project_id);
      
      // Determine additions and removals
      const toAdd = project_ids.filter(id => !currentIds.includes(id));
      const toRemove = currentIds.filter(id => !project_ids.includes(id));
      
      // Remove old access
      if (toRemove.length > 0) {
        const placeholders = toRemove.map(() => '?').join(',');
        db.prepare(`DELETE FROM user_project_access WHERE user_id = ? AND project_id IN (${placeholders})`)
          .run(userId, ...toRemove);
      }
      
      // Add new access
      const insertStmt = db.prepare('INSERT OR IGNORE INTO user_project_access (user_id, project_id) VALUES (?, ?)');
      for (const projectId of toAdd) {
        insertStmt.run(userId, projectId);
      }
      
      return { added: toAdd.length, removed: toRemove.length };
    });
    
    const result = transaction();
    
    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.PROJECT_ACCESS_GRANTED,
      detail: { targetUserId: userId, targetUsername: user.username, project_ids, ...result },
    });
    
    sendSuccess(res, { 
      message: 'อัปเดตสิทธิ์การเข้าถึงโปรเจกต์สำเร็จ',
      added: result.added,
      removed: result.removed,
    });
  } catch (error) {
    console.error('Error updating project access:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/admin/users/:id/activate
 * Enable or disable user
 */
router.post('/:id/activate', (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    
    if (isNaN(userId)) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }
    
    const parsed = activateUserSchema.safeParse(req.body);
    
    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }
    
    // Prevent self-deactivation
    if (userId === req.session.userId && !parsed.data.is_active) {
      sendError(res, 'ไม่สามารถปิดบัญชีตัวเองได้', 400);
      return;
    }
    
    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?')
      .get(userId) as { id: number; username: string; role: UserRole } | undefined;
    
    if (!user) {
      sendError(res, ThaiErrors.USER_NOT_FOUND, 404);
      return;
    }

    // ✅ กัน admin แก้ superadmin
    if (denyIfTargetIsSuperadmin(user.role, req, res)) return;
    
    db.prepare(`
      UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?
    `).run(parsed.data.is_active ? 1 : 0, userId);
    
    logAudit({
      userId: req.session.userId ?? null,
      action: parsed.data.is_active ? AuditActions.USER_ENABLED : AuditActions.USER_DISABLED,
      detail: { targetUserId: userId, targetUsername: user.username },
    });
    
    sendSuccess(res, { 
      message: parsed.data.is_active ? 'เปิดใช้งานบัญชีสำเร็จ' : 'ปิดใช้งานบัญชีสำเร็จ',
    });
  } catch (error) {
    console.error('Error activating user:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete user (soft delete by deactivating)
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    
    if (isNaN(userId)) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }
    
    // Prevent self-deletion
    if (userId === req.session.userId) {
      sendError(res, 'ไม่สามารถลบบัญชีตัวเองได้', 400);
      return;
    }
    
    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?')
      .get(userId) as { id: number; username: string; role: UserRole } | undefined;
    
    if (!user) {
      sendError(res, ThaiErrors.USER_NOT_FOUND, 404);
      return;
    }

    // ✅ กัน admin แก้ superadmin
    if (denyIfTargetIsSuperadmin(user.role, req, res)) return;
    
    // Soft delete (deactivate instead of hard delete)
    db.prepare(`
      UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?
    `).run(userId);
    
    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.USER_DISABLED,
      detail: { targetUserId: userId, targetUsername: user.username, reason: 'deleted' },
    });
    
    sendSuccess(res, { message: 'ลบผู้ใช้สำเร็จ' });
  } catch (error) {
    console.error('Error deleting user:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;
