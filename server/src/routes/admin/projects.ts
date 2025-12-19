import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../../utils/response.js';
import { requireAdmin } from '../../middleware/auth.js';
import { logAudit, AuditActions } from '../../utils/audit.js';
import { z } from 'zod';
import type { Project, ProjectStatus } from '../../types/index.js';

const router = Router();

// Apply admin middleware to all routes
router.use(requireAdmin);

// Validation schemas
const createProjectSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, 'Key must be lowercase alphanumeric with underscores'),
  name_th: z.string().min(1).max(100),
  status: z.enum(['ready', 'developing']).optional().default('developing'),
  tb_base_url: z.string().url(),
  tb_username: z.string().min(1),
  tb_password: z.string().min(1),
});

const updateProjectSchema = z.object({
  name_th: z.string().min(1).max(100).optional(),
  status: z.enum(['ready', 'developing']).optional(),
  tb_base_url: z.string().url().optional(),
  tb_username: z.string().min(1).optional(),
  tb_password: z.string().min(1).optional(),
});

/**
 * GET /api/admin/projects
 * List all projects with greenhouse counts
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const projects = db.prepare(`
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
    `).all() as (Project & { greenhouse_count: number; ready_greenhouse_count: number })[];
    
    const formattedProjects = projects.map(p => ({
      id: p.id,
      key: p.key,
      nameTh: p.name_th,
      status: p.status,
      tbBaseUrl: p.tb_base_url,
      tbUsername: p.tb_username,
      // Don't expose password
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      greenhouseCount: p.greenhouse_count,
      readyGreenhouseCount: p.ready_greenhouse_count,
    }));
    
    sendSuccess(res, { projects: formattedProjects });
  } catch (error) {
    console.error('Error listing projects:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/admin/projects/:key
 * Get single project with all greenhouses
 */
router.get('/:key', (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    
    const project = db.prepare(`
      SELECT id, key, name_th, status, tb_base_url, tb_username, tb_password, created_at, updated_at
      FROM projects WHERE key = ?
    `).get(key) as Project | undefined;
    
    if (!project) {
      sendError(res, ThaiErrors.PROJECT_NOT_FOUND, 404);
      return;
    }
    
    const greenhouses = db.prepare(`
      SELECT id, gh_key, name_th, status, tb_device_id, created_at, updated_at
      FROM greenhouses WHERE project_id = ?
      ORDER BY gh_key ASC
    `).all(project.id);
    
    sendSuccess(res, {
      project: {
        id: project.id,
        key: project.key,
        nameTh: project.name_th,
        status: project.status,
        tbBaseUrl: project.tb_base_url,
        tbUsername: project.tb_username,
        tbPassword: project.tb_password, // Admin can see password
        createdAt: project.created_at,
        updatedAt: project.updated_at,
      },
      greenhouses: greenhouses.map((g: any) => ({
        id: g.id,
        ghKey: g.gh_key,
        nameTh: g.name_th,
        status: g.status,
        deviceId: g.tb_device_id,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
      })),
    });
  } catch (error) {
    console.error('Error getting project:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/admin/projects
 * Create new project
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    
    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT + ': ' + parsed.error.errors[0]?.message, 400);
      return;
    }
    
    const { key, name_th, status, tb_base_url, tb_username, tb_password } = parsed.data;
    
    // Check if key exists
    const existing = db.prepare('SELECT id FROM projects WHERE key = ?').get(key);
    if (existing) {
      sendError(res, 'Key โปรเจกต์นี้ถูกใช้แล้ว', 409);
      return;
    }
    
    const result = db.prepare(`
      INSERT INTO projects (key, name_th, status, tb_base_url, tb_username, tb_password)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(key, name_th, status, tb_base_url, tb_username, tb_password);
    
    // Grant admin access to new project
    const adminUsers = db.prepare('SELECT id FROM users WHERE role = ?').all('admin') as { id: number }[];
    const insertAccess = db.prepare('INSERT OR IGNORE INTO user_project_access (user_id, project_id) VALUES (?, ?)');
    
    for (const admin of adminUsers) {
      insertAccess.run(admin.id, result.lastInsertRowid);
    }
    
    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.PROJECT_CREATED,
      projectKey: key,
      detail: { projectId: result.lastInsertRowid, name_th },
    });
    
    sendSuccess(res, {
      project: {
        id: result.lastInsertRowid,
        key,
        nameTh: name_th,
        status,
      },
      message: 'สร้างโปรเจกต์สำเร็จ',
    }, undefined, 201);
  } catch (error) {
    console.error('Error creating project:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * PUT /api/admin/projects/:key
 * Update project
 */
router.put('/:key', (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    
    const parsed = updateProjectSchema.safeParse(req.body);
    
    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }
    
    const project = db.prepare('SELECT id FROM projects WHERE key = ?').get(key) as { id: number } | undefined;
    
    if (!project) {
      sendError(res, ThaiErrors.PROJECT_NOT_FOUND, 404);
      return;
    }
    
    const updates: string[] = [];
    const values: (string | number)[] = [];
    
    if (parsed.data.name_th !== undefined) {
      updates.push('name_th = ?');
      values.push(parsed.data.name_th);
    }
    
    if (parsed.data.status !== undefined) {
      updates.push('status = ?');
      values.push(parsed.data.status);
    }
    
    if (parsed.data.tb_base_url !== undefined) {
      updates.push('tb_base_url = ?');
      values.push(parsed.data.tb_base_url);
    }
    
    if (parsed.data.tb_username !== undefined) {
      updates.push('tb_username = ?');
      values.push(parsed.data.tb_username);
    }
    
    if (parsed.data.tb_password !== undefined) {
      updates.push('tb_password = ?');
      values.push(parsed.data.tb_password);
    }
    
    if (updates.length === 0) {
      sendError(res, 'ไม่มีข้อมูลที่จะอัปเดต', 400);
      return;
    }
    
    updates.push('updated_at = datetime("now")');
    values.push(project.id);
    
    db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.PROJECT_UPDATED,
      projectKey: key,
      detail: { updates: Object.keys(parsed.data) },
    });
    
    sendSuccess(res, { message: 'อัปเดตโปรเจกต์สำเร็จ' });
  } catch (error) {
    console.error('Error updating project:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * DELETE /api/admin/projects/:key
 * Delete project (and all associated greenhouses)
 */
router.delete('/:key', (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    
    const project = db.prepare('SELECT id, name_th FROM projects WHERE key = ?')
      .get(key) as { id: number; name_th: string } | undefined;
    
    if (!project) {
      sendError(res, ThaiErrors.PROJECT_NOT_FOUND, 404);
      return;
    }
    
    // Delete project (cascades to greenhouses and user_project_access)
    db.prepare('DELETE FROM projects WHERE id = ?').run(project.id);
    
    logAudit({
      userId: req.session.userId ?? null,
      action: 'PROJECT_DELETED',
      projectKey: key,
      detail: { projectId: project.id, name_th: project.name_th },
    });
    
    sendSuccess(res, { message: 'ลบโปรเจกต์สำเร็จ' });
  } catch (error) {
    console.error('Error deleting project:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;
