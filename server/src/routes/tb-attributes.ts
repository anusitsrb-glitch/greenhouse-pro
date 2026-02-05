/**
 * ThingsBoard Attributes Setter
 *
 * POST /api/tb/attributes
 * Body: { project, gh, attributes, scope? }
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { tbService } from '../services/thingsboard.js';

const bodySchema = z.object({
  project: z.string().min(1),
  gh: z.string().min(1),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  scope: z.enum(['SHARED_SCOPE', 'SERVER_SCOPE']).optional(),
});

function hasProjectAccess(userId: number, userRole: string, projectKey: string): boolean {
  if (userRole === 'admin' || userRole === 'superadmin') return true;

  const access = db.prepare(`
    SELECT 1 FROM user_project_access upa
    JOIN projects p ON upa.project_id = p.id
    WHERE upa.user_id = ? AND p.key = ?
  `).get(userId, projectKey);

  return !!access;
}

export async function setAttributesHandler(req: Request, res: Response) {
  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const { project, gh, attributes, scope } = parsed.data;

    const userId = req.session.userId!;
    const role = req.session.role!;

    if (!hasProjectAccess(userId, role, project)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403);
      return;
    }

    await tbService.setAttributes(project, gh, attributes, scope ?? 'SHARED_SCOPE');

    sendSuccess(res, {
      ok: true,
      project,
      gh,
      scope: scope ?? 'SHARED_SCOPE',
      attributes,
    });
  } catch (error) {
    console.error('Error setting attributes:', error);
    const msg = error instanceof Error ? error.message : ThaiErrors.TB_CONNECTION_ERROR;
    sendError(res, msg, 502);
  }
}