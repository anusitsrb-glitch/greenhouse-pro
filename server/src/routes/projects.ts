import { Router, Request, Response } from 'express';
import { query } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function isAdminRole(role?: string): boolean {
  return role === 'admin' || role === 'superadmin';
}

// GET /api/projects
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    const isAdmin = isAdminRole(req.session.role);

    let result;
    if (isAdmin) {
      result = await query(`
        SELECT p.id, p.key, p.name_th, p.status,
          COUNT(g.id) as greenhouse_count,
          SUM(CASE WHEN g.status = 'ready' THEN 1 ELSE 0 END) as ready_greenhouse_count
        FROM projects p
        LEFT JOIN greenhouses g ON p.id = g.project_id
        GROUP BY p.id ORDER BY p.created_at ASC
      `);
    } else {
      result = await query(`
        SELECT p.id, p.key, p.name_th, p.status,
          COUNT(g.id) as greenhouse_count,
          SUM(CASE WHEN g.status = 'ready' THEN 1 ELSE 0 END) as ready_greenhouse_count
        FROM projects p
        JOIN user_project_access upa ON p.id = upa.project_id
        LEFT JOIN greenhouses g ON p.id = g.project_id
        WHERE upa.user_id = $1
        GROUP BY p.id ORDER BY p.created_at ASC
      `, [userId]);
    }

    const formatted = result.rows.map((p: any) => ({
      id: p.id, key: p.key, nameTh: p.name_th, status: p.status,
      statusText: p.status === 'ready' ? 'พร้อมใช้งาน' : 'กำลังพัฒนา',
      greenhouseCount: parseInt(p.greenhouse_count) || 0,
      readyGreenhouseCount: parseInt(p.ready_greenhouse_count) || 0,
      hasAccess: true,
    }));

    sendSuccess(res, { projects: formatted });
  } catch (error) {
    console.error('Error listing projects:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// GET /api/projects/:projectKey
router.get('/:projectKey', async (req: Request, res: Response) => {
  try {
    const { projectKey } = req.params;
    const userId = req.session.userId;
    const isAdmin = isAdminRole(req.session.role);

    const projectRes = await query(`SELECT id, key, name_th, status FROM projects WHERE key = $1`, [projectKey]);
    const project = projectRes.rows[0];
    if (!project) { sendError(res, ThaiErrors.PROJECT_NOT_FOUND, 404); return; }

    if (!isAdmin) {
      const access = await query(`SELECT 1 FROM user_project_access WHERE user_id = $1 AND project_id = $2`, [userId, project.id]);
      if (access.rows.length === 0) { sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403); return; }
    }

    sendSuccess(res, {
      project: {
        id: project.id, key: project.key, nameTh: project.name_th, status: project.status,
        statusText: project.status === 'ready' ? 'พร้อมใช้งาน' : 'กำลังพัฒนา',
      },
    });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// GET /api/projects/:projectKey/greenhouses
router.get('/:projectKey/greenhouses', async (req: Request, res: Response) => {
  try {
    const { projectKey } = req.params;
    const userId = req.session.userId;
    const isAdmin = isAdminRole(req.session.role);

    const projectRes = await query(`SELECT id, key, name_th, status FROM projects WHERE key = $1`, [projectKey]);
    const project = projectRes.rows[0];
    if (!project) { sendError(res, ThaiErrors.PROJECT_NOT_FOUND, 404); return; }

    if (!isAdmin) {
      const access = await query(`SELECT 1 FROM user_project_access WHERE user_id = $1 AND project_id = $2`, [userId, project.id]);
      if (access.rows.length === 0) { sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403); return; }
    }

    const ghRes = await query(`
      SELECT id, gh_key, name_th, status, tb_device_id, device_status
      FROM greenhouses WHERE project_id = $1
      ORDER BY CAST(REGEXP_REPLACE(gh_key, '[^0-9]', '', 'g') AS INTEGER) ASC
    `, [project.id]);

    const formatted = ghRes.rows.map((g: any) => ({
      id: g.id, ghKey: g.gh_key, nameTh: g.name_th, status: g.status,
      statusText: g.status === 'ready' ? 'พร้อมใช้งาน' : 'กำลังพัฒนา',
      hasDevice: !!g.tb_device_id,
      deviceStatus: g.device_status ?? undefined,
      deviceId: isAdmin ? g.tb_device_id : undefined,
    }));

    sendSuccess(res, {
      project: { key: project.key, nameTh: project.name_th, status: project.status },
      greenhouses: formatted,
    });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// GET /api/projects/:projectKey/greenhouses/:ghKey
router.get('/:projectKey/greenhouses/:ghKey', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const userId = req.session.userId;
    const isAdmin = isAdminRole(req.session.role);

    const result = await query(`
      SELECT g.id, g.gh_key, g.name_th, g.status, g.tb_device_id, g.device_status,
        p.id as project_id, p.key as project_key, p.name_th as project_name, p.status as project_status
      FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = $1 AND g.gh_key = $2
    `, [projectKey, ghKey]);
    const g = result.rows[0];
    if (!g) { sendError(res, ThaiErrors.GREENHOUSE_NOT_FOUND, 404); return; }

    if (!isAdmin) {
      const access = await query(`SELECT 1 FROM user_project_access WHERE user_id = $1 AND project_id = $2`, [userId, g.project_id]);
      if (access.rows.length === 0) { sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403); return; }
    }

    sendSuccess(res, {
      greenhouse: {
        id: g.id, ghKey: g.gh_key, nameTh: g.name_th, status: g.status,
        statusText: g.status === 'ready' ? 'พร้อมใช้งาน' : 'กำลังพัฒนา',
        hasDevice: !!g.tb_device_id,
        deviceStatus: g.device_status ?? undefined,
        deviceId: isAdmin ? g.tb_device_id : undefined,
      },
      project: { key: g.project_key, nameTh: g.project_name, status: g.project_status },
    });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;