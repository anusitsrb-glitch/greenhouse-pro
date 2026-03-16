import { Router, Request, Response } from 'express';
import { query } from '../../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../../utils/response.js';
import { requireAdmin } from '../../middleware/auth.js';
import { logAudit, AuditActions } from '../../utils/audit.js';
import { z } from 'zod';
import { isDeviceOnline } from '../../services/thingsboard.js';

const router = Router();
router.use(requireAdmin);

const createGreenhouseSchema = z.object({
  project_key: z.string().min(1),
  gh_key: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/),
  name_th: z.string().min(1).max(100),
  status: z.enum(['ready', 'developing']).optional().default('developing'),
  tb_device_id: z.string().min(1).optional().nullable(),
});

const updateGreenhouseSchema = z.object({
  name_th: z.string().min(1).max(100).optional(),
  status: z.enum(['ready', 'developing']).optional(),
  tb_device_id: z.string().min(1).optional().nullable(),
});

const linkDeviceSchema = z.object({
  tb_device_id: z.string().min(1),
});

// GET /api/admin/greenhouses
router.get('/', async (req: Request, res: Response) => {
  try {
    const { project_key } = req.query;
    let sql = `
      SELECT g.id, g.gh_key, g.name_th, g.status, g.tb_device_id,
        g.created_at, g.updated_at,
        p.key as project_key, p.name_th as project_name
      FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
    `;
    const params: any[] = [];
    if (project_key && typeof project_key === 'string') {
      sql += ' WHERE p.key = $1';
      params.push(project_key);
    }
    sql += ' ORDER BY p.key ASC, g.gh_key ASC';

    const result = await query(sql, params);
    const formatted = await Promise.all(
      result.rows.map(async (g: any) => {
        let isOnline = false;
        if (g.tb_device_id) {
          try {
            const status = await isDeviceOnline(g.project_key, g.gh_key);
            isOnline = typeof status === 'boolean' ? status : (status as any)?.isOnline === true;
          } catch {}
        }
        return {
          id: g.id, ghKey: g.gh_key, nameTh: g.name_th, status: g.status,
          deviceId: g.tb_device_id, isOnline,
          projectKey: g.project_key, projectName: g.project_name,
          createdAt: g.created_at, updatedAt: g.updated_at,
        };
      })
    );
    sendSuccess(res, { greenhouses: formatted });
  } catch (error) {
    console.error('Error listing greenhouses:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// GET /api/admin/greenhouses/:projectKey/:ghKey
router.get('/:projectKey/:ghKey', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const result = await query(`
      SELECT g.id, g.gh_key, g.name_th, g.status, g.tb_device_id,
        g.created_at, g.updated_at,
        p.id as project_id, p.key as project_key, p.name_th as project_name
      FROM greenhouses g JOIN projects p ON g.project_id = p.id
      WHERE p.key = $1 AND g.gh_key = $2
    `, [projectKey, ghKey]);
    const g = result.rows[0];
    if (!g) { sendError(res, ThaiErrors.GREENHOUSE_NOT_FOUND, 404); return; }
    sendSuccess(res, {
      greenhouse: {
        id: g.id, ghKey: g.gh_key, nameTh: g.name_th, status: g.status,
        deviceId: g.tb_device_id, projectId: g.project_id,
        projectKey: g.project_key, projectName: g.project_name,
        createdAt: g.created_at, updatedAt: g.updated_at,
      },
    });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// POST /api/admin/greenhouses
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createGreenhouseSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT + ': ' + parsed.error.errors[0]?.message, 400); return; }

    const { project_key, gh_key, name_th, status, tb_device_id } = parsed.data;

    const projectRes = await query('SELECT id FROM projects WHERE key = $1', [project_key]);
    const project = projectRes.rows[0];
    if (!project) { sendError(res, ThaiErrors.PROJECT_NOT_FOUND, 404); return; }

    const existing = await query('SELECT id FROM greenhouses WHERE project_id = $1 AND gh_key = $2', [project.id, gh_key]);
    if (existing.rows.length > 0) { sendError(res, 'Key โรงเรือนนี้ถูกใช้แล้วในโปรเจกต์นี้', 409); return; }

    const result = await query(
      `INSERT INTO greenhouses (project_id, gh_key, name_th, status, tb_device_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [project.id, gh_key, name_th, status, tb_device_id ?? null]
    );
    const newId = result.rows[0].id;

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.GREENHOUSE_CREATED, projectKey: project_key, ghKey: gh_key, detail: { greenhouseId: newId, name_th } });
    sendSuccess(res, { greenhouse: { id: newId, ghKey: gh_key, nameTh: name_th, status, deviceId: tb_device_id ?? null }, message: 'สร้างโรงเรือนสำเร็จ' }, undefined, 201);
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// PUT /api/admin/greenhouses/:projectKey/:ghKey
router.put('/:projectKey/:ghKey', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const parsed = updateGreenhouseSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const ghRes = await query(`
      SELECT g.id FROM greenhouses g JOIN projects p ON g.project_id = p.id
      WHERE p.key = $1 AND g.gh_key = $2
    `, [projectKey, ghKey]);
    const greenhouse = ghRes.rows[0];
    if (!greenhouse) { sendError(res, ThaiErrors.GREENHOUSE_NOT_FOUND, 404); return; }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (parsed.data.name_th !== undefined) { updates.push(`name_th = $${idx++}`); values.push(parsed.data.name_th); }
    if (parsed.data.status !== undefined) { updates.push(`status = $${idx++}`); values.push(parsed.data.status); }
    if (parsed.data.tb_device_id !== undefined) { updates.push(`tb_device_id = $${idx++}`); values.push(parsed.data.tb_device_id); }

    if (updates.length === 0) { sendError(res, 'ไม่มีข้อมูลที่จะอัปเดต', 400); return; }

    updates.push(`updated_at = now()::text`);
    values.push(greenhouse.id);
    await query(`UPDATE greenhouses SET ${updates.join(', ')} WHERE id = $${idx}`, values);

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.GREENHOUSE_UPDATED, projectKey, ghKey, detail: { updates: Object.keys(parsed.data) } });
    sendSuccess(res, { message: 'อัปเดตโรงเรือนสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// POST /api/admin/greenhouses/:projectKey/:ghKey/link-device
router.post('/:projectKey/:ghKey/link-device', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const parsed = linkDeviceSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, 'กรุณาระบุ Device ID', 400); return; }

    const ghRes = await query(`
      SELECT g.id, g.tb_device_id as old_device_id FROM greenhouses g
      JOIN projects p ON g.project_id = p.id WHERE p.key = $1 AND g.gh_key = $2
    `, [projectKey, ghKey]);
    const greenhouse = ghRes.rows[0];
    if (!greenhouse) { sendError(res, ThaiErrors.GREENHOUSE_NOT_FOUND, 404); return; }

    await query(`UPDATE greenhouses SET tb_device_id = $1, status = 'ready', updated_at = now()::text WHERE id = $2`, [parsed.data.tb_device_id, greenhouse.id]);
    logAudit({ userId: req.session.userId ?? null, action: AuditActions.DEVICE_LINKED, projectKey, ghKey, detail: { oldDeviceId: greenhouse.old_device_id, newDeviceId: parsed.data.tb_device_id } });
    sendSuccess(res, { message: 'ผูก Device ID สำเร็จ', deviceId: parsed.data.tb_device_id });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// POST /api/admin/greenhouses/:projectKey/:ghKey/unlink-device
router.post('/:projectKey/:ghKey/unlink-device', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const ghRes = await query(`
      SELECT g.id, g.tb_device_id as old_device_id FROM greenhouses g
      JOIN projects p ON g.project_id = p.id WHERE p.key = $1 AND g.gh_key = $2
    `, [projectKey, ghKey]);
    const greenhouse = ghRes.rows[0];
    if (!greenhouse) { sendError(res, ThaiErrors.GREENHOUSE_NOT_FOUND, 404); return; }

    await query(`UPDATE greenhouses SET tb_device_id = NULL, status = 'developing', updated_at = now()::text WHERE id = $1`, [greenhouse.id]);
    logAudit({ userId: req.session.userId ?? null, action: 'DEVICE_UNLINKED' as any, projectKey, ghKey, detail: { oldDeviceId: greenhouse.old_device_id } });
    sendSuccess(res, { message: 'ยกเลิกการผูก Device ID สำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// DELETE /api/admin/greenhouses/:projectKey/:ghKey
router.delete('/:projectKey/:ghKey', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const ghRes = await query(`
      SELECT g.id, g.name_th FROM greenhouses g
      JOIN projects p ON g.project_id = p.id WHERE p.key = $1 AND g.gh_key = $2
    `, [projectKey, ghKey]);
    const greenhouse = ghRes.rows[0];
    if (!greenhouse) { sendError(res, ThaiErrors.GREENHOUSE_NOT_FOUND, 404); return; }

    await query('DELETE FROM greenhouses WHERE id = $1', [greenhouse.id]);
    logAudit({ userId: req.session.userId ?? null, action: 'GREENHOUSE_DELETED' as any, projectKey, ghKey, detail: { greenhouseId: greenhouse.id, name_th: greenhouse.name_th } });
    sendSuccess(res, { message: 'ลบโรงเรือนสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;