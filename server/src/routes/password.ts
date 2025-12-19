/**
 * Password Management Routes
 * Change password, reset password
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { logAudit, AuditActions } from '../utils/audit.js';

const router = Router();
const SALT_ROUNDS = 12;

/**
 * Password strength checker
 */
function checkPasswordStrength(password: string): { score: number; feedback: string[] } {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else feedback.push('รหัสผ่านควรมีอย่างน้อย 8 ตัวอักษร');

  if (password.length >= 12) score += 1;

  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('ควรมีตัวอักษรพิมพ์เล็ก');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('ควรมีตัวอักษรพิมพ์ใหญ่');

  if (/[0-9]/.test(password)) score += 1;
  else feedback.push('ควรมีตัวเลข');

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
  else feedback.push('ควรมีอักขระพิเศษ');

  return { score, feedback };
}

/**
 * GET /api/password/strength
 * Check password strength
 */
router.post('/strength', (req: Request, res: Response) => {
  const { password } = req.body;

  if (!password) {
    sendError(res, 'กรุณาระบุรหัสผ่าน', 400);
    return;
  }

  const result = checkPasswordStrength(password);
  
  let level: string;
  if (result.score <= 2) level = 'weak';
  else if (result.score <= 4) level = 'medium';
  else level = 'strong';

  sendSuccess(res, {
    score: result.score,
    maxScore: 6,
    level,
    feedback: result.feedback,
  });
});

/**
 * POST /api/password/change
 * Change own password (authenticated user)
 */
router.post('/change', requireAuth, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      sendError(res, 'กรุณากรอกข้อมูลให้ครบ', 400);
      return;
    }

    if (newPassword !== confirmPassword) {
      sendError(res, 'รหัสผ่านใหม่ไม่ตรงกัน', 400);
      return;
    }

    if (newPassword.length < 6) {
      sendError(res, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร', 400);
      return;
    }

    // Get current user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId) as any;

    if (!user) {
      sendError(res, 'ไม่พบผู้ใช้', 404);
      return;
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      sendError(res, 'รหัสผ่านปัจจุบันไม่ถูกต้อง', 400);
      return;
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    db.prepare(`
      UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newHash, req.session.userId);

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.PASSWORD_CHANGED,
      detail: { username: user.username },
    });

    sendSuccess(res, { message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (error) {
    console.error('Error changing password:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/password/reset/:userId
 * Admin reset user password
 */
router.post('/reset/:userId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      sendError(res, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร', 400);
      return;
    }

    // Get target user
    const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;

    if (!targetUser) {
      sendError(res, 'ไม่พบผู้ใช้', 404);
      return;
    }

    // Prevent non-superadmin from resetting superadmin password
    if (targetUser.role === 'superadmin' && req.session.role !== 'superadmin') {
      sendError(res, 'ไม่มีสิทธิ์รีเซ็ตรหัสผ่าน Super Admin', 403);
      return;
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    db.prepare(`
      UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newHash, userId);

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.PASSWORD_RESET,
      detail: { targetUserId: userId, targetUsername: targetUser.username },
    });

    sendSuccess(res, { message: `รีเซ็ตรหัสผ่านของ ${targetUser.username} สำเร็จ` });
  } catch (error) {
    console.error('Error resetting password:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;
