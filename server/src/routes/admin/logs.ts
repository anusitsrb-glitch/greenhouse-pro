/**
 * Admin Logs API
 * View control history and activity logs
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js'; // ✅ ใช้ requireAuth
import { getControlLogs, getControlLogStats } from '../../services/activityLog.js';
import { db } from '../../db/connection.js';

const router = Router();

// Apply auth middleware
router.use(requireAuth); // ✅ ใช้ requireAuth

/**
 * GET /api/admin/logs/control
 * Get control logs for a greenhouse
 * 
 * Query params:
 * - projectKey: string (required)
 * - ghKey: string (required)
 * - limit: number (default: 100)
 * - offset: number (default: 0)
 * - source: 'manual' | 'external_api' | 'automation' | 'schedule' | 'scene'
 * - startDate: ISO date string
 * - endDate: ISO date string
 */
router.get('/control', (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey, limit, offset, source, startDate, endDate } = req.query;
    
    if (!projectKey || !ghKey) {
      res.status(400).json({ 
        success: false, 
        error: 'projectKey and ghKey are required' 
      });
      return;
    }
    
    // Get greenhouse_id
    const stmt = db.prepare(`
      SELECT g.id 
      FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ?
    `);
    const greenhouse: any = stmt.get(projectKey as string, ghKey as string);
    
    if (!greenhouse) {
      res.status(404).json({ 
        success: false, 
        error: 'Greenhouse not found' 
      });
      return;
    }
    
    // Get logs
    const logs = getControlLogs(greenhouse.id, {
      limit: limit ? Number(limit) : 100,
      offset: offset ? Number(offset) : 0,
      source: source as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    
    res.json({ 
      success: true, 
      data: logs,
      meta: {
        count: logs.length,
        limit: limit ? Number(limit) : 100,
        offset: offset ? Number(offset) : 0,
      }
    });
  } catch (error) {
    console.error('Failed to get control logs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get control logs' 
    });
  }
});

/**
 * GET /api/admin/logs/control/stats
 * Get control log statistics
 * 
 * Query params:
 * - projectKey: string (required)
 * - ghKey: string (required)
 * - days: number (default: 7)
 */
router.get('/control/stats', (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey, days } = req.query;
    
    if (!projectKey || !ghKey) {
      res.status(400).json({ 
        success: false, 
        error: 'projectKey and ghKey are required' 
      });
      return;
    }
    
    // Get greenhouse_id
    const stmt = db.prepare(`
      SELECT g.id 
      FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ?
    `);
    const greenhouse: any = stmt.get(projectKey as string, ghKey as string);
    
    if (!greenhouse) {
      res.status(404).json({ 
        success: false, 
        error: 'Greenhouse not found' 
      });
      return;
    }
    
    // Get stats
    const stats = getControlLogStats(greenhouse.id, days ? Number(days) : 7);
    
    res.json({ 
      success: true, 
      data: stats 
    });
  } catch (error) {
    console.error('Failed to get control log stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get control log stats' 
    });
  }
});

export default router;