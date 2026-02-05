import { Router, Request, Response } from 'express';
import { db } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

/**
 * Helper: treat admin + superadmin as admin
 */
function isAdminRole(role?: string): boolean {
  return role === 'admin' || role === 'superadmin';
}

/**
 * GET /api/projects
 * List projects accessible to current user
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    const userRole = req.session.role;
    const isAdmin = isAdminRole(userRole);

    let projects: any[];

    if (isAdmin) {
      // Admin sees all projects
      projects = db.prepare(`
        SELECT 
          p.id, p.key, p.name_th, p.status,
          COUNT(g.id) as greenhouse_count,
          SUM(CASE WHEN g.status = 'ready' THEN 1 ELSE 0 END) as ready_greenhouse_count
        FROM projects p
        LEFT JOIN greenhouses g ON p.id = g.project_id
        GROUP BY p.id
        ORDER BY p.created_at ASC
      `).all() as any[];
    } else {
      // Non-admin sees only accessible projects
      projects = db.prepare(`
        SELECT 
          p.id, p.key, p.name_th, p.status,
          COUNT(g.id) as greenhouse_count,
          SUM(CASE WHEN g.status = 'ready' THEN 1 ELSE 0 END) as ready_greenhouse_count
        FROM projects p
        JOIN user_project_access upa ON p.id = upa.project_id
        LEFT JOIN greenhouses g ON p.id = g.project_id
        WHERE upa.user_id = ?
        GROUP BY p.id
        ORDER BY p.created_at ASC
      `).all(userId) as any[];
    }

    const formatted = projects.map((p: any) => ({
      id: p.id,
      key: p.key,
      nameTh: p.name_th,
      status: p.status,
      statusText: p.status === 'ready' ? 'พร้อมใช้งาน' : 'กำลังพัฒนา',
      greenhouseCount: p.greenhouse_count,
      readyGreenhouseCount: p.ready_greenhouse_count,
      hasAccess: true,
    }));

    sendSuccess(res, { projects: formatted });
  } catch (error) {
    console.error('Error listing projects:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/projects/:projectKey
 * Get single project details (if user has access)
 */
router.get('/:projectKey', (req: Request, res: Response) => {
  try {
    const { projectKey } = req.params;
    const userId = req.session.userId;
    const userRole = req.session.role;
    const isAdmin = isAdminRole(userRole);

    // Check project exists
    const project = db.prepare(`
      SELECT id, key, name_th, status
      FROM projects WHERE key = ?
    `).get(projectKey) as { id: number; key: string; name_th: string; status: string } | undefined;

    if (!project) {
      sendError(res, ThaiErrors.PROJECT_NOT_FOUND, 404);
      return;
    }

    // Check access (admin/superadmin has access to all)
    if (!isAdmin) {
      const hasAccess = db.prepare(`
        SELECT 1 FROM user_project_access WHERE user_id = ? AND project_id = ?
      `).get(userId, project.id);

      if (!hasAccess) {
        sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403);
        return;
      }
    }

    sendSuccess(res, {
      project: {
        id: project.id,
        key: project.key,
        nameTh: project.name_th,
        status: project.status,
        statusText: project.status === 'ready' ? 'พร้อมใช้งาน' : 'กำลังพัฒนา',
      },
    });
  } catch (error) {
    console.error('Error getting project:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/projects/:projectKey/greenhouses
 * List greenhouses in a project (if user has access)
 */
router.get('/:projectKey/greenhouses', (req: Request, res: Response) => {
  try {
    const { projectKey } = req.params;
    const userId = req.session.userId;
    const userRole = req.session.role;
    const isAdmin = isAdminRole(userRole);
    const canSeeDeviceId = isAdmin;

    // Check project exists
    const project = db.prepare(`
      SELECT id, key, name_th, status
      FROM projects WHERE key = ?
    `).get(projectKey) as { id: number; key: string; name_th: string; status: string } | undefined;

    if (!project) {
      sendError(res, ThaiErrors.PROJECT_NOT_FOUND, 404);
      return;
    }

    // Check access (admin/superadmin has access to all)
    if (!isAdmin) {
      const hasAccess = db.prepare(`
        SELECT 1 FROM user_project_access WHERE user_id = ? AND project_id = ?
      `).get(userId, project.id);

      if (!hasAccess) {
        sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403);
        return;
      }
    }

    // Get greenhouses (✅ include device_status)
    const greenhouses = db.prepare(`
      SELECT 
        id,
        gh_key,
        name_th,
        status,
        tb_device_id,
        device_status
      FROM greenhouses
      WHERE project_id = ?
      ORDER BY CAST(REPLACE(gh_key,'greenhouse','') AS INTEGER) ASC

    `).all(project.id) as any[];

    const formatted = greenhouses.map((g: any) => ({
      id: g.id,
      ghKey: g.gh_key,
      nameTh: g.name_th,
      status: g.status,
      statusText: g.status === 'ready' ? 'พร้อมใช้งาน' : 'กำลังพัฒนา',
      hasDevice: !!g.tb_device_id,

      // ✅ key that the client uses
      deviceStatus: g.device_status ?? undefined,

      // Don't expose actual device ID to non-admin
      deviceId: canSeeDeviceId ? g.tb_device_id : undefined,
    }));

    sendSuccess(res, {
      project: {
        key: project.key,
        nameTh: project.name_th,
        status: project.status,
      },
      greenhouses: formatted,
    });
  } catch (error) {
    console.error('Error listing greenhouses:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/projects/:projectKey/greenhouses/:ghKey
 * Get single greenhouse details
 */
router.get('/:projectKey/greenhouses/:ghKey', (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const userId = req.session.userId;
    const userRole = req.session.role;
    const isAdmin = isAdminRole(userRole);

    // Check project exists and get greenhouse
    const result = db.prepare(`
      SELECT 
        g.id,
        g.gh_key,
        g.name_th,
        g.status,
        g.tb_device_id,
        g.device_status,
        p.id as project_id,
        p.key as project_key,
        p.name_th as project_name,
        p.status as project_status
      FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ?
    `).get(projectKey, ghKey) as any | undefined;

    if (!result) {
      sendError(res, ThaiErrors.GREENHOUSE_NOT_FOUND, 404);
      return;
    }

    // Check access (admin/superadmin has access to all)
    if (!isAdmin) {
      const hasAccess = db.prepare(`
        SELECT 1 FROM user_project_access WHERE user_id = ? AND project_id = ?
      `).get(userId, result.project_id);

      if (!hasAccess) {
        sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403);
        return;
      }
    }

    sendSuccess(res, {
      greenhouse: {
        id: result.id,
        ghKey: result.gh_key,
        nameTh: result.name_th,
        status: result.status,
        statusText: result.status === 'ready' ? 'พร้อมใช้งาน' : 'กำลังพัฒนา',
        hasDevice: !!result.tb_device_id,

        // ✅ include status for detail too (optional but nice)
        deviceStatus: result.device_status ?? undefined,

        deviceId: isAdmin ? result.tb_device_id : undefined,
      },
      project: {
        key: result.project_key,
        nameTh: result.project_name,
        status: result.project_status,
      },
    });
  } catch (error) {
    console.error('Error getting greenhouse:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;
