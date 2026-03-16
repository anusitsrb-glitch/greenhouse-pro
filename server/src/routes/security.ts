/**
 * Security Routes
 * Login history, session management, IP whitelist
 */

import { Router, Request, Response } from 'express';
import { query } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middleware/auth.js';

const router = Router();

// ============================================================
// Login History Routes
// ============================================================

router.get('/login-history', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { user_id, status, limit = '100', offset = '0' } = req.query;

    let sql = `
      SELECT lh.*, u.username
      FROM login_history lh
      LEFT JOIN users u ON lh.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (user_id) {
      sql += ` AND lh.user_id = $${idx++}`;
      params.push(user_id);
    }
    if (status) {
      sql += ` AND lh.status = $${idx++}`;
      params.push(status);
    }

    sql += ` ORDER BY lh.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const historyResult = await query(sql, params);
    const totalResult = await query('SELECT COUNT(*) as total FROM login_history', []);
    const total = parseInt(totalResult.rows[0].total);

    sendSuccess(res, {
      history: historyResult.rows,
      pagination: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) },
    });
  } catch (error) {
    console.error('Error fetching login history:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.get('/login-history/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { days = '7' } = req.query;
    const daysNum = parseInt(days as string);

    const countsResult = await query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
        COUNT(DISTINCT user_id) as unique_users
      FROM login_history
      WHERE created_at >= (NOW() - INTERVAL '${daysNum} days')::text
    `, []);
    const counts = countsResult.rows[0] as any;

    const byDayResult = await query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM login_history
      WHERE created_at >= (NOW() - INTERVAL '${daysNum} days')::text
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, []);

    sendSuccess(res, {
      stats: {
        totalLogins: counts.total,
        successfulLogins: counts.success,
        failedLogins: counts.failed,
        blockedAttempts: counts.blocked,
        uniqueUsers: counts.unique_users,
        byDay: byDayResult.rows,
      },
    });
  } catch (error) {
    console.error('Error fetching login stats:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// Session Management Routes
// ============================================================

router.get('/sessions', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    let sql = `
      SELECT us.*, u.username
      FROM user_sessions us
      LEFT JOIN users u ON us.user_id = u.id
      WHERE us.is_active = true AND us.expires_at > now()::text
    `;
    const params: any[] = [];

    if (user_id) {
      sql += ` AND us.user_id = $1`;
      params.push(user_id);
    }

    sql += ` ORDER BY us.last_activity_at DESC`;

    const result = await query(sql, params);
    sendSuccess(res, { sessions: result.rows });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.delete('/sessions/:sessionId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const sessionResult = await query('SELECT * FROM user_sessions WHERE id = $1', [sessionId]);
    const session = sessionResult.rows[0] as any;
    if (!session) { sendError(res, 'ไม่พบ Session', 404); return; }

    const userResult = await query('SELECT role FROM users WHERE id = $1', [session.user_id]);
    const sessionUser = userResult.rows[0] as any;
    if (sessionUser?.role === 'superadmin' && req.session.role !== 'superadmin') {
      sendError(res, 'ไม่มีสิทธิ์ยกเลิก Session ของ Super Admin', 403);
      return;
    }

    await query('UPDATE user_sessions SET is_active = false WHERE id = $1', [sessionId]);
    sendSuccess(res, { message: 'ยกเลิก Session สำเร็จ' });
  } catch (error) {
    console.error('Error terminating session:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.delete('/sessions/user/:userId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const targetResult = await query('SELECT role FROM users WHERE id = $1', [userId]);
    const targetUser = targetResult.rows[0] as any;
    if (targetUser?.role === 'superadmin' && req.session.role !== 'superadmin') {
      sendError(res, 'ไม่มีสิทธิ์ยกเลิก Session ของ Super Admin', 403);
      return;
    }

    const result = await query('UPDATE user_sessions SET is_active = false WHERE user_id = $1', [userId]);
    sendSuccess(res, { message: `ยกเลิก ${result.rowCount} Session สำเร็จ` });
  } catch (error) {
    console.error('Error terminating user sessions:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// IP Whitelist Routes
// ============================================================

router.get('/ip-whitelist', requireAdmin, async (req: Request, res: Response) => {
  try {
    const whitelistResult = await query(`
      SELECT iw.*, u.username as created_by_name
      FROM ip_whitelist iw
      LEFT JOIN users u ON iw.created_by = u.id
      ORDER BY iw.created_at DESC
    `, []);

    const settingResult = await query(`
      SELECT value FROM app_settings WHERE key = 'ip_whitelist_enabled'
    `, []);
    const enabled = settingResult.rows[0]?.value === 'true';

    sendSuccess(res, { enabled, whitelist: whitelistResult.rows });
  } catch (error) {
    console.error('Error fetching IP whitelist:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/ip-whitelist', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { ip_address, description } = req.body;

    if (!ip_address) { sendError(res, 'กรุณาระบุ IP Address', 400); return; }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipRegex.test(ip_address)) { sendError(res, 'รูปแบบ IP Address ไม่ถูกต้อง', 400); return; }

    const existing = await query('SELECT id FROM ip_whitelist WHERE ip_address = $1', [ip_address]);
    if (existing.rows.length > 0) { sendError(res, 'IP นี้มีอยู่แล้ว', 400); return; }

    const result = await query(`
      INSERT INTO ip_whitelist (ip_address, description, created_by)
      VALUES ($1, $2, $3) RETURNING id
    `, [ip_address, description || null, req.session.userId]);

    sendSuccess(res, { message: 'เพิ่ม IP สำเร็จ', id: result.rows[0].id });
  } catch (error) {
    console.error('Error adding IP:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.delete('/ip-whitelist/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM ip_whitelist WHERE id = $1', [id]);

    if (result.rowCount === 0) { sendError(res, 'ไม่พบ IP', 404); return; }
    sendSuccess(res, { message: 'ลบ IP สำเร็จ' });
  } catch (error) {
    console.error('Error removing IP:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.put('/ip-whitelist/toggle', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;

    await query(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('ip_whitelist_enabled', $1, now()::text)
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()::text
    `, [enabled ? 'true' : 'false']);

    sendSuccess(res, { message: enabled ? 'เปิดใช้งาน IP Whitelist' : 'ปิดใช้งาน IP Whitelist' });
  } catch (error) {
    console.error('Error toggling IP whitelist:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;