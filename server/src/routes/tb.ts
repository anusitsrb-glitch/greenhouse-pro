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
import { setAttributesHandler } from './tb-attributes-enhanced.js';
import { notificationService } from '../services/notificationService.js';

const router = Router();

// Apply auth middleware
router.use(requireAuth);

router.post('/attributes', requireOperator, setAttributesHandler);

// ============================================================
// Validation Schemas
// ============================================================

const latestQuerySchema = z.object({
  project: z.string().min(1),
  gh: z.string().min(1),
  keys: z.string().min(1),
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

function hasProjectAccess(
  userId: number,
  userRole: string,
  projectKey: string
): boolean {
  if (userRole === 'admin' || userRole === 'superadmin') return true;

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
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const parsed = latestQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const { project, gh, keys } = parsed.data;

    if (!hasProjectAccess(req.session.userId!, req.session.role!, project)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403);
      return;
    }

    const keysArray = keys
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    const data = await tbService.getLatestTelemetry(project, gh, keysArray);

    sendSuccess(res, { telemetry: data });
  } catch (error) {
    console.error('Error fetching latest telemetry:', error);

    const errMsg =
      error instanceof Error ? error.message : String(error);

    sendError(res, errMsg, 502);
  }
});

/**
 * GET /api/tb/timeseries
 */
router.get('/timeseries', async (req: Request, res: Response) => {
  try {
    const parsed = timeseriesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const {
      project,
      gh,
      keys,
      startTs,
      endTs,
      interval,
      agg,
      limit,
    } = parsed.data;

    if (!hasProjectAccess(req.session.userId!, req.session.role!, project)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403);
      return;
    }

    const keysArray = keys
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

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

    const errMsg =
      error instanceof Error ? error.message : String(error);

    sendError(res, errMsg, 502);
  }
});

/**
 * GET /api/tb/attributes
 */
router.get('/attributes', async (req: Request, res: Response) => {
  try {
    const parsed = attributesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const { project, gh, keys } = parsed.data;

    if (!hasProjectAccess(req.session.userId!, req.session.role!, project)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403);
      return;
    }

    const keysArray = keys
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    const data = await tbService.getAttributes(project, gh, keysArray);

    sendSuccess(res, { attributes: data });
  } catch (error) {
    console.error('Error fetching attributes:', error);

    const errMsg =
      error instanceof Error ? error.message : String(error);

    sendError(res, errMsg, 502);
  }
});

/**
 * POST /api/tb/rpc
 */
router.post('/rpc', requireOperator, async (req: Request, res: Response) => {
  try {
    const parsed = rpcBodySchema.safeParse(req.body);

    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const { project, gh, method, params, timeout } = parsed.data;

    if (!hasProjectAccess(req.session.userId!, req.session.role!, project)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403);
      return;
    }

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

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.RPC_SENT,
      projectKey: project,
      ghKey: gh,
      detail: { method, params },
    });

    const forceOneWay =
      /_cmd$|_auto$|_time$|_condition_auto$|_interval_auto$/.test(method) ||
      method.startsWith('set_global_') ||
      /^set_motor_\d+_status$/.test(method);

    const effectiveTimeout = forceOneWay ? undefined : timeout;

    const rpcResponse = await tbService.sendRpc(
      project,
      gh,
      method,
      params,
      effectiveTimeout
    );

    const greenhouseId = getGreenhouseId(project, gh);

    if (greenhouseId) {
      const { controlKey, action, value } = parseRpcMethod(method, params);

      logControlAction(
        req,
        greenhouseId,
        controlKey,
        action,
        value,
        true
      );
    }

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

    const errMsg =
      error instanceof Error ? error.message : String(error);

    const greenhouseId = getGreenhouseId(
      req.body?.project,
      req.body?.gh
    );

    if (greenhouseId) {
      const { controlKey, action, value } = parseRpcMethod(
        req.body?.method,
        req.body?.params
      );

      logControlAction(
        req,
        greenhouseId,
        controlKey,
        action,
        value,
        false,
        errMsg
      );
    }

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.RPC_FAILED,
      projectKey: req.body?.project,
      ghKey: req.body?.gh,
      detail: {
        method: req.body?.method,
        params: req.body?.params,
        error: errMsg,
      },
    });

    const anyErr: any = error;
    const status = anyErr?.status ?? anyErr?.response?.status;

    const msg =
      error instanceof Error
        ? error.message
        : ThaiErrors.TB_CONNECTION_ERROR;

    const isSoftTimeout =
      status === 504 ||
      status === 408 ||
      /timeout|timed out|504|Bad Gateway|Gateway Time-out/i.test(msg);

    if (isSoftTimeout) {
      sendSuccess(res, {
        rpcResponse: {},
        message:
          'ส่งคำสั่งแล้ว (ThingsBoard ตอบช้า) รอซิงค์สถานะจากอุปกรณ์...',
      });
      return;
    }

    sendError(res, msg, 502);
  }
});

/**
 * GET /api/tb/device-status
 */
