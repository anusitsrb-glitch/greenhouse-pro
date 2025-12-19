import { Router, Request, Response } from 'express';
import { db } from '../db/connection.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/', (req: Request, res: Response) => {
  try {
    // Quick DB check
    const result = db.prepare('SELECT 1 as ok').get() as { ok: number };
    
    if (result?.ok !== 1) {
      throw new Error('Database check failed');
    }
    
    sendSuccess(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    sendError(res, 'Service unhealthy', 503);
  }
});

export default router;
