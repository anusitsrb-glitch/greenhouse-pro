import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { generateCsrfToken } from '../utils/crypto.js';
import { requireAuth, requireAdmin, validateCsrf } from '../middleware/auth.js';
import { logAudit, AuditActions } from '../utils/audit.js';
import { z } from 'zod';
import type { UserRole } from '../types/index.js';

const router = Router();

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

router.get('/csrf', (req: Request, res: Response) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  sendSuccess(res, { csrfToken: req.session.csrfToken });
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 'กรุณากรอก Username และ Password', 400);
      return;
    }
    const { username, password } = parsed.data;

    const result = await query(
      `SELECT id, username, password_hash, role, is_active, language, theme FROM users WHERE username = $1`,
      [username]
    );
    const user = result.rows[0] as {
      id: number; username: string; password_hash: string;
      role: UserRole; is_active: number; language?: string; theme?: string;
    } | undefined;

    if (!user) {
      logAudit({ userId: null, action: AuditActions.LOGIN_FAILED, detail: { username, reason: 'User not found' } });
      sendError(res, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
      return;
    }

    if (!user.is_active) {
      logAudit({ userId: user.id, action: AuditActions.LOGIN_FAILED, detail: { reason: 'User disabled' } });
      sendError(res, 'บัญชีถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ', 401);
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      logAudit({ userId: user.id, action: AuditActions.LOGIN_FAILED, detail: { reason: 'Invalid password' } });
      sendError(res, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
      return;
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.csrfToken = generateCsrfToken();

    try {
      await query(`UPDATE users SET last_login_at = now()::text WHERE id = $1`, [user.id]);
    } catch (e) {}

    logAudit({ userId: user.id, action: AuditActions.LOGIN_SUCCESS });
    console.log(`[AUTH] User ${user.username} logged in with role: ${user.role}`);

    sendSuccess(res, {
      user: {
        id: user.id, username: user.username, role: user.role,
        language: user.language || 'th', theme: user.theme || 'light',
      },
      csrfToken: req.session.csrfToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/logout', requireAuth, (req: Request, res: Response) => {
  const userId = req.session.userId;
  req.session.destroy((err) => {
    if (err) {
      sendError(res, ThaiErrors.SERVER_ERROR, 500);
      return;
    }
    logAudit({ userId: userId ?? null, action: AuditActions.LOGOUT });
    res.clearCookie('greenhouse.sid');
    res.clearCookie('connect.sid');
    sendSuccess(res, { message: 'ออกจากระบบสำเร็จ' });
  });
});

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, username, email, role, phone, language, theme, is_active, created_at FROM users WHERE id = $1`,
      [req.session.userId]
    );
    const user = result.rows[0];
    if (!user) {
      sendError(res, ThaiErrors.USER_NOT_FOUND, 404);
      return;
    }
    sendSuccess(res, {
      user: {
        id: user.id, username: user.username, email: user.email,
        fullName: null, phone: user.phone, role: user.role,
        language: user.language || 'th', theme: user.theme || 'light',
        isActive: Boolean(user.is_active), createdAt: user.created_at,
      },
    });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/change-password', requireAuth, validateCsrf, async (req: Request, res: Response) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 400);
      return;
    }
    const { currentPassword, newPassword } = parsed.data;
    const result = await query(`SELECT password_hash FROM users WHERE id = $1`, [req.session.userId]);
    const user = result.rows[0];
    if (!user) { sendError(res, ThaiErrors.USER_NOT_FOUND, 404); return; }

    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) { sendError(res, 'รหัสผ่านปัจจุบันไม่ถูกต้อง', 400); return; }

    const newHash = await bcrypt.hash(newPassword, 12);
    await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, req.session.userId]);
    logAudit({ userId: req.session.userId ?? null, action: AuditActions.PASSWORD_CHANGED });
    sendSuccess(res, { message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/admin-reset-password', requireAdmin, validateCsrf, async (req: Request, res: Response) => {
  try {
    const parsed = adminResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const { userId, newPassword } = parsed.data;
    const result = await query(`SELECT id, username, role FROM users WHERE id = $1`, [userId]);
    const user = result.rows[0];
    if (!user) { sendError(res, ThaiErrors.USER_NOT_FOUND, 404); return; }

    if (user.role === 'superadmin' && req.session.role !== 'superadmin') {
      sendError(res, 'ไม่สามารถรีเซ็ตรหัสผ่าน Super Admin ได้', 403);
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, userId]);
    logAudit({ userId: req.session.userId ?? null, action: AuditActions.PASSWORD_RESET, detail: { targetUserId: userId, targetUsername: user.username } });
    sendSuccess(res, { message: 'รีเซ็ตรหัสผ่านสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.put('/preferences', requireAuth, validateCsrf, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) { sendError(res, 'กรุณาเข้าสู่ระบบใหม่', 401); return; }

    const { language, theme } = req.body as { language?: string; theme?: string };
    const lang = String(language || 'th');
    const thm = String(theme || 'light');

    if (!['th', 'en', 'mm'].includes(lang)) { sendError(res, 'ภาษาที่เลือกไม่ถูกต้อง', 400); return; }
    if (!['light', 'dark', 'system'].includes(thm)) { sendError(res, 'ธีมไม่ถูกต้อง', 400); return; }

    await query(`UPDATE users SET language = $1, theme = $2, updated_at = now()::text WHERE id = $3`, [lang, thm, userId]);

    const result = await query(
      `SELECT id, username, email, role, phone, language, theme, is_active, created_at FROM users WHERE id = $1`,
      [userId]
    );
    const user = result.rows[0];
    sendSuccess(res, {
      user: {
        id: user.id, username: user.username, email: user.email,
        fullName: null, phone: user.phone, role: user.role,
        language: user.language || 'th', theme: user.theme || 'light',
        isActive: Boolean(user.is_active), createdAt: user.created_at,
      },
    });
  } catch (err) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;