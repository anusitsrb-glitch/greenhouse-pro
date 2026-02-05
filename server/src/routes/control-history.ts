/**
 * Control History Routes
 * View detailed control action history
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

// Apply auth middleware
router.use(requireAuth);

// ============================================================
// Validation Schemas
// ============================================================

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

// ============================================================
// Helper Functions
// ============================================================

function hasProjectAccess(userId: number, userRole: string, projectKey?: string): boolean {
  if (userRole === 'admin' || userRole === 'superadmin') return true;
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
 * GET /api/control-history
 * Get control history with filters
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const parsed = controlHistoryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const {
      project_key,
      gh_key,
      source,
      user_id,
      control_key,
      success,
      start_date,
      end_date,
      limit,
      offset,
    } = parsed.data;

    // Build query
    let query = `
      SELECT 
        ch.*,
        g.gh_key,
        g.name_th as greenhouse_name,
        p.key as project_key,
        p.name_th as project_name,
        u.username as user_name,
        u.full_name as user_full_name
      FROM control_history ch
      JOIN greenhouses g ON ch.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      LEFT JOIN users u ON ch.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Project access check for non-admin
    if (req.session.role !== 'admin' && req.session.role !== 'superadmin') {
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
    if (source) {
      query += ` AND ch.source = ?`;
      params.push(source);
    }
    if (user_id) {
      query += ` AND ch.user_id = ?`;
      params.push(parseInt(user_id));
    }
    if (control_key) {
      query += ` AND ch.control_key = ?`;
      params.push(control_key);
    }
    if (success !== undefined) {
      query += ` AND ch.success = ?`;
      params.push(success === 'true' ? 1 : 0);
    }
    if (start_date) {
      query += ` AND ch.created_at >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND ch.created_at <= ?`;
      params.push(end_date);
    }

    query += ` ORDER BY ch.created_at DESC`;

    // Pagination
    const limitNum = parseInt(limit || '100');
    const offsetNum = parseInt(offset || '0');
    query += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offsetNum);

    const history = db.prepare(query).all(...params);

    // Convert success to boolean
    const parsedHistory = history.map((h: any) => ({
      ...h,
      success: Boolean(h.success),
    }));

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total FROM control_history ch
      JOIN greenhouses g ON ch.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE 1=1
    `;
    const countParams: any[] = [];

    if (req.session.role !== 'admin' && req.session.role !== 'superadmin') {
      countQuery += ` AND p.id IN (SELECT project_id FROM user_project_access WHERE user_id = ?)`;
      countParams.push(req.session.userId);
    }
    if (project_key) {
      countQuery += ` AND p.key = ?`;
      countParams.push(project_key);
    }
    if (gh_key) {
      countQuery += ` AND g.gh_key = ?`;
      countParams.push(gh_key);
    }
    if (source) {
      countQuery += ` AND ch.source = ?`;
      countParams.push(source);
    }
    if (user_id) {
      countQuery += ` AND ch.user_id = ?`;
      countParams.push(parseInt(user_id));
    }
    if (control_key) {
      countQuery += ` AND ch.control_key = ?`;
      countParams.push(control_key);
    }
    if (success !== undefined) {
      countQuery += ` AND ch.success = ?`;
      countParams.push(success === 'true' ? 1 : 0);
    }
    if (start_date) {
      countQuery += ` AND ch.created_at >= ?`;
      countParams.push(start_date);
    }
    if (end_date) {
      countQuery += ` AND ch.created_at <= ?`;
      countParams.push(end_date);
    }

    const { total } = db.prepare(countQuery).get(...countParams) as { total: number };

    sendSuccess(res, {
      history: parsedHistory,
      pagination: { total, limit: limitNum, offset: offsetNum },
    });
  } catch (error) {
    console.error('Error fetching control history:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/control-history/stats
 * Get control history statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, days } = req.query;
    const daysNum = parseInt(days as string) || 30;

    let whereClause = `WHERE ch.created_at >= datetime('now', '-${daysNum} days')`;
    const params: any[] = [];

    if (req.session.role !== 'admin' && req.session.role !== 'superadmin') {
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

    // Total counts by source
    const sourceCounts = db.prepare(`
      SELECT source, COUNT(*) as count FROM control_history ch
      JOIN greenhouses g ON ch.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      ${whereClause}
      GROUP BY source
    `).all(...params) as { source: string; count: number }[];

    // Success/Failure counts
    const successCounts = db.prepare(`
      SELECT 
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failure_count
      FROM control_history ch
      JOIN greenhouses g ON ch.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      ${whereClause}
    `).get(...params) as { success_count: number; failure_count: number };

    // Top users
    const topUsers = db.prepare(`
      SELECT 
        u.username,
        u.full_name,
        COUNT(*) as count
      FROM control_history ch
      JOIN greenhouses g ON ch.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      LEFT JOIN users u ON ch.user_id = u.id
      ${whereClause} AND ch.user_id IS NOT NULL
      GROUP BY ch.user_id
      ORDER BY count DESC
      LIMIT 10
    `).all(...params) as { username: string; full_name: string | null; count: number }[];

    // Daily trend
    const dailyTrend = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count
      FROM control_history ch
      JOIN greenhouses g ON ch.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      ${whereClause}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT ?
    `).all(...params, daysNum) as { date: string; count: number; success_count: number }[];

    // Most controlled devices
    const topDevices = db.prepare(`
      SELECT 
        ch.control_key,
        ch.control_name,
        g.name_th as greenhouse_name,
        COUNT(*) as count
      FROM control_history ch
      JOIN greenhouses g ON ch.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      ${whereClause}
      GROUP BY ch.control_key, g.id
      ORDER BY count DESC
      LIMIT 10
    `).all(...params) as {
      control_key: string;
      control_name: string | null;
      greenhouse_name: string;
      count: number;
    }[];

    sendSuccess(res, {
      stats: {
        bySource: Object.fromEntries(sourceCounts.map((s) => [s.source, s.count])),
        successCount: successCounts.success_count || 0,
        failureCount: successCounts.failure_count || 0,
        topUsers,
        dailyTrend,
        topDevices,
      },
    });
  } catch (error) {
    console.error('Error fetching control history stats:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/control-history/recent/:greenhouseId
 * Get recent control history for a specific greenhouse
 */
router.get('/recent/:greenhouseId', (req: Request, res: Response) => {
  try {
    const { greenhouseId } = req.params;
    const limitNum = parseInt(req.query.limit as string) || 20;

    // Check access
    const greenhouse = db.prepare(`
      SELECT p.key as project_key FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE g.id = ?
    `).get(greenhouseId) as { project_key: string } | undefined;

    if (!greenhouse) {
      sendError(res, 'ไม่พบโรงเรือน', 404);
      return;
    }

    if (!hasProjectAccess(req.session.userId!, req.session.role!, greenhouse.project_key)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403);
      return;
    }

    const history = db.prepare(`
      SELECT 
        ch.*,
        u.username as user_name,
        u.full_name as user_full_name
      FROM control_history ch
      LEFT JOIN users u ON ch.user_id = u.id
      WHERE ch.greenhouse_id = ?
      ORDER BY ch.created_at DESC
      LIMIT ?
    `).all(greenhouseId, limitNum);

    const parsedHistory = history.map((h: any) => ({
      ...h,
      success: Boolean(h.success),
    }));

    sendSuccess(res, { history: parsedHistory });
  } catch (error) {
    console.error('Error fetching recent control history:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;