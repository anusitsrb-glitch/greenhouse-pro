/**
 * ThingsBoard Attributes Setter (Enhanced)
 *
 * POST /api/tb/attributes
 * Body: { project, gh, attributes, scope? }
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { tbService } from '../services/thingsboard.js';
import { notificationService } from '../services/notificationService.js';

const bodySchema = z.object({
  project: z.string().min(1),
  gh: z.string().min(1),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  scope: z.enum(['SHARED_SCOPE', 'SERVER_SCOPE']).optional(),
});

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
    return result.rows[0]?.id || null;
  } catch {
    return null;
  }
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

    if (!await hasProjectAccess(userId, role, project)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403);
      return;
    }

    await tbService.setAttributes(project, gh, attributes, scope ?? 'SHARED_SCOPE');

    // เช็คว่ามีการเปลี่ยน auto mode หรือไม่
    const autoModeKeys = Object.keys(attributes).filter(key =>
      key.includes('_auto') ||
      key.includes('auto_mode') ||
      key.includes('_time') ||
      key.includes('_condition')
    );

    if (autoModeKeys.length > 0) {
      const greenhouseId = await getGreenhouseId(project, gh);

      if (greenhouseId) {
        const infoResult = await query(`
          SELECT g.name_th as greenhouse_name, p.id as project_id, u.username
          FROM greenhouses g
          JOIN projects p ON g.project_id = p.id
          LEFT JOIN users u ON u.id = $1
          WHERE g.id = $2
        `, [userId, greenhouseId]);
        const info = infoResult.rows[0] as any;

        if (info) {
          const changedSettings = autoModeKeys.map(key => {
            const value = attributes[key];
            if (key.includes('_auto')) return value ? 'เปิดโหมดอัตโนมัติ' : 'ปิดโหมดอัตโนมัติ';
            if (key.includes('_time')) return `ตั้งเวลา: ${value}`;
            if (key.includes('_condition')) return `ตั้งเงื่อนไข: ${value}`;
            return `เปลี่ยน ${key}`;
          });

          notificationService.create({
            type: 'auto_mode_changed',
            severity: 'info',
            title: `เปลี่ยนการตั้งค่า Auto`,
            message: `${info.username || 'ระบบ'} ${changedSettings[0]} ที่ ${info.greenhouse_name}`,
            metadata: {
              changes: autoModeKeys,
              values: attributes,
              greenhouseName: info.greenhouse_name,
              userName: info.username,
            },
            projectId: info.project_id,
            greenhouseId,
            autoDismiss: true,
            dismissAfterSeconds: 10,
          });

          console.log(`🔔 Auto mode changed notification created`);
        }
      }
    }

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