/**
 * ThingsBoard Proxy Routes
 * All TB requests go through backend to protect credentials
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth, requireOperator } from '../middleware/auth.js';
import { logAudit, AuditActions } from '../utils/audit.js';
import { tbService } from '../services/thingsboard.js';
import { z } from 'zod';

const router = Router();

// Apply auth middleware
router.use(requireAuth);

// ============================================================
// Validation Schemas
// ============================================================

const latestQuerySchema = z.object({
  project: z.string().min(1),
  gh: z.string().min(1),
  keys: z.string().min(1), // comma-separated
});

const timeseriesQuerySchema = z.object({
  project: z.string().min(1),
  gh: z.string().min(1),
  keys: z.string().min(1),
  startTs: z.string().transform(Number),
  endTs: z.string().transform(Number),
  interval: z.string().transform(Number).optional(),
  agg: z.string().optional(),
  limit: z.string().transform(Number).optional(),
});

const attributesQuerySchema = z.object({
  project: z.string().min(1),
  gh: z.string().min(1),
  keys: z.string().min(1),
});

const rpcBodySchema = z.object({
  project: z.string().min(1),
  gh: z.string().min(1),
  method: z.string().min(1),
  params: z.unknown(),
  timeout: z.number().optional(),
});

// ============================================================
// Helper: Check Project Access
// ============================================================

function hasProjectAccess(userId: number, userRole: string, projectKey: string): boolean {
  if (userRole === 'admin') return true;

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
 * GET /api/tb/latest
 * Get latest telemetry values
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const parsed = latestQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const { project, gh, keys } = parsed.data;

    // Check access
    if (!hasProjectAccess(req.session.userId!, req.session.role!, project)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403);
      return;
    }

    const keysArray = keys.split(',').map(k => k.trim()).filter(Boolean);
    const data = await tbService.getLatestTelemetry(project, gh, keysArray);

    sendSuccess(res, { telemetry: data });
  } catch (error) {
    console.error('Error fetching latest telemetry:', error);
    const message = error instanceof Error ? error.message : ThaiErrors.TB_CONNECTION_ERROR;
    sendError(res, message, 502);
  }
});

/**
 * GET /api/tb/timeseries
 * Get telemetry timeseries for charts
 */
router.get('/timeseries', async (req: Request, res: Response) => {
  try {
    const parsed = timeseriesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const { project, gh, keys, startTs, endTs, interval, agg, limit } = parsed.data;

    // Check access
    if (!hasProjectAccess(req.session.userId!, req.session.role!, project)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403);
      return;
    }

    const keysArray = keys.split(',').map(k => k.trim()).filter(Boolean);
    const data = await tbService.getTelemetryTimeseries(
      project,
      gh,
      keysArray,
      startTs,
      endTs,
      interval,
      agg,
      limit
    );

    sendSuccess(res, { timeseries: data });
  } catch (error) {
    console.error('Error fetching timeseries:', error);
    const message = error instanceof Error ? error.message : ThaiErrors.TB_CONNECTION_ERROR;
    sendError(res, message, 502);
  }
});

/**
 * GET /api/tb/attributes
 * Get device attributes
 */
router.get('/attributes', async (req: Request, res: Response) => {
  try {
    const parsed = attributesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const { project, gh, keys } = parsed.data;

    // Check access
    if (!hasProjectAccess(req.session.userId!, req.session.role!, project)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403);
      return;
    }

    const keysArray = keys.split(',').map(k => k.trim()).filter(Boolean);
    const data = await tbService.getAttributes(project, gh, keysArray);

    sendSuccess(res, { attributes: data });
  } catch (error) {
    console.error('Error fetching attributes:', error);
    const message = error instanceof Error ? error.message : ThaiErrors.TB_CONNECTION_ERROR;
    sendError(res, message, 502);
  }
});

/**
 * POST /api/tb/rpc
 * Send RPC command to device
 * Requires operator or admin role
 */
router.post('/rpc', requireOperator, async (req: Request, res: Response) => {
  try {
    const parsed = rpcBodySchema.safeParse(req.body);

    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const { project, gh, method, params, timeout } = parsed.data;

    // Check access
    if (!hasProjectAccess(req.session.userId!, req.session.role!, project)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403);
      return;
    }

    // Check if device is online first
    const isOnline = await tbService.isDeviceOnline(project, gh);
    if (!isOnline) {
      logAudit({
        userId: req.session.userId ?? null,
        action: AuditActions.RPC_FAILED,
        projectKey: project,
        ghKey: gh,
        detail: { method, params, reason: 'Device offline' },
      });
      sendError(res, ThaiErrors.TB_DEVICE_OFFLINE, 503);
      return;
    }

    // Log RPC attempt
    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.RPC_SENT,
      projectKey: project,
      ghKey: gh,
      detail: { method, params },
    });

    // Send RPC
    const rpcResponse = await tbService.sendRpc(project, gh, method, params, timeout);

    // Log success
    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.RPC_SUCCESS,
      projectKey: project,
      ghKey: gh,
      detail: { method, params, response: rpcResponse },
    });

    sendSuccess(res, {
      rpcResponse,
      message: 'ส่งคำสั่งสำเร็จ',
    });
  } catch (error) {
    console.error('Error sending RPC:', error);

    // Log failure
    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.RPC_FAILED,
      projectKey: req.body?.project,
      ghKey: req.body?.gh,
      detail: {
        method: req.body?.method,
        params: req.body?.params,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    const message = error instanceof Error ? error.message : ThaiErrors.TB_CONNECTION_ERROR;
    sendError(res, message, 502);
  }
});

/**
 * GET /api/tb/device-status
 * Check device online status
 */
router.get('/device-status', async (req: Request, res: Response) => {
  try {
    const { project, gh } = req.query;

    if (!project || !gh || typeof project !== 'string' || typeof gh !== 'string') {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    // Check access
    if (!hasProjectAccess(req.session.userId!, req.session.role!, project)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403);
      return;
    }

    const isOnline = await tbService.isDeviceOnline(project, gh);

    sendSuccess(res, {
      online: isOnline,
      status: isOnline ? 'Online' : 'Offline',
      statusTh: isOnline ? 'ออนไลน์' : 'ออฟไลน์',
    });
  } catch (error) {
    console.error('Error checking device status:', error);
    const message = error instanceof Error ? error.message : ThaiErrors.TB_CONNECTION_ERROR;
    sendError(res, message, 502);
  }
});

/**
 * POST /api/tb/test-connection
 * Test ThingsBoard connection (admin only)
 */
router.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const { project } = req.body;

    if (!project || typeof project !== 'string') {
      sendError(res, 'กรุณาระบุ project key', 400);
      return;
    }

    // Only admin can test connection
    if (req.session.role !== 'admin') {
      sendError(res, ThaiErrors.FORBIDDEN, 403);
      return;
    }

    const result = await tbService.testConnection(project);

    if (result.success) {
      sendSuccess(res, result);
    } else {
      sendError(res, result.message, 502);
    }
  } catch (error) {
    console.error('Error testing connection:', error);
    const message = error instanceof Error ? error.message : ThaiErrors.TB_CONNECTION_ERROR;
    sendError(res, message, 502);
  }
});

export default router;
