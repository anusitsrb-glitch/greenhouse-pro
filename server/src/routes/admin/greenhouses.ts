import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../../utils/response.js';
import { requireAdmin } from '../../middleware/auth.js';
import { logAudit, AuditActions } from '../../utils/audit.js';
import { z } from 'zod';

const router = Router();

// Apply admin middleware to all routes
router.use(requireAdmin);

// Validation schemas
const createGreenhouseSchema = z.object({
  project_key: z.string().min(1),
  gh_key: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, 'Key must be lowercase alphanumeric with underscores'),
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

/**
 * GET /api/admin/greenhouses
 * List all greenhouses across all projects
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const { project_key } = req.query;
    
    let query = `
      SELECT 
        g.id, g.gh_key, g.name_th, g.status, g.tb_device_id,
        g.created_at, g.updated_at,
        p.key as project_key, p.name_th as project_name
      FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
    `;
    
    const params: string[] = [];
    
    if (project_key && typeof project_key === 'string') {
      query += ' WHERE p.key = ?';
      params.push(project_key);
    }
    
    query += ' ORDER BY p.key ASC, g.gh_key ASC';
    
    const greenhouses = db.prepare(query).all(...params);
    
    const formatted = greenhouses.map((g: any) => ({
      id: g.id,
      ghKey: g.gh_key,
      nameTh: g.name_th,
      status: g.status,
      deviceId: g.tb_device_id,
      projectKey: g.project_key,
      projectName: g.project_name,
      createdAt: g.created_at,
      updatedAt: g.updated_at,
    }));
    
    sendSuccess(res, { greenhouses: formatted });
  } catch (error) {
    console.error('Error listing greenhouses:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/admin/greenhouses/:projectKey/:ghKey
 * Get single greenhouse
 */
router.get('/:projectKey/:ghKey', (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    
    const greenhouse = db.prepare(`
      SELECT 
        g.id, g.gh_key, g.name_th, g.status, g.tb_device_id,
        g.created_at, g.updated_at,
        p.id as project_id, p.key as project_key, p.name_th as project_name
      FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ?
    `).get(projectKey, ghKey) as any | undefined;
    
    if (!greenhouse) {
      sendError(res, ThaiErrors.GREENHOUSE_NOT_FOUND, 404);
      return;
    }
    
    sendSuccess(res, {
      greenhouse: {
        id: greenhouse.id,
        ghKey: greenhouse.gh_key,
        nameTh: greenhouse.name_th,
        status: greenhouse.status,
        deviceId: greenhouse.tb_device_id,
        projectId: greenhouse.project_id,
        projectKey: greenhouse.project_key,
        projectName: greenhouse.project_name,
        createdAt: greenhouse.created_at,
        updatedAt: greenhouse.updated_at,
      },
    });
  } catch (error) {
    console.error('Error getting greenhouse:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/admin/greenhouses
 * Create new greenhouse
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const parsed = createGreenhouseSchema.safeParse(req.body);
    
    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT + ': ' + parsed.error.errors[0]?.message, 400);
      return;
    }
    
    const { project_key, gh_key, name_th, status, tb_device_id } = parsed.data;
    
    // Get project
    const project = db.prepare('SELECT id FROM projects WHERE key = ?').get(project_key) as { id: number } | undefined;
    
    if (!project) {
      sendError(res, ThaiErrors.PROJECT_NOT_FOUND, 404);
      return;
    }
    
    // Check if gh_key exists in project
    const existing = db.prepare('SELECT id FROM greenhouses WHERE project_id = ? AND gh_key = ?')
      .get(project.id, gh_key);
    
    if (existing) {
      sendError(res, 'Key โรงเรือนนี้ถูกใช้แล้วในโปรเจกต์นี้', 409);
      return;
    }
    
    const result = db.prepare(`
      INSERT INTO greenhouses (project_id, gh_key, name_th, status, tb_device_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(project.id, gh_key, name_th, status, tb_device_id ?? null);
    
    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.GREENHOUSE_CREATED,
      projectKey: project_key,
      ghKey: gh_key,
      detail: { greenhouseId: result.lastInsertRowid, name_th },
    });
    
    sendSuccess(res, {
      greenhouse: {
        id: result.lastInsertRowid,
        ghKey: gh_key,
        nameTh: name_th,
        status,
        deviceId: tb_device_id ?? null,
      },
      message: 'สร้างโรงเรือนสำเร็จ',
    }, undefined, 201);
  } catch (error) {
    console.error('Error creating greenhouse:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * PUT /api/admin/greenhouses/:projectKey/:ghKey
 * Update greenhouse
 */
router.put('/:projectKey/:ghKey', (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    
    const parsed = updateGreenhouseSchema.safeParse(req.body);
    
    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }
    
    // Get greenhouse
    const greenhouse = db.prepare(`
      SELECT g.id, p.key as project_key
      FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ?
    `).get(projectKey, ghKey) as { id: number; project_key: string } | undefined;
    
    if (!greenhouse) {
      sendError(res, ThaiErrors.GREENHOUSE_NOT_FOUND, 404);
      return;
    }
    
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    
    if (parsed.data.name_th !== undefined) {
      updates.push('name_th = ?');
      values.push(parsed.data.name_th);
    }
    
    if (parsed.data.status !== undefined) {
      updates.push('status = ?');
      values.push(parsed.data.status);
    }
    
    if (parsed.data.tb_device_id !== undefined) {
      updates.push('tb_device_id = ?');
      values.push(parsed.data.tb_device_id);
    }
    
    if (updates.length === 0) {
      sendError(res, 'ไม่มีข้อมูลที่จะอัปเดต', 400);
      return;
    }
    
    updates.push('updated_at = datetime("now")');
    values.push(greenhouse.id);
    
    db.prepare(`UPDATE greenhouses SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.GREENHOUSE_UPDATED,
      projectKey,
      ghKey,
      detail: { updates: Object.keys(parsed.data) },
    });
    
    sendSuccess(res, { message: 'อัปเดตโรงเรือนสำเร็จ' });
  } catch (error) {
    console.error('Error updating greenhouse:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/admin/greenhouses/:projectKey/:ghKey/link-device
 * Link ThingsBoard device to greenhouse
 */
router.post('/:projectKey/:ghKey/link-device', (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    
    const parsed = linkDeviceSchema.safeParse(req.body);
    
    if (!parsed.success) {
      sendError(res, 'กรุณาระบุ Device ID', 400);
      return;
    }
    
    // Get greenhouse
    const greenhouse = db.prepare(`
      SELECT g.id, g.tb_device_id as old_device_id
      FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ?
    `).get(projectKey, ghKey) as { id: number; old_device_id: string | null } | undefined;
    
    if (!greenhouse) {
      sendError(res, ThaiErrors.GREENHOUSE_NOT_FOUND, 404);
      return;
    }
    
    const { tb_device_id } = parsed.data;
    
    // Update device ID and set status to ready
    db.prepare(`
      UPDATE greenhouses 
      SET tb_device_id = ?, status = 'ready', updated_at = datetime('now') 
      WHERE id = ?
    `).run(tb_device_id, greenhouse.id);
    
    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.DEVICE_LINKED,
      projectKey,
      ghKey,
      detail: { 
        oldDeviceId: greenhouse.old_device_id, 
        newDeviceId: tb_device_id,
      },
    });
    
    sendSuccess(res, { 
      message: 'ผูก Device ID สำเร็จ',
      deviceId: tb_device_id,
    });
  } catch (error) {
    console.error('Error linking device:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/admin/greenhouses/:projectKey/:ghKey/unlink-device
 * Unlink ThingsBoard device from greenhouse
 */
router.post('/:projectKey/:ghKey/unlink-device', (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    
    // Get greenhouse
    const greenhouse = db.prepare(`
      SELECT g.id, g.tb_device_id as old_device_id
      FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ?
    `).get(projectKey, ghKey) as { id: number; old_device_id: string | null } | undefined;
    
    if (!greenhouse) {
      sendError(res, ThaiErrors.GREENHOUSE_NOT_FOUND, 404);
      return;
    }
    
    // Remove device ID and set status to developing
    db.prepare(`
      UPDATE greenhouses 
      SET tb_device_id = NULL, status = 'developing', updated_at = datetime('now') 
      WHERE id = ?
    `).run(greenhouse.id);
    
    logAudit({
      userId: req.session.userId ?? null,
      action: 'DEVICE_UNLINKED',
      projectKey,
      ghKey,
      detail: { oldDeviceId: greenhouse.old_device_id },
    });
    
    sendSuccess(res, { message: 'ยกเลิกการผูก Device ID สำเร็จ' });
  } catch (error) {
    console.error('Error unlinking device:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * DELETE /api/admin/greenhouses/:projectKey/:ghKey
 * Delete greenhouse
 */
router.delete('/:projectKey/:ghKey', (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    
    // Get greenhouse
    const greenhouse = db.prepare(`
      SELECT g.id, g.name_th
      FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ?
    `).get(projectKey, ghKey) as { id: number; name_th: string } | undefined;
    
    if (!greenhouse) {
      sendError(res, ThaiErrors.GREENHOUSE_NOT_FOUND, 404);
      return;
    }
    
    db.prepare('DELETE FROM greenhouses WHERE id = ?').run(greenhouse.id);
    
    logAudit({
      userId: req.session.userId ?? null,
      action: 'GREENHOUSE_DELETED',
      projectKey,
      ghKey,
      detail: { greenhouseId: greenhouse.id, name_th: greenhouse.name_th },
    });
    
    sendSuccess(res, { message: 'ลบโรงเรือนสำเร็จ' });
  } catch (error) {
    console.error('Error deleting greenhouse:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;
