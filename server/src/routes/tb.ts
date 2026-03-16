import { Router, Request, Response } from 'express';
import { query } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth, requireOperator } from '../middleware/auth.js';
import { logAudit, AuditActions } from '../utils/audit.js';
import { tbService } from '../services/thingsboard.js';
import { z } from 'zod';
import { setAttributesHandler } from './tb-attributes-enhanced.js';
import { notificationService } from '../services/notificationService.js';

const router = Router();
router.use(requireAuth);
router.post('/attributes', requireOperator, setAttributesHandler);

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

// Online cache
const onlineCache = new Map<string, { isOnline: boolean; ts: number }>();
const ONLINE_CACHE_TTL_MS = 30000;

async function getDeviceOnlineCached(project: string, gh: string): Promise<boolean> {
  const key = `${project}:${gh}`;
  const cached = onlineCache.get(key);
  if (cached && Date.now() - cached.ts < ONLINE_CACHE_TTL_MS) return cached.isOnline;
  const isOnline = await tbService.isDeviceOnline(project, gh);
  onlineCache.set(key, { isOnline, ts: Date.now() });
  return isOnline;
}

async function hasProjectAccess(userId: number, userRole: string, projectKey: string): Promise<boolean> {
  if (userRole === 'admin' || userRole === 'superadmin') return true;
  const result = await query(`
    SELECT 1 FROM user_project_access upa
    JOIN projects p ON upa.project_id = p.id
    WHERE upa.user_id = $1 AND p.key = $2
  `, [userId, projectKey]);
  return result.rows.length > 0;
}

async function getGreenhouseId(projectKey: string, ghKey: string): Promise<number | null> {
  try {
    const result = await query(`
      SELECT g.id FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = $1 AND g.gh_key = $2
    `, [projectKey, ghKey]);
    return result.rows[0]?.id ?? null;
  } catch { return null; }
}

function parseRpcMethod(method: string, params: any): { controlKey: string; action: string; value: string | number } {
  const lowerMethod = method.toLowerCase();
  if (lowerMethod.includes('valve1') || lowerMethod.includes('valve_1')) return { controlKey: 'valve_1', action: 'set', value: params };
  if (lowerMethod.includes('valve2') || lowerMethod.includes('valve_2')) return { controlKey: 'valve_2', action: 'set', value: params };
  if (lowerMethod.includes('valve3') || lowerMethod.includes('valve_3')) return { controlKey: 'valve_3', action: 'set', value: params };
  if (lowerMethod.includes('valve4') || lowerMethod.includes('valve_4')) return { controlKey: 'valve_4', action: 'set', value: params };
  if (lowerMethod.includes('fan1') || lowerMethod.includes('fan_1')) return { controlKey: 'fan_1', action: 'set', value: params };
  if (lowerMethod.includes('fan2') || lowerMethod.includes('fan_2')) return { controlKey: 'fan_2', action: 'set', value: params };
  if (lowerMethod.includes('light')) return { controlKey: 'light_1', action: 'set', value: params };
  const motorMatch = lowerMethod.match(/motor[_]?(\d)/);
  if (motorMatch) {
    const motorNum = motorMatch[1];
    if (lowerMethod.includes('forward')) return { controlKey: `motor_${motorNum}`, action: 'setForward', value: params };
    if (lowerMethod.includes('reverse')) return { controlKey: `motor_${motorNum}`, action: 'setReverse', value: params };
    if (lowerMethod.includes('stop')) return { controlKey: `motor_${motorNum}`, action: 'stop', value: 0 };
  }
  return { controlKey: method, action: 'set', value: params };
}

async function logControlAction(
  req: Request,
  greenhouseId: number,
  controlKey: string,
  action: string,
  value: string | number,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    const userId = req.session.userId || null;
    const deviceMap: Record<string, string> = {
      fan_1: 'พัดลม 1', fan_2: 'พัดลม 2',
      valve_1: 'วาล์ว 1', valve_2: 'วาล์ว 2', valve_3: 'วาล์ว 3', valve_4: 'วาล์ว 4',
      light_1: 'ไฟ',
      motor_1: 'มอเตอร์ 1', motor_2: 'มอเตอร์ 2', motor_3: 'มอเตอร์ 3', motor_4: 'มอเตอร์ 4',
    };
    const controlName = deviceMap[controlKey] || controlKey;

    await query(`
      INSERT INTO control_history (
        greenhouse_id, control_key, control_name, action, value, source,
        user_id, ip_address, success, error_message
      ) VALUES ($1,$2,$3,$4,$5,'manual',$6,$7,$8,$9)
    `, [greenhouseId, controlKey, controlName, action, String(value), userId, req.ip || null, success ? 1 : 0, errorMessage || null]);

    const infoRes = await query(`
      SELECT g.name_th as greenhouse_name, p.id as project_id, u.username
      FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      LEFT JOIN users u ON u.id = $1
      WHERE g.id = $2
    `, [userId, greenhouseId]);
    const info = infoRes.rows[0];

    if (info && success) {
      const actionText = value ? 'เปิด' : 'ปิด';
      notificationService.create({
        type: 'control_action',
        severity: 'info',
        title: `${actionText}${controlName}`,
        message: `${info.username || 'ระบบ'} ${actionText}${controlName} ที่ ${info.greenhouse_name}`,
        metadata: { controlKey, controlName, action, value, greenhouseName: info.greenhouse_name, userName: info.username },
        projectId: info.project_id,
        greenhouseId,
        autoDismiss: true,
        dismissAfterSeconds: 10,
      });
    }
  } catch (err) {
    console.error('Failed to log control:', err);
  }
}

// GET /api/tb/latest
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const parsed = latestQuerySchema.safeParse(req.query);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }
    const { project, gh, keys } = parsed.data;
    if (!await hasProjectAccess(req.session.userId!, req.session.role!, project)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403); return;
    }
    const keysArray = keys.split(',').map(k => k.trim()).filter(Boolean);
    const data = await tbService.getLatestTelemetry(project, gh, keysArray);
    sendSuccess(res, { telemetry: data });
  } catch (error) {
    sendError(res, error instanceof Error ? error.message : String(error), 502);
  }
});

// GET /api/tb/timeseries
router.get('/timeseries', async (req: Request, res: Response) => {
  try {
    const parsed = timeseriesQuerySchema.safeParse(req.query);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }
    const { project, gh, keys, startTs, endTs, interval, agg, limit } = parsed.data;
    if (!await hasProjectAccess(req.session.userId!, req.session.role!, project)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403); return;
    }
    const keysArray = keys.split(',').map(k => k.trim()).filter(Boolean);
    const data = await tbService.getTelemetryTimeseries(project, gh, keysArray, startTs, endTs, interval, agg, limit);
    sendSuccess(res, { timeseries: data });
  } catch (error) {
    sendError(res, error instanceof Error ? error.message : String(error), 502);
  }
});

// GET /api/tb/attributes
router.get('/attributes', async (req: Request, res: Response) => {
  try {
    const parsed = attributesQuerySchema.safeParse(req.query);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }
    const { project, gh, keys } = parsed.data;
    if (!await hasProjectAccess(req.session.userId!, req.session.role!, project)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403); return;
    }
    const keysArray = keys.split(',').map(k => k.trim()).filter(Boolean);
    const data = await tbService.getAttributes(project, gh, keysArray);
    if (data.status !== undefined) {
      const isOnline = typeof data.status === 'string' ? data.status.toLowerCase() === 'online' : false;
      onlineCache.set(`${project}:${gh}`, { isOnline, ts: Date.now() });
    }
    sendSuccess(res, { attributes: data });
  } catch (error) {
    sendError(res, error instanceof Error ? error.message : String(error), 502);
  }
});

// POST /api/tb/rpc
router.post('/rpc', requireOperator, async (req: Request, res: Response) => {
  try {
    const parsed = rpcBodySchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }
    const { project, gh, method, params, timeout } = parsed.data;

    if (!await hasProjectAccess(req.session.userId!, req.session.role!, project)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403); return;
    }

    const isOnline = await getDeviceOnlineCached(project, gh);
    if (!isOnline) {
      logAudit({ userId: req.session.userId ?? null, action: AuditActions.RPC_FAILED, projectKey: project, ghKey: gh, detail: { method, params, reason: 'Device offline' } });
      sendError(res, ThaiErrors.TB_DEVICE_OFFLINE, 503);
      return;
    }

    const forceOneWay =
      /_cmd$|_auto$|_time$|_condition_auto$|_interval_auto$/.test(method) ||
      method.startsWith('set_global_') ||
      /^set_motor_\d+_status$/.test(method);

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.RPC_SENT, projectKey: project, ghKey: gh, detail: { method, params } });

    if (forceOneWay) {
      sendSuccess(res, { rpcResponse: {}, message: 'ส่งคำสั่งแล้ว' });
      tbService.sendRpc(project, gh, method, params, undefined)
        .then(async (rpcResponse) => {
          const ghId = await getGreenhouseId(project, gh);
          if (ghId) {
            const { controlKey, action, value } = parseRpcMethod(method, params);
            await logControlAction(req, ghId, controlKey, action, value, true);
          }
          logAudit({ userId: req.session.userId ?? null, action: AuditActions.RPC_SUCCESS, projectKey: project, ghKey: gh, detail: { method, params, response: rpcResponse } });
        })
        .catch(async (err) => {
          const errMsg = err instanceof Error ? err.message : String(err);
          const ghId = await getGreenhouseId(project, gh);
          if (ghId) {
            const { controlKey, action, value } = parseRpcMethod(method, params);
            await logControlAction(req, ghId, controlKey, action, value, false, errMsg);
          }
          logAudit({ userId: req.session.userId ?? null, action: AuditActions.RPC_FAILED, projectKey: project, ghKey: gh, detail: { method, params, error: errMsg } });
        });
      return;
    }

    const rpcResponse = await tbService.sendRpc(project, gh, method, params, timeout);
    const ghId = await getGreenhouseId(project, gh);
    if (ghId) {
      const { controlKey, action, value } = parseRpcMethod(method, params);
      await logControlAction(req, ghId, controlKey, action, value, true);
    }
    logAudit({ userId: req.session.userId ?? null, action: AuditActions.RPC_SUCCESS, projectKey: project, ghKey: gh, detail: { method, params, response: rpcResponse } });
    sendSuccess(res, { rpcResponse, message: 'ส่งคำสั่งสำเร็จ' });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    getGreenhouseId(req.body?.project, req.body?.gh).then(async (ghId) => {
      if (ghId) {
        const { controlKey, action, value } = parseRpcMethod(req.body?.method, req.body?.params);
        await logControlAction(req, ghId, controlKey, action, value, false, errMsg);
      }
    });
    logAudit({ userId: req.session.userId ?? null, action: AuditActions.RPC_FAILED, projectKey: req.body?.project, ghKey: req.body?.gh, detail: { method: req.body?.method, error: errMsg } });

    const anyErr: any = error;
    const status = anyErr?.status ?? anyErr?.response?.status;
    const isSoftTimeout = status === 504 || status === 408 || /timeout|timed out|504|Bad Gateway/i.test(errMsg);
    if (isSoftTimeout) {
      sendSuccess(res, { rpcResponse: {}, message: 'ส่งคำสั่งแล้ว (ThingsBoard ตอบช้า) รอซิงค์สถานะจากอุปกรณ์...' });
      return;
    }
    sendError(res, errMsg, 502);
  }
});

// GET /api/tb/device-status
router.get('/device-status', async (req: Request, res: Response) => {
  try {
    const { project, gh } = req.query;
    if (!project || !gh || typeof project !== 'string' || typeof gh !== 'string') {
      sendError(res, ThaiErrors.INVALID_INPUT, 400); return;
    }
    if (!await hasProjectAccess(req.session.userId!, req.session.role!, project)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403); return;
    }
    const isOnline = await getDeviceOnlineCached(project, gh);
    sendSuccess(res, { online: isOnline, status: isOnline ? 'Online' : 'Offline', statusTh: isOnline ? 'ออนไลน์' : 'ออฟไลน์' });
  } catch (error) {
    sendError(res, error instanceof Error ? error.message : ThaiErrors.TB_CONNECTION_ERROR, 502);
  }
});

// POST /api/tb/test-connection
router.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const { project } = req.body;
    if (!project || typeof project !== 'string') { sendError(res, 'กรุณาระบุ project key', 400); return; }
    if (req.session.role !== 'admin' && req.session.role !== 'superadmin') { sendError(res, ThaiErrors.FORBIDDEN, 403); return; }
    const result = await tbService.testConnection(project);
    if (result.success) { sendSuccess(res, result); } else { sendError(res, result.message, 502); }
  } catch (error) {
    sendError(res, error instanceof Error ? error.message : ThaiErrors.TB_CONNECTION_ERROR, 502);
  }
});

export default router;