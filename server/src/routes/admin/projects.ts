import { Router, Request, Response } from 'express';
import { query } from '../../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../../utils/response.js';
import { requireAdmin } from '../../middleware/auth.js';
import { logAudit, AuditActions } from '../../utils/audit.js';
import { z } from 'zod';
import type { Project } from '../../types/index.js';

const router = Router();
router.use(requireAdmin);

const createProjectSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, 'Key must be lowercase alphanumeric with underscores'),
  name_th: z.string().min(1).max(100),
  status: z.enum(['ready', 'developing']).optional().default('developing'),
  tb_base_url: z.string().min(1),
  tb_username: z.string().min(1),
  tb_password: z.string().min(1),
});

const updateProjectSchema = z.object({
  name_th: z.string().min(1).max(100).optional(),
  status: z.enum(['ready', 'developing']).optional(),
  tb_base_url: z.string().min(1).optional(),
  tb_username: z.string().min(1).optional(),
  tb_password: z.string().optional(),
});

// GET /api/admin/projects
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        p.id, p.key, p.name_th, p.status,
        p.tb_base_url, p.tb_username,
        p.created_at, p.updated_at,
        COUNT(g.id) as greenhouse_count,
        SUM(CASE WHEN g.status = 'ready' THEN 1 ELSE 0 END) as ready_greenhouse_count
      FROM projects p
      LEFT JOIN greenhouses g ON p.id = g.project_id
      GROUP BY p.id
      ORDER BY p.created_at ASC
    `);
    const formattedProjects = result.rows.map((p: any) => ({
      id: p.id, key: p.key, nameTh: p.name_th, status: p.status,
      tbBaseUrl: p.tb_base_url, tbUsername: p.tb_username,
      createdAt: p.created_at, updatedAt: p.updated_at,
      greenhouseCount: parseInt(p.greenhouse_count),
      readyGreenhouseCount: parseInt(p.ready_greenhouse_count) || 0,
    }));
    sendSuccess(res, { projects: formattedProjects });
  } catch (error) {
    console.error('Error listing projects:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// GET /api/admin/projects/:key
router.get('/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const projectRes = await query(
      `SELECT id, key, name_th, status, tb_base_url, tb_username, tb_password, created_at, updated_at FROM projects WHERE key = $1`,
      [key]
    );
    const project = projectRes.rows[0];
    if (!project) { sendError(res, ThaiErrors.PROJECT_NOT_FOUND, 404); return; }

    const ghRes = await query(
      `SELECT id, gh_key, name_th, status, tb_device_id, created_at, updated_at FROM greenhouses WHERE project_id = $1 ORDER BY gh_key ASC`,
      [project.id]
    );
    sendSuccess(res, {
      project: {
        id: project.id, key: project.key, nameTh: project.name_th, status: project.status,
        tbBaseUrl: project.tb_base_url, tbUsername: project.tb_username, tbPassword: project.tb_password,
        createdAt: project.created_at, updatedAt: project.updated_at,
      },
      greenhouses: ghRes.rows.map((g: any) => ({
        id: g.id, ghKey: g.gh_key, nameTh: g.name_th, status: g.status,
        deviceId: g.tb_device_id, createdAt: g.created_at, updatedAt: g.updated_at,
      })),
    });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// POST /api/admin/projects
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT + ': ' + parsed.error.errors[0]?.message, 400); return; }

    const { key, name_th, status, tb_base_url, tb_username, tb_password } = parsed.data;

    const existing = await query('SELECT id FROM projects WHERE key = $1', [key]);
    if (existing.rows.length > 0) { sendError(res, 'Key โปรเจกต์นี้ถูกใช้แล้ว', 409); return; }

    const result = await query(
      `INSERT INTO projects (key, name_th, status, tb_base_url, tb_username, tb_password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [key, name_th, status, tb_base_url, tb_username, tb_password]
    );
    const newId = result.rows[0].id;

    const adminUsers = await query(`SELECT id FROM users WHERE role = 'admin'`);
    for (const admin of adminUsers.rows) {
      await query(`INSERT INTO user_project_access (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [admin.id, newId]);
    }

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.PROJECT_CREATED, projectKey: key, detail: { projectId: newId, name_th } });
    sendSuccess(res, { project: { id: newId, key, nameTh: name_th, status }, message: 'สร้างโปรเจกต์สำเร็จ' }, undefined, 201);
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// PUT /api/admin/projects/:key
router.put('/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const projectRes = await query('SELECT id FROM projects WHERE key = $1', [key]);
    const project = projectRes.rows[0];
    if (!project) { sendError(res, ThaiErrors.PROJECT_NOT_FOUND, 404); return; }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (parsed.data.name_th !== undefined) { updates.push(`name_th = $${idx++}`); values.push(parsed.data.name_th); }
    if (parsed.data.status !== undefined) { updates.push(`status = $${idx++}`); values.push(parsed.data.status); }
    if (parsed.data.tb_base_url !== undefined) { updates.push(`tb_base_url = $${idx++}`); values.push(parsed.data.tb_base_url); }
    if (parsed.data.tb_username !== undefined) { updates.push(`tb_username = $${idx++}`); values.push(parsed.data.tb_username); }
    if (parsed.data.tb_password !== undefined) { updates.push(`tb_password = $${idx++}`); values.push(parsed.data.tb_password); }

    if (updates.length === 0) { sendError(res, 'ไม่มีข้อมูลที่จะอัปเดต', 400); return; }

    updates.push(`updated_at = now()::text`);
    values.push(project.id);

    await query(`UPDATE projects SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    logAudit({ userId: req.session.userId ?? null, action: AuditActions.PROJECT_UPDATED, projectKey: key, detail: { updates: Object.keys(parsed.data) } });
    sendSuccess(res, { message: 'อัปเดตโปรเจกต์สำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// DELETE /api/admin/projects/:key
router.delete('/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const projectRes = await query('SELECT id, name_th FROM projects WHERE key = $1', [key]);
    const project = projectRes.rows[0];
    if (!project) { sendError(res, ThaiErrors.PROJECT_NOT_FOUND, 404); return; }

    await query('DELETE FROM projects WHERE id = $1', [project.id]);
    logAudit({ userId: req.session.userId ?? null, action: 'PROJECT_DELETED' as any, projectKey: key, detail: { projectId: project.id, name_th: project.name_th } });
    sendSuccess(res, { message: 'ลบโปรเจกต์สำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;