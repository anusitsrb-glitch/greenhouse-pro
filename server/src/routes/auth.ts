import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { generateCsrfToken } from '../utils/crypto.js';
import { requireAuth, requireAdmin, validateCsrf } from '../middleware/auth.js';
import { logAudit, AuditActions } from '../utils/audit.js';
import { z } from 'zod';
import type { UserRole } from '../types/index.js';

const router = Router();

// ✅ กันพัง: สร้างตาราง users ขั้นต่ำให้แน่ใจว่า query ไม่ล้ม
function ensureUsersTable() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);
  } catch (e) {
    // ถ้าสร้างตารางไม่ได้จริง ๆ ให้ log ไว้ (แต่ไม่ throw เพื่อไม่ให้ route ล้มแบบเงียบ)
    console.error('[DB] ensureUsersTable failed:', e);
  }
}

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

const adminResetPasswordSchema = z.object({
  userId: z.number().int().positive(),
  newPassword: z.string().min(6),
});

/**
 * GET /api/auth/csrf
 * Get CSRF token
 */
router.get('/csrf', (req: Request, res: Response) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  sendSuccess(res, { csrfToken: req.session.csrfToken });
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    // ✅ กันพัง: ถ้า DB ยังไม่ init หรือเพิ่งสร้างไฟล์ใหม่ จะไม่เจอ "no such table"
    ensureUsersTable();

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 'กรุณากรอก Username และ Password', 400);
      return;
    }

    const { username, password } = parsed.data;

    // Find user
    const user = db.prepare(`
      SELECT id, username, password_hash, role, is_active
      FROM users WHERE username = ?
    `).get(username) as
      | { id: number; username: string; password_hash: string; role: UserRole; is_active: number }
      | undefined;

    if (!user) {
      logAudit({
        userId: null,
        action: AuditActions.LOGIN_FAILED,
        detail: { username, reason: 'User not found' },
      });
      sendError(res, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
      return;
    }

    // Check if user is active
    if (!user.is_active) {
      logAudit({
        userId: user.id,
        action: AuditActions.LOGIN_FAILED,
        detail: { reason: 'User disabled' },
      });
      sendError(res, 'บัญชีถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ', 401);
      return;
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      logAudit({
        userId: user.id,
        action: AuditActions.LOGIN_FAILED,
        detail: { reason: 'Invalid password' },
      });
      sendError(res, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
      return;
    }

    // Create session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.csrfToken = generateCsrfToken();

    // Update last login (ignore errors if column doesn't exist)
    try {
      db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
    } catch (e) {
      // Ignore - column might not exist in old databases
    }

    logAudit({
      userId: user.id,
      action: AuditActions.LOGIN_SUCCESS,
    });

    console.log(`[AUTH] User ${user.username} logged in with role: ${user.role}`);

    sendSuccess(res, {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      csrfToken: req.session.csrfToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', requireAuth, (req: Request, res: Response) => {
  const userId = req.session.userId;

  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      sendError(res, ThaiErrors.SERVER_ERROR, 500);
      return;
    }

    logAudit({
      userId: userId ?? null,
      action: AuditActions.LOGOUT,
    });

    res.clearCookie('greenhouse.sid');
    res.clearCookie('connect.sid');
    sendSuccess(res, { message: 'ออกจากระบบสำเร็จ' });
  });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', requireAuth, (req: Request, res: Response) => {
  // ✅ กันพัง: บางเคส DB ใหม่ / schema ยังไม่มา จะทำให้ route ล้ม
  ensureUsersTable();

  const user = db.prepare(`
    SELECT id, username, email, role, full_name, phone, language, theme, is_active, created_at
    FROM users WHERE id = ?
  `).get(req.session.userId) as any | undefined;

  if (!user) {
    sendError(res, ThaiErrors.USER_NOT_FOUND, 404);
    return;
  }

  console.log(`[AUTH] /me for user ${user.username}, role: ${user.role}`);

  sendSuccess(res, {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      role: user.role,
      language: user.language || 'th',
      theme: user.theme || 'light',
      isActive: Boolean(user.is_active),
      createdAt: user.created_at,
    },
  });
});

/**
 * POST /api/auth/change-password
 * Change own password
 */
router.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  try {
    ensureUsersTable();

    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 400);
      return;
    }

    const { currentPassword, newPassword } = parsed.data;

    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(req.session.userId) as { password_hash: string } | undefined;

    if (!user) {
      sendError(res, ThaiErrors.USER_NOT_FOUND, 404);
      return;
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      sendError(res, 'รหัสผ่านปัจจุบันไม่ถูกต้อง', 400);
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.session.userId);

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.PASSWORD_CHANGED,
    });

    sendSuccess(res, { message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (error) {
    console.error('Change password error:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/auth/admin-reset-password
 * Admin resets user password
 */
router.post('/admin-reset-password', requireAdmin, async (req: Request, res: Response) => {
  try {
    ensureUsersTable();

    const parsed = adminResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const { userId, newPassword } = parsed.data;

    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?')
      .get(userId) as { id: number; username: string; role: UserRole } | undefined;

    if (!user) {
      sendError(res, ThaiErrors.USER_NOT_FOUND, 404);
      return;
    }

    // Prevent admin from resetting superadmin password
    if (user.role === 'superadmin' && req.session.role !== 'superadmin') {
      sendError(res, 'ไม่สามารถรีเซ็ตรหัสผ่าน Super Admin ได้', 403);
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.PASSWORD_RESET,
      detail: { targetUserId: userId, targetUsername: user.username },
    });

    sendSuccess(res, { message: 'รีเซ็ตรหัสผ่านสำเร็จ' });
  } catch (error) {
    console.error('Admin reset password error:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;
