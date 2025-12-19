/**
 * Security Routes
 * Login history, session management, IP whitelist
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middleware/auth.js';

const router = Router();

// ============================================================
// Login History Routes (Admin only)
// ============================================================

/**
 * GET /api/security/login-history
 * Get login history
 */
router.get('/login-history', requireAdmin, (req: Request, res: Response) => {
  try {
    const { user_id, status, limit = '100', offset = '0' } = req.query;

    let query = `
      SELECT 
        lh.*,
        u.username
      FROM login_history lh
      LEFT JOIN users u ON lh.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (user_id) {
      query += ` AND lh.user_id = ?`;
      params.push(user_id);
    }
    if (status) {
      query += ` AND lh.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY lh.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const history = db.prepare(query).all(...params);

    const { total } = db.prepare(`
      SELECT COUNT(*) as total FROM login_history
    `).get() as { total: number };

    sendSuccess(res, {
      history,
      pagination: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) },
    });
  } catch (error) {
    console.error('Error fetching login history:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/security/login-history/stats
 * Get login statistics
 */
router.get('/login-history/stats', requireAdmin, (req: Request, res: Response) => {
  try {
    const { days = '7' } = req.query;

    const stats = {
      totalLogins: 0,
      successfulLogins: 0,
      failedLogins: 0,
      blockedAttempts: 0,
      uniqueUsers: 0,
      byDay: [] as any[],
    };

    const daysNum = parseInt(days as string);

    // Total counts
    const counts = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
        COUNT(DISTINCT user_id) as unique_users
      FROM login_history
      WHERE created_at >= datetime('now', '-${daysNum} days')
    `).get() as any;

    stats.totalLogins = counts.total;
    stats.successfulLogins = counts.success;
    stats.failedLogins = counts.failed;
    stats.blockedAttempts = counts.blocked;
    stats.uniqueUsers = counts.unique_users;

    // By day
    stats.byDay = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM login_history
      WHERE created_at >= datetime('now', '-${daysNum} days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).all() as any[];

    sendSuccess(res, { stats });
  } catch (error) {
    console.error('Error fetching login stats:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// Session Management Routes (Admin only)
// ============================================================

/**
 * GET /api/security/sessions
 * Get active sessions
 */
router.get('/sessions', requireAdmin, (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    let query = `
      SELECT 
        us.*,
        u.username
      FROM user_sessions us
      LEFT JOIN users u ON us.user_id = u.id
      WHERE us.is_active = 1 AND us.expires_at > datetime('now')
    `;
    const params: any[] = [];

    if (user_id) {
      query += ` AND us.user_id = ?`;
      params.push(user_id);
    }

    query += ` ORDER BY us.last_activity_at DESC`;

    const sessions = db.prepare(query).all(...params);

    sendSuccess(res, { sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * DELETE /api/security/sessions/:sessionId
 * Terminate a specific session
 */
router.delete('/sessions/:sessionId', requireAdmin, (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(sessionId) as any;

    if (!session) {
      sendError(res, 'ไม่พบ Session', 404);
      return;
    }

    // Prevent terminating superadmin session unless you are superadmin
    const sessionUser = db.prepare('SELECT role FROM users WHERE id = ?').get(session.user_id) as any;
    if (sessionUser?.role === 'superadmin' && req.session.role !== 'superadmin') {
      sendError(res, 'ไม่มีสิทธิ์ยกเลิก Session ของ Super Admin', 403);
      return;
    }

    db.prepare('UPDATE user_sessions SET is_active = 0 WHERE id = ?').run(sessionId);

    sendSuccess(res, { message: 'ยกเลิก Session สำเร็จ' });
  } catch (error) {
    console.error('Error terminating session:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * DELETE /api/security/sessions/user/:userId
 * Terminate all sessions for a user
 */
router.delete('/sessions/user/:userId', requireAdmin, (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Prevent terminating superadmin sessions unless you are superadmin
    const targetUser = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
    if (targetUser?.role === 'superadmin' && req.session.role !== 'superadmin') {
      sendError(res, 'ไม่มีสิทธิ์ยกเลิก Session ของ Super Admin', 403);
      return;
    }

    const result = db.prepare('UPDATE user_sessions SET is_active = 0 WHERE user_id = ?').run(userId);

    sendSuccess(res, { message: `ยกเลิก ${result.changes} Session สำเร็จ` });
  } catch (error) {
    console.error('Error terminating user sessions:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// IP Whitelist Routes (Admin only)
// ============================================================

/**
 * GET /api/security/ip-whitelist
 * Get IP whitelist
 */
router.get('/ip-whitelist', requireAdmin, (req: Request, res: Response) => {
  try {
    const whitelist = db.prepare(`
      SELECT iw.*, u.username as created_by_name
      FROM ip_whitelist iw
      LEFT JOIN users u ON iw.created_by = u.id
      ORDER BY iw.created_at DESC
    `).all();

    const { value: enabled } = db.prepare(`
      SELECT value FROM app_settings WHERE key = 'ip_whitelist_enabled'
    `).get() as { value: string } || { value: 'false' };

    sendSuccess(res, {
      enabled: enabled === 'true',
      whitelist,
    });
  } catch (error) {
    console.error('Error fetching IP whitelist:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/security/ip-whitelist
 * Add IP to whitelist
 */
router.post('/ip-whitelist', requireAdmin, (req: Request, res: Response) => {
  try {
    const { ip_address, description } = req.body;

    if (!ip_address) {
      sendError(res, 'กรุณาระบุ IP Address', 400);
      return;
    }

    // Validate IP format (basic check)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipRegex.test(ip_address)) {
      sendError(res, 'รูปแบบ IP Address ไม่ถูกต้อง', 400);
      return;
    }

    const existing = db.prepare('SELECT id FROM ip_whitelist WHERE ip_address = ?').get(ip_address);
    if (existing) {
      sendError(res, 'IP นี้มีอยู่แล้ว', 400);
      return;
    }

    const result = db.prepare(`
      INSERT INTO ip_whitelist (ip_address, description, created_by)
      VALUES (?, ?, ?)
    `).run(ip_address, description || null, req.session.userId);

    sendSuccess(res, {
      message: 'เพิ่ม IP สำเร็จ',
      id: result.lastInsertRowid,
    });
  } catch (error) {
    console.error('Error adding IP:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * DELETE /api/security/ip-whitelist/:id
 * Remove IP from whitelist
 */
router.delete('/ip-whitelist/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = db.prepare('DELETE FROM ip_whitelist WHERE id = ?').run(id);

    if (result.changes === 0) {
      sendError(res, 'ไม่พบ IP', 404);
      return;
    }

    sendSuccess(res, { message: 'ลบ IP สำเร็จ' });
  } catch (error) {
    console.error('Error removing IP:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * PUT /api/security/ip-whitelist/toggle
 * Enable/disable IP whitelist
 */
router.put('/ip-whitelist/toggle', requireAdmin, (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;

    db.prepare(`
      INSERT OR REPLACE INTO app_settings (key, value, updated_at)
      VALUES ('ip_whitelist_enabled', ?, datetime('now'))
    `).run(enabled ? 'true' : 'false');

    sendSuccess(res, {
      message: enabled ? 'เปิดใช้งาน IP Whitelist' : 'ปิดใช้งาน IP Whitelist',
    });
  } catch (error) {
    console.error('Error toggling IP whitelist:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;
