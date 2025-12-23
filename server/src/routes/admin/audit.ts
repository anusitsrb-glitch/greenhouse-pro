/**
 * Audit Log Routes
 * View and export audit logs
 */

import { Router } from 'express';
import type { Request, Response, Router as ExpressRouter } from 'express';
import { db } from '../../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../../utils/response.js';
import { requireAdmin } from '../../middleware/auth.js';
import { z } from 'zod';

const router: ExpressRouter = Router();
router.use(requireAdmin);

// ============================================================
// Validation Schemas
// ============================================================

const auditQuerySchema = z.object({
  user_id: z.string().optional(),
  action: z.string().optional(),
  project_key: z.string().optional(),
  gh_key: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

// ============================================================
// Routes
// ============================================================

/**
 * GET /api/admin/audit
 * Get audit log entries with filters
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const parsed = auditQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const { user_id, action, project_key, gh_key, start_date, end_date, limit, offset } = parsed.data;

    // Build query
    let query = `
      SELECT 
        al.*,
        u.username,
        u.role as user_role
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (user_id) {
      query += ` AND al.user_id = ?`;
      params.push(parseInt(user_id, 10));
    }
    if (action) {
      query += ` AND al.action LIKE ?`;
      params.push(`%${action}%`);
    }
    if (project_key) {
      query += ` AND al.project_key = ?`;
      params.push(project_key);
    }
    if (gh_key) {
      query += ` AND al.gh_key = ?`;
      params.push(gh_key);
    }
    if (start_date) {
      query += ` AND al.created_at >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND al.created_at <= ?`;
      params.push(end_date);
    }

    query += ` ORDER BY al.created_at DESC`;

    // Pagination
    const limitNum = parseInt(limit || '100', 10);
    const offsetNum = parseInt(offset || '0', 10);
    query += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offsetNum);

    const logs = db.prepare(query).all(...params) as any[];

    // Parse detail_json (กัน JSON.parse ระเบิด)
    const logsWithParsedDetail = logs.map((log) => {
      let detail: any = {};
      try {
        detail = JSON.parse(log.detail_json || '{}');
      } catch {
        detail = {};
      }
      return { ...log, detail };
    });

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM audit_log al WHERE 1=1`;
    const countParams: any[] = [];

    if (user_id) { countQuery += ` AND al.user_id = ?`; countParams.push(parseInt(user_id, 10)); }
    if (action) { countQuery += ` AND al.action LIKE ?`; countParams.push(`%${action}%`); }
    if (project_key) { countQuery += ` AND al.project_key = ?`; countParams.push(project_key); }
    if (gh_key) { countQuery += ` AND al.gh_key = ?`; countParams.push(gh_key); }
    if (start_date) { countQuery += ` AND al.created_at >= ?`; countParams.push(start_date); }
    if (end_date) { countQuery += ` AND al.created_at <= ?`; countParams.push(end_date); }

    const row = db.prepare(countQuery).get(...countParams) as { total: number } | undefined;
    const total = row?.total ?? 0;

    sendSuccess(res, {
      logs: logsWithParsedDetail,
      pagination: { total, limit: limitNum, offset: offsetNum }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/admin/audit/actions
 * Get list of all unique actions for filtering
 */
router.get('/actions', (_req: Request, res: Response) => {
  try {
    const actions = db.prepare(`
      SELECT DISTINCT action FROM audit_log ORDER BY action
    `).all() as { action: string }[];

    sendSuccess(res, { actions: actions.map(a => a.action) });
  } catch (error) {
    console.error('Error fetching actions:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/admin/audit/stats
 * Get audit log statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const daysStr = typeof req.query.days === 'string' ? req.query.days : undefined;
    const daysNum = parseInt(daysStr || '7', 10) || 7;

    // ทำเป็น param ลดการต่อ string (ปลอดภัย/อ่านง่ายกว่า)
    const sinceModifier = `-${daysNum} days`;

    // Actions count
    const actionCounts = db.prepare(`
      SELECT action, COUNT(*) as count 
      FROM audit_log 
      WHERE created_at >= datetime('now', ?)
      GROUP BY action
      ORDER BY count DESC
      LIMIT 20
    `).all(sinceModifier) as { action: string; count: number }[];

    // User activity
    const userActivity = db.prepare(`
      SELECT 
        u.username,
        COUNT(*) as action_count
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.created_at >= datetime('now', ?)
      GROUP BY al.user_id
      ORDER BY action_count DESC
      LIMIT 10
    `).all(sinceModifier) as { username: string | null; action_count: number }[];

    // Daily activity
    const dailyActivity = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM audit_log
      WHERE created_at >= datetime('now', ?)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).all(sinceModifier) as { date: string; count: number }[];

    // Total count
    const totalRow = db.prepare(`
      SELECT COUNT(*) as total FROM audit_log
      WHERE created_at >= datetime('now', ?)
    `).get(sinceModifier) as { total: number } | undefined;

    sendSuccess(res, {
      stats: {
        total: totalRow?.total ?? 0,
        byAction: actionCounts,
        byUser: userActivity,
        daily: dailyActivity,
      }
    });
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/admin/audit/export
 * Export audit logs as CSV
 */
router.get('/export', (req: Request, res: Response) => {
  try {
    const start_date = typeof req.query.start_date === 'string' ? req.query.start_date : undefined;
    const end_date = typeof req.query.end_date === 'string' ? req.query.end_date : undefined;

    let query = `
      SELECT 
        al.id,
        al.created_at,
        u.username,
        al.action,
        al.project_key,
        al.gh_key,
        al.detail_json,
        al.ip_address
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (start_date) {
      query += ` AND al.created_at >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND al.created_at <= ?`;
      params.push(end_date);
    }

    query += ` ORDER BY al.created_at DESC LIMIT 10000`;

    const logs = db.prepare(query).all(...params) as any[];

    // Convert to CSV
    const headers = ['ID', 'Timestamp', 'Username', 'Action', 'Project', 'Greenhouse', 'Details', 'IP Address'];
    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const detailSafe = String(log.detail_json || '{}').replace(/"/g, '""');
      const row = [
        log.id,
        log.created_at,
        log.username || 'System',
        log.action,
        log.project_key || '',
        log.gh_key || '',
        `"${detailSafe}"`,
        log.ip_address || '',
      ];
      csvRows.push(row.join(','));
    }

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-log-${new Date().toISOString().split('T')[0]}.csv"`
    );
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8 support
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;