router.get('/device-status', async (req: Request, res: Response) => {
  try {
    const { project, gh } = req.query;

    if (
      !project ||
      !gh ||
      typeof project !== 'string' ||
      typeof gh !== 'string'
    ) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

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

    const msg =
      error instanceof Error
        ? error.message
        : ThaiErrors.TB_CONNECTION_ERROR;

    sendError(res, msg, 502);
  }
});

// ============================================================
// Helpers
// ============================================================

function getGreenhouseId(
  projectKey: string,
  ghKey: string
): number | null {
  try {
    const result = db.prepare(`
      SELECT g.id FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ?
    `).get(projectKey, ghKey) as { id: number } | undefined;

    return result?.id || null;
  } catch {
    return null;
  }
}

function parseRpcMethod(
  method: string,
  params: any
): {
  controlKey: string;
  action: string;
  value: string | number;
} {
  const lowerMethod = method.toLowerCase();

  if (lowerMethod.includes('valve1') || lowerMethod.includes('valve_1'))
    return { controlKey: 'valve_1', action: 'set', value: params };
  if (lowerMethod.includes('valve2') || lowerMethod.includes('valve_2'))
    return { controlKey: 'valve_2', action: 'set', value: params };
  if (lowerMethod.includes('valve3') || lowerMethod.includes('valve_3'))
    return { controlKey: 'valve_3', action: 'set', value: params };
  if (lowerMethod.includes('valve4') || lowerMethod.includes('valve_4'))
    return { controlKey: 'valve_4', action: 'set', value: params };

  if (lowerMethod.includes('fan1') || lowerMethod.includes('fan_1'))
    return { controlKey: 'fan_1', action: 'set', value: params };
  if (lowerMethod.includes('fan2') || lowerMethod.includes('fan_2'))
    return { controlKey: 'fan_2', action: 'set', value: params };

  if (lowerMethod.includes('light'))
    return { controlKey: 'light_1', action: 'set', value: params };

  const motorMatch = lowerMethod.match(/motor[_]?(\d)/);

  if (motorMatch) {
    const motorNum = motorMatch[1];

    if (lowerMethod.includes('forward'))
      return {
        controlKey: `motor_${motorNum}`,
        action: 'setForward',
        value: params,
      };

    if (lowerMethod.includes('reverse'))
      return {
        controlKey: `motor_${motorNum}`,
        action: 'setReverse',
        value: params,
      };

    if (lowerMethod.includes('stop'))
      return {
        controlKey: `motor_${motorNum}`,
        action: 'stop',
        value: 0,
      };
  }

  return { controlKey: method, action: 'set', value: params };
}

function logControlAction(
  req: Request,
  greenhouseId: number,
  controlKey: string,
  action: string,
  value: string | number,
  success: boolean,
  errorMessage?: string
): void {
  try {
    const userId = req.session.userId || null;

    const deviceMap: Record<string, string> = {
      fan_1: 'พัดลม 1',
      fan_2: 'พัดลม 2',
      valve_1: 'วาล์ว 1',
      valve_2: 'วาล์ว 2',
      valve_3: 'วาล์ว 3',
      valve_4: 'วาล์ว 4',
      light_1: 'ไฟ',
      motor_1: 'มอเตอร์ 1',
      motor_2: 'มอเตอร์ 2',
      motor_3: 'มอเตอร์ 3',
      motor_4: 'มอเตอร์ 4',
    };

    const controlName = deviceMap[controlKey] || controlKey;

    db.prepare(`
      INSERT INTO control_history (
        greenhouse_id, control_key, control_name, action, value, source,
        user_id, ip_address, success, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      greenhouseId,
      controlKey,
      controlName,
      action,
      String(value),
      'manual',
      userId,
      req.ip || null,
      success ? 1 : 0,
      errorMessage || null
    );

    const info = db.prepare(`
      SELECT g.name_th as greenhouse_name, p.id as project_id, u.username
      FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      LEFT JOIN users u ON u.id = ?
      WHERE g.id = ?
    `).get(userId, greenhouseId) as any;

    if (info && success) {
      const actionText = value ? 'เปิด' : 'ปิด';

      notificationService.create({
        type: 'control_action',
        severity: 'info',
        title: `${actionText}${controlName}`,
        message: `${info.username || 'ระบบ'} ${actionText}${controlName} ที่ ${info.greenhouse_name}`,
        metadata: {
          controlKey,
          controlName,
          action,
          value,
          greenhouseName: info.greenhouse_name,
          userName: info.username,
        },
        projectId: info.project_id,
        greenhouseId,
        autoDismiss: true,
        dismissAfterSeconds: 10,
      });

      console.log(`🔔 Notification created: ${actionText}${controlName}`);
    }
  } catch (err) {
    console.error('Failed to log control:', err);
  }
}

/**
 * POST /api/tb/test-connection
 */
router.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const { project } = req.body;

    if (!project || typeof project !== 'string') {
      sendError(res, 'กรุณาระบุ project key', 400);
      return;
    }

    if (
      req.session.role !== 'admin' &&
      req.session.role !== 'superadmin'
    ) {
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

    const msg =
      error instanceof Error
        ? error.message
        : ThaiErrors.TB_CONNECTION_ERROR;

    sendError(res, msg, 502);
  }
});

export default router;
