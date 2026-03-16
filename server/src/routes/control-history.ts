import { Router, Request, Response } from 'express';
import { query } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

const controlHistoryQuerySchema = z.object({
  project_key: z.string().optional(),
  gh_key: z.string().optional(),
  source: z.enum(['manual', 'automation', 'schedule', 'scene', 'external_api']).optional(),
  user_id: z.string().optional(),
  control_key: z.string().optional(),
  success: z.enum(['true', 'false']).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
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

// GET /api/control-history
router.get('/', async (req: Request, res: Response) => {
  try {
    const parsed = controlHistoryQuerySchema.safeParse(req.query);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const { project_key, gh_key, source, user_id, control_key, success, start_date, end_date, limit, offset } = parsed.data;
    const limitNum = parseInt(limit || '100');
    const offsetNum = parseInt(offset || '0');

    let sql = `
      SELECT ch.*, g.gh_key, g.name_th as greenhouse_name,
        p.key as project_key, p.name_th as project_name,
        u.username as user_name, u.full_name as user_full_name
      FROM control_history ch
      JOIN greenhouses g ON ch.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      LEFT JOIN users u ON ch.user_id = u.id
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
    if (source) { sql += ` AND ch.source = $${idx++}`; params.push(source); }
    if (user_id) { sql += ` AND ch.user_id = $${idx++}`; params.push(parseInt(user_id)); }
    if (control_key) { sql += ` AND ch.control_key = $${idx++}`; params.push(control_key); }
    if (success !== undefined) { sql += ` AND ch.success = $${idx++}`; params.push(success === 'true' ? 1 : 0); }
    if (start_date) { sql += ` AND ch.created_at >= $${idx++}`; params.push(start_date); }
    if (end_date) { sql += ` AND ch.created_at <= $${idx++}`; params.push(end_date); }

    sql += ` ORDER BY ch.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limitNum, offsetNum);

    // Count
    let countSql = `
      SELECT COUNT(*) as total FROM control_history ch
      JOIN greenhouses g ON ch.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id WHERE 1=1
    `;
    const countParams: any[] = [];
    let cidx = 1;

    if (req.session.role !== 'admin' && req.session.role !== 'superadmin') {
      countSql += ` AND p.id IN (SELECT project_id FROM user_project_access WHERE user_id = $${cidx++})`;
      countParams.push(req.session.userId);
    }
    if (project_key) { countSql += ` AND p.key = $${cidx++}`; countParams.push(project_key); }
    if (gh_key) { countSql += ` AND g.gh_key = $${cidx++}`; countParams.push(gh_key); }
    if (source) { countSql += ` AND ch.source = $${cidx++}`; countParams.push(source); }
    if (user_id) { countSql += ` AND ch.user_id = $${cidx++}`; countParams.push(parseInt(user_id)); }
    if (control_key) { countSql += ` AND ch.control_key = $${cidx++}`; countParams.push(control_key); }
    if (success !== undefined) { countSql += ` AND ch.success = $${cidx++}`; countParams.push(success === 'true' ? 1 : 0); }
    if (start_date) { countSql += ` AND ch.created_at >= $${cidx++}`; countParams.push(start_date); }
    if (end_date) { countSql += ` AND ch.created_at <= $${cidx++}`; countParams.push(end_date); }

    const [result, countResult] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    const parsedHistory = result.rows.map((h: any) => ({ ...h, success: Boolean(h.success) }));

    sendSuccess(res, { history: parsedHistory, pagination: { total: parseInt(countResult.rows[0]?.total ?? '0'), limit: limitNum, offset: offsetNum } });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// GET /api/control-history/stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, days } = req.query;
    const daysNum = parseInt(days as string) || 30;

    let where = `WHERE ch.created_at::timestamp >= NOW() - INTERVAL '${daysNum} days'`;
    const params: any[] = [];
    let idx = 1;

    if (req.session.role !== 'admin' && req.session.role !== 'superadmin') {
      where += ` AND p.id IN (SELECT project_id FROM user_project_access WHERE user_id = $${idx++})`;
      params.push(req.session.userId);
    }
    if (project_key) { where += ` AND p.key = $${idx++}`; params.push(project_key); }
    if (gh_key) { where += ` AND g.gh_key = $${idx++}`; params.push(gh_key); }

    const baseJoin = `FROM control_history ch JOIN greenhouses g ON ch.greenhouse_id = g.id JOIN projects p ON g.project_id = p.id`;

    const [sourceRes, successRes, usersRes, trendRes, devicesRes] = await Promise.all([
      query(`SELECT source, COUNT(*) as count ${baseJoin} ${where} GROUP BY source`, params),
      query(`SELECT SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count, SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failure_count ${baseJoin} ${where}`, params),
      query(`SELECT u.username, u.full_name, COUNT(*) as count ${baseJoin} LEFT JOIN users u ON ch.user_id = u.id ${where} AND ch.user_id IS NOT NULL GROUP BY ch.user_id, u.username, u.full_name ORDER BY count DESC LIMIT 10`, params),
      query(`SELECT DATE(ch.created_at::timestamp) as date, COUNT(*) as count, SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count ${baseJoin} ${where} GROUP BY DATE(ch.created_at::timestamp) ORDER BY date DESC LIMIT ${daysNum}`, params),
      query(`SELECT ch.control_key, ch.control_name, g.name_th as greenhouse_name, COUNT(*) as count ${baseJoin} ${where} GROUP BY ch.control_key, ch.control_name, g.name_th ORDER BY count DESC LIMIT 10`, params),
    ]);

    sendSuccess(res, {
      stats: {
        bySource: Object.fromEntries(sourceRes.rows.map((s: any) => [s.source, parseInt(s.count)])),
        successCount: parseInt(successRes.rows[0]?.success_count ?? '0'),
        failureCount: parseInt(successRes.rows[0]?.failure_count ?? '0'),
        topUsers: usersRes.rows,
        dailyTrend: trendRes.rows,
        topDevices: devicesRes.rows,
      },
    });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// GET /api/control-history/recent/:greenhouseId
router.get('/recent/:greenhouseId', async (req: Request, res: Response) => {
  try {
    const { greenhouseId } = req.params;
    const limitNum = parseInt(req.query.limit as string) || 20;

    const ghRes = await query(`SELECT p.key as project_key FROM greenhouses g JOIN projects p ON g.project_id = p.id WHERE g.id = $1`, [greenhouseId]);
    const greenhouse = ghRes.rows[0];
    if (!greenhouse) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }
    if (!await hasProjectAccess(req.session.userId!, req.session.role!, greenhouse.project_key)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403); return;
    }

    const result = await query(`
      SELECT ch.*, u.username as user_name, u.full_name as user_full_name
      FROM control_history ch LEFT JOIN users u ON ch.user_id = u.id
      WHERE ch.greenhouse_id = $1 ORDER BY ch.created_at DESC LIMIT $2
    `, [greenhouseId, limitNum]);

    sendSuccess(res, { history: result.rows.map((h: any) => ({ ...h, success: Boolean(h.success) })) });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;