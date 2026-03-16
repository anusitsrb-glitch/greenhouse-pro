import { Router } from 'express';
import type { Request, Response, Router as ExpressRouter } from 'express';
import { query } from '../../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../../utils/response.js';
import { requireAdmin } from '../../middleware/auth.js';
import { z } from 'zod';

const router: ExpressRouter = Router();
router.use(requireAdmin);

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

// GET /api/admin/audit
router.get('/', async (req: Request, res: Response) => {
  try {
    const parsed = auditQuerySchema.safeParse(req.query);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const { user_id, action, project_key, gh_key, start_date, end_date, limit, offset } = parsed.data;
    const limitNum = parseInt(limit || '100', 10);
    const offsetNum = parseInt(offset || '0', 10);

    let sql = `
      SELECT al.*, u.username, u.role as user_role
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (user_id) { sql += ` AND al.user_id = $${idx++}`; params.push(parseInt(user_id, 10)); }
    if (action) { sql += ` AND al.action ILIKE $${idx++}`; params.push(`%${action}%`); }
    if (project_key) { sql += ` AND al.project_key = $${idx++}`; params.push(project_key); }
    if (gh_key) { sql += ` AND al.gh_key = $${idx++}`; params.push(gh_key); }
    if (start_date) { sql += ` AND al.created_at >= $${idx++}`; params.push(start_date); }
    if (end_date) { sql += ` AND al.created_at <= $${idx++}`; params.push(end_date); }

    sql += ` ORDER BY al.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limitNum, offsetNum);

    const result = await query(sql, params);
    const logs = result.rows.map((log: any) => {
      let detail: any = {};
      try { detail = JSON.parse(log.detail_json || '{}'); } catch {}
      return { ...log, detail };
    });

    // Count query
    let countSql = `SELECT COUNT(*) as total FROM audit_log al WHERE 1=1`;
    const countParams: any[] = [];
    let cidx = 1;
    if (user_id) { countSql += ` AND al.user_id = $${cidx++}`; countParams.push(parseInt(user_id, 10)); }
    if (action) { countSql += ` AND al.action ILIKE $${cidx++}`; countParams.push(`%${action}%`); }
    if (project_key) { countSql += ` AND al.project_key = $${cidx++}`; countParams.push(project_key); }
    if (gh_key) { countSql += ` AND al.gh_key = $${cidx++}`; countParams.push(gh_key); }
    if (start_date) { countSql += ` AND al.created_at >= $${cidx++}`; countParams.push(start_date); }
    if (end_date) { countSql += ` AND al.created_at <= $${cidx++}`; countParams.push(end_date); }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0]?.total ?? '0');

    sendSuccess(res, { logs, pagination: { total, limit: limitNum, offset: offsetNum } });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// GET /api/admin/audit/actions
router.get('/actions', async (_req: Request, res: Response) => {
  try {
    const result = await query(`SELECT DISTINCT action FROM audit_log ORDER BY action`);
    sendSuccess(res, { actions: result.rows.map((a: any) => a.action) });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// GET /api/admin/audit/stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const daysNum = parseInt(typeof req.query.days === 'string' ? req.query.days : '7', 10) || 7;

    const actionCounts = await query(`
      SELECT action, COUNT(*) as count
      FROM audit_log
      WHERE created_at >= (NOW() - INTERVAL '${daysNum} days')::text
      GROUP BY action ORDER BY count DESC LIMIT 20
    `);

    const userActivity = await query(`
      SELECT u.username, COUNT(*) as action_count
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.created_at >= (NOW() - INTERVAL '${daysNum} days')::text
      GROUP BY al.user_id, u.username
      ORDER BY action_count DESC LIMIT 10
    `);

    const dailyActivity = await query(`
      SELECT DATE(created_at::timestamp) as date, COUNT(*) as count
      FROM audit_log
      WHERE created_at >= (NOW() - INTERVAL '${daysNum} days')::text
      GROUP BY DATE(created_at::timestamp)
      ORDER BY date DESC
    `);

    const totalResult = await query(`
      SELECT COUNT(*) as total FROM audit_log
      WHERE created_at >= (NOW() - INTERVAL '${daysNum} days')::text
    `);

    sendSuccess(res, {
      stats: {
        total: parseInt(totalResult.rows[0]?.total ?? '0'),
        byAction: actionCounts.rows,
        byUser: userActivity.rows,
        daily: dailyActivity.rows,
      }
    });
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// GET /api/admin/audit/export
router.get('/export', async (req: Request, res: Response) => {
  try {
    const start_date = typeof req.query.start_date === 'string' ? req.query.start_date : undefined;
    const end_date = typeof req.query.end_date === 'string' ? req.query.end_date : undefined;

    let sql = `
      SELECT al.id, al.created_at, u.username, al.action,
        al.project_key, al.gh_key, al.detail_json, al.ip_address
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (start_date) { sql += ` AND al.created_at >= $${idx++}`; params.push(start_date); }
    if (end_date) { sql += ` AND al.created_at <= $${idx++}`; params.push(end_date); }
    sql += ` ORDER BY al.created_at DESC LIMIT 10000`;

    const result = await query(sql, params);
    const headers = ['ID', 'Timestamp', 'Username', 'Action', 'Project', 'Greenhouse', 'Details', 'IP Address'];
    const csvRows = [headers.join(',')];

    for (const log of result.rows) {
      const detailSafe = String(log.detail_json || '{}').replace(/"/g, '""');
      csvRows.push([
        log.id, log.created_at, log.username || 'System',
        log.action, log.project_key || '', log.gh_key || '',
        `"${detailSafe}"`, log.ip_address || '',
      ].join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\uFEFF' + csvRows.join('\n'));
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;