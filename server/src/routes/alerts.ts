/**
 * Alert History Routes
 * View and manage alert history
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { logAudit, AuditActions } from '../utils/audit.js';
import { z } from 'zod';

const router = Router();

// ============================================================
// Validation Schemas
// ============================================================

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

// ============================================================
// Helper Functions
// ============================================================

function hasProjectAccess(userId: number, userRole: string, projectKey?: string): boolean {
  if (userRole === 'admin') return true;
  if (!projectKey) return false;

  const access = db.prepare(`
    SELECT 1 FROM user_project_access upa
    JOIN projects p ON upa.project_id = p.id
    WHERE upa.user_id = ? AND p.key = ?
  `).get(userId, projectKey);

  return !!access;
}

// ============================================================
// Routes
// ============================================================

/**
 * GET /api/alerts
 * Get alert history with filters
 */
router.get('/', requireAuth, (req: Request, res: Response) => {
  try {
    const parsed = alertQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const { project_key, gh_key, alert_type, severity, is_acknowledged, start_date, end_date, limit, offset } = parsed.data;

    // Build query
    let query = `
      SELECT 
        ah.*,
        g.gh_key,
        g.name_th as greenhouse_name,
        p.key as project_key,
        p.name_th as project_name,
        u.username as acknowledged_by_name
      FROM alert_history ah
      JOIN greenhouses g ON ah.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      LEFT JOIN users u ON ah.acknowledged_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Project access check for non-admin
    if (req.session.role !== 'admin') {
      query += ` AND p.id IN (SELECT project_id FROM user_project_access WHERE user_id = ?)`;
      params.push(req.session.userId);
    }

    if (project_key) {
      query += ` AND p.key = ?`;
      params.push(project_key);
    }
    if (gh_key) {
      query += ` AND g.gh_key = ?`;
      params.push(gh_key);
    }
    if (alert_type) {
      query += ` AND ah.alert_type = ?`;
      params.push(alert_type);
    }
    if (severity) {
      query += ` AND ah.severity = ?`;
      params.push(severity);
    }
    if (is_acknowledged !== undefined) {
      query += ` AND ah.is_acknowledged = ?`;
      params.push(is_acknowledged === 'true' ? 1 : 0);
    }
    if (start_date) {
      query += ` AND ah.created_at >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND ah.created_at <= ?`;
      params.push(end_date);
    }

    query += ` ORDER BY ah.created_at DESC`;

    // Pagination
    const limitNum = parseInt(limit || '50');
    const offsetNum = parseInt(offset || '0');
    query += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offsetNum);

    const alerts = db.prepare(query).all(...params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total FROM alert_history ah
      JOIN greenhouses g ON ah.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE 1=1
    `;
    const countParams: any[] = [];

    if (req.session.role !== 'admin') {
      countQuery += ` AND p.id IN (SELECT project_id FROM user_project_access WHERE user_id = ?)`;
      countParams.push(req.session.userId);
    }
    if (project_key) { countQuery += ` AND p.key = ?`; countParams.push(project_key); }
    if (gh_key) { countQuery += ` AND g.gh_key = ?`; countParams.push(gh_key); }
    if (alert_type) { countQuery += ` AND ah.alert_type = ?`; countParams.push(alert_type); }
    if (severity) { countQuery += ` AND ah.severity = ?`; countParams.push(severity); }
    if (is_acknowledged !== undefined) { countQuery += ` AND ah.is_acknowledged = ?`; countParams.push(is_acknowledged === 'true' ? 1 : 0); }

    const { total } = db.prepare(countQuery).get(...countParams) as { total: number };

    sendSuccess(res, { 
      alerts, 
      pagination: { total, limit: limitNum, offset: offsetNum } 
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/alerts
 * Create new alert (for system use)
 */
router.post('/', requireAdmin, (req: Request, res: Response) => {
  try {
    const parsed = createAlertSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const data = parsed.data;

    const result = db.prepare(`
      INSERT INTO alert_history (
        greenhouse_id, alert_type, severity, sensor_key, sensor_name,
        current_value, threshold_value, direction, message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.greenhouse_id,
      data.alert_type,
      data.severity,
      data.sensor_key || null,
      data.sensor_name || null,
      data.current_value ?? null,
      data.threshold_value ?? null,
      data.direction || null,
      data.message
    );

    sendSuccess(res, { message: 'สร้าง Alert สำเร็จ', alert: { id: result.lastInsertRowid } });
  } catch (error) {
    console.error('Error creating alert:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * PUT /api/alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.put('/:id/acknowledge', requireAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if alert exists and user has access
    const alert = db.prepare(`
      SELECT ah.*, p.key as project_key FROM alert_history ah
      JOIN greenhouses g ON ah.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE ah.id = ?
    `).get(id) as any;

    if (!alert) {
      sendError(res, 'ไม่พบ Alert', 404);
      return;
    }

    if (!hasProjectAccess(req.session.userId!, req.session.role!, alert.project_key)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403);
      return;
    }

    db.prepare(`
      UPDATE alert_history 
      SET is_acknowledged = 1, acknowledged_by = ?, acknowledged_at = datetime('now')
      WHERE id = ?
    `).run(req.session.userId, id);

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.ALERT_ACKNOWLEDGED,
      projectKey: alert.project_key,
      detail: { alertId: id },
    });

    sendSuccess(res, { message: 'รับทราบ Alert สำเร็จ' });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * PUT /api/alerts/acknowledge-all
 * Acknowledge all unacknowledged alerts (with optional filters)
 */
router.put('/acknowledge-all', requireAuth, (req: Request, res: Response) => {
  try {
    const { project_key, gh_key } = req.query;

    let query = `
      UPDATE alert_history 
      SET is_acknowledged = 1, acknowledged_by = ?, acknowledged_at = datetime('now')
      WHERE is_acknowledged = 0 AND greenhouse_id IN (
        SELECT g.id FROM greenhouses g
        JOIN projects p ON g.project_id = p.id
        WHERE 1=1
    `;
    const params: any[] = [req.session.userId];

    if (req.session.role !== 'admin') {
      query += ` AND p.id IN (SELECT project_id FROM user_project_access WHERE user_id = ?)`;
      params.push(req.session.userId);
    }
    if (project_key) {
      query += ` AND p.key = ?`;
      params.push(project_key);
    }
    if (gh_key) {
      query += ` AND g.gh_key = ?`;
      params.push(gh_key);
    }

    query += `)`;

    const result = db.prepare(query).run(...params);

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.ALERTS_ACKNOWLEDGED_ALL,
      detail: { count: result.changes, project_key, gh_key },
    });

    sendSuccess(res, { message: `รับทราบ ${result.changes} Alert สำเร็จ` });
  } catch (error) {
    console.error('Error acknowledging all alerts:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/alerts/stats
 * Get alert statistics
 */
router.get('/stats', requireAuth, (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, days } = req.query;
    const daysNum = parseInt(days as string) || 7;

    let whereClause = `WHERE ah.created_at >= datetime('now', '-${daysNum} days')`;
    const params: any[] = [];

    if (req.session.role !== 'admin') {
      whereClause += ` AND p.id IN (SELECT project_id FROM user_project_access WHERE user_id = ?)`;
      params.push(req.session.userId);
    }
    if (project_key) {
      whereClause += ` AND p.key = ?`;
      params.push(project_key);
    }
    if (gh_key) {
      whereClause += ` AND g.gh_key = ?`;
      params.push(gh_key);
    }

    // Total counts by severity
    const severityCounts = db.prepare(`
      SELECT severity, COUNT(*) as count FROM alert_history ah
      JOIN greenhouses g ON ah.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      ${whereClause}
      GROUP BY severity
    `).all(...params) as { severity: string; count: number }[];

    // Total counts by type
    const typeCounts = db.prepare(`
      SELECT alert_type, COUNT(*) as count FROM alert_history ah
      JOIN greenhouses g ON ah.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      ${whereClause}
      GROUP BY alert_type
    `).all(...params) as { alert_type: string; count: number }[];

    // Unacknowledged count
    const { unacknowledged } = db.prepare(`
      SELECT COUNT(*) as unacknowledged FROM alert_history ah
      JOIN greenhouses g ON ah.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      ${whereClause} AND ah.is_acknowledged = 0
    `).get(...params) as { unacknowledged: number };

    // Daily trend
    const dailyTrend = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count FROM alert_history ah
      JOIN greenhouses g ON ah.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      ${whereClause}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT ?
    `).all(...params, daysNum) as { date: string; count: number }[];

    sendSuccess(res, {
      stats: {
        bySeverity: Object.fromEntries(severityCounts.map(s => [s.severity, s.count])),
        byType: Object.fromEntries(typeCounts.map(t => [t.alert_type, t.count])),
        unacknowledged,
        dailyTrend,
      }
    });
  } catch (error) {
    console.error('Error fetching alert stats:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;
