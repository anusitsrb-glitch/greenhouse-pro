import { Router, Request, Response } from 'express';
import { query } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { logAudit, AuditActions } from '../utils/audit.js';
import { z } from 'zod';

const router = Router();

const alertQuerySchema = z.object({
  project_key: z.string().optional(),
  gh_key: z.string().optional(),
  alert_type: z.enum(['threshold', 'offline', 'system', 'custom']).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  is_acknowledged: z.enum(['true', 'false']).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

const createAlertSchema = z.object({
  greenhouse_id: z.number(),
  alert_type: z.enum(['threshold', 'offline', 'system', 'custom']),
  severity: z.enum(['info', 'warning', 'critical']),
  sensor_key: z.string().optional(),
  sensor_name: z.string().optional(),
  current_value: z.number().optional(),
  threshold_value: z.number().optional(),
  direction: z.enum(['above', 'below']).optional(),
  message: z.string(),
});

async function hasProjectAccess(userId: number, userRole: string, projectKey?: string): Promise<boolean> {
  if (userRole === 'admin' || userRole === 'superadmin') return true;
  if (!projectKey) return false;
  const result = await query(`
    SELECT 1 FROM user_project_access upa
    JOIN projects p ON upa.project_id = p.id
    WHERE upa.user_id = $1 AND p.key = $2
  `, [userId, projectKey]);
  return result.rows.length > 0;
}

// GET /api/alerts
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = alertQuerySchema.safeParse(req.query);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const { project_key, gh_key, alert_type, severity, is_acknowledged, start_date, end_date, limit, offset } = parsed.data;
    const limitNum = parseInt(limit || '50');
    const offsetNum = parseInt(offset || '0');

    let sql = `
      SELECT ah.*, g.gh_key, g.name_th as greenhouse_name,
        p.key as project_key, p.name_th as project_name,
        u.username as acknowledged_by_name
      FROM alert_history ah
      JOIN greenhouses g ON ah.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      LEFT JOIN users u ON ah.acknowledged_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (req.session.role !== 'admin' && req.session.role !== 'superadmin') {
      sql += ` AND p.id IN (SELECT project_id FROM user_project_access WHERE user_id = $${idx++})`;
      params.push(req.session.userId);
    }
    if (project_key) { sql += ` AND p.key = $${idx++}`; params.push(project_key); }
    if (gh_key) { sql += ` AND g.gh_key = $${idx++}`; params.push(gh_key); }
    if (alert_type) { sql += ` AND ah.alert_type = $${idx++}`; params.push(alert_type); }
    if (severity) { sql += ` AND ah.severity = $${idx++}`; params.push(severity); }
    if (is_acknowledged !== undefined) { sql += ` AND ah.is_acknowledged = $${idx++}`; params.push(is_acknowledged === 'true' ? 1 : 0); }
    if (start_date) { sql += ` AND ah.created_at >= $${idx++}`; params.push(start_date); }
    if (end_date) { sql += ` AND ah.created_at <= $${idx++}`; params.push(end_date); }

    sql += ` ORDER BY ah.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limitNum, offsetNum);

    // Count query
    let countSql = `
      SELECT COUNT(*) as total FROM alert_history ah
      JOIN greenhouses g ON ah.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE 1=1
    `;
    const countParams: any[] = [];
    let cidx = 1;

    if (req.session.role !== 'admin' && req.session.role !== 'superadmin') {
      countSql += ` AND p.id IN (SELECT project_id FROM user_project_access WHERE user_id = $${cidx++})`;
      countParams.push(req.session.userId);
    }
    if (project_key) { countSql += ` AND p.key = $${cidx++}`; countParams.push(project_key); }
    if (gh_key) { countSql += ` AND g.gh_key = $${cidx++}`; countParams.push(gh_key); }
    if (alert_type) { countSql += ` AND ah.alert_type = $${cidx++}`; countParams.push(alert_type); }
    if (severity) { countSql += ` AND ah.severity = $${cidx++}`; countParams.push(severity); }
    if (is_acknowledged !== undefined) { countSql += ` AND ah.is_acknowledged = $${cidx++}`; countParams.push(is_acknowledged === 'true' ? 1 : 0); }

    const [result, countResult] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    const total = parseInt(countResult.rows[0]?.total ?? '0');

    sendSuccess(res, { alerts: result.rows, pagination: { total, limit: limitNum, offset: offsetNum } });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// POST /api/alerts
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = createAlertSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const d = parsed.data;
    const result = await query(`
      INSERT INTO alert_history (greenhouse_id, alert_type, severity, sensor_key, sensor_name, current_value, threshold_value, direction, message)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
    `, [d.greenhouse_id, d.alert_type, d.severity, d.sensor_key || null, d.sensor_name || null, d.current_value ?? null, d.threshold_value ?? null, d.direction || null, d.message]);

    sendSuccess(res, { message: 'สร้าง Alert สำเร็จ', alert: { id: result.rows[0].id } });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// PUT /api/alerts/acknowledge-all
router.put('/acknowledge-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const { project_key, gh_key } = req.query;
    let sql = `
      UPDATE alert_history SET is_acknowledged = 1, acknowledged_by = $1, acknowledged_at = now()::text
      WHERE is_acknowledged = 0 AND greenhouse_id IN (
        SELECT g.id FROM greenhouses g JOIN projects p ON g.project_id = p.id WHERE 1=1
    `;
    const params: any[] = [req.session.userId];
    let idx = 2;

    if (req.session.role !== 'admin' && req.session.role !== 'superadmin') {
      sql += ` AND p.id IN (SELECT project_id FROM user_project_access WHERE user_id = $${idx++})`;
      params.push(req.session.userId);
    }
    if (project_key) { sql += ` AND p.key = $${idx++}`; params.push(project_key); }
    if (gh_key) { sql += ` AND g.gh_key = $${idx++}`; params.push(gh_key); }
    sql += `)`;

    const result = await query(sql, params);
    logAudit({ userId: req.session.userId ?? null, action: AuditActions.ALERTS_ACKNOWLEDGED_ALL, detail: { count: result.rowCount, project_key, gh_key } });
    sendSuccess(res, { message: `รับทราบ ${result.rowCount} Alert สำเร็จ` });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// PUT /api/alerts/:id/acknowledge
router.put('/:id/acknowledge', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const alertRes = await query(`
      SELECT ah.*, p.key as project_key FROM alert_history ah
      JOIN greenhouses g ON ah.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE ah.id = $1
    `, [id]);
    const alert = alertRes.rows[0];
    if (!alert) { sendError(res, 'ไม่พบ Alert', 404); return; }
    if (!await hasProjectAccess(req.session.userId!, req.session.role!, alert.project_key)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403); return;
    }

    await query(`UPDATE alert_history SET is_acknowledged = 1, acknowledged_by = $1, acknowledged_at = now()::text WHERE id = $2`, [req.session.userId, id]);
    logAudit({ userId: req.session.userId ?? null, action: AuditActions.ALERT_ACKNOWLEDGED, projectKey: alert.project_key, detail: { alertId: id } });
    sendSuccess(res, { message: 'รับทราบ Alert สำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// GET /api/alerts/stats
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, days } = req.query;
    const daysNum = parseInt(days as string) || 7;

    let where = `WHERE ah.created_at::timestamp >= NOW() - INTERVAL '${daysNum} days'`;
    const params: any[] = [];
    let idx = 1;

    if (req.session.role !== 'admin' && req.session.role !== 'superadmin') {
      where += ` AND p.id IN (SELECT project_id FROM user_project_access WHERE user_id = $${idx++})`;
      params.push(req.session.userId);
    }
    if (project_key) { where += ` AND p.key = $${idx++}`; params.push(project_key); }
    if (gh_key) { where += ` AND g.gh_key = $${idx++}`; params.push(gh_key); }

    const baseJoin = `FROM alert_history ah JOIN greenhouses g ON ah.greenhouse_id = g.id JOIN projects p ON g.project_id = p.id`;

    const [severityRes, typeRes, unackRes, trendRes] = await Promise.all([
      query(`SELECT severity, COUNT(*) as count ${baseJoin} ${where} GROUP BY severity`, params),
      query(`SELECT alert_type, COUNT(*) as count ${baseJoin} ${where} GROUP BY alert_type`, params),
      query(`SELECT COUNT(*) as unacknowledged ${baseJoin} ${where} AND ah.is_acknowledged = 0`, params),
      query(`SELECT DATE(ah.created_at::timestamp) as date, COUNT(*) as count ${baseJoin} ${where} GROUP BY DATE(ah.created_at::timestamp) ORDER BY date DESC LIMIT ${daysNum}`, params),
    ]);

    sendSuccess(res, {
      stats: {
        bySeverity: Object.fromEntries(severityRes.rows.map((s: any) => [s.severity, parseInt(s.count)])),
        byType: Object.fromEntries(typeRes.rows.map((t: any) => [t.alert_type, parseInt(t.count)])),
        unacknowledged: parseInt(unackRes.rows[0]?.unacknowledged ?? '0'),
        dailyTrend: trendRes.rows,
      }
    });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;