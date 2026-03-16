/**
 * Automation Rules and Scenes Routes
 */

import { Router, Request, Response } from 'express';
import { query } from '../../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../../utils/response.js';
import { requireAdmin } from '../../middleware/auth.js';
import { logAudit, AuditActions } from '../../utils/audit.js';

const router = Router();

// Helper to get greenhouse ID
async function getGreenhouseId(projectKey: string, ghKey: string): Promise<number | null> {
  const result = await query(`
    SELECT g.id FROM greenhouses g
    JOIN projects p ON g.project_id = p.id
    WHERE p.key = $1 AND g.gh_key = $2
  `, [projectKey, ghKey]);
  return result.rows[0]?.id || null;
}

// ============================================================
// AUTOMATION RULES
// ============================================================

router.get('/automation/:projectKey/:ghKey', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const ghId = await getGreenhouseId(projectKey, ghKey);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const result = await query(`
      SELECT * FROM automation_rules WHERE greenhouse_id = $1 ORDER BY created_at DESC
    `, [ghId]);

    const parsed = result.rows.map((r: any) => ({
      ...r,
      trigger_config: JSON.parse(r.trigger_config || '{}'),
      conditions: JSON.parse(r.conditions || '[]'),
      actions: JSON.parse(r.actions || '[]'),
    }));

    sendSuccess(res, { rules: parsed });
  } catch (error) {
    console.error('Error fetching automation rules:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/automation/:projectKey/:ghKey', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const { name, description, trigger_type, trigger_config, conditions, actions } = req.body;

    const ghId = await getGreenhouseId(projectKey, ghKey);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const result = await query(`
      INSERT INTO automation_rules (greenhouse_id, name, description, trigger_type, trigger_config, conditions, actions, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      ghId, name, description || null, trigger_type,
      JSON.stringify(trigger_config || {}),
      JSON.stringify(conditions || []),
      JSON.stringify(actions || []),
      req.session.userId,
    ]);

    await logAudit({ userId: req.session.userId ?? null, action: AuditActions.CREATED, projectKey, ghKey, detail: { entity: 'automation_rule', name } });
    sendSuccess(res, { id: result.rows[0].id, message: 'สร้างกฎสำเร็จ' });
  } catch (error) {
    console.error('Error creating automation rule:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.put('/automation/:projectKey/:ghKey/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, trigger_type, trigger_config, conditions, actions } = req.body;

    await query(`
      UPDATE automation_rules SET name = $1, description = $2, trigger_type = $3, trigger_config = $4, conditions = $5, actions = $6, updated_at = now()::text
      WHERE id = $7
    `, [
      name, description || null, trigger_type,
      JSON.stringify(trigger_config || {}),
      JSON.stringify(conditions || []),
      JSON.stringify(actions || []),
      id,
    ]);

    sendSuccess(res, { message: 'อัปเดตสำเร็จ' });
  } catch (error) {
    console.error('Error updating automation rule:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.put('/automation/:projectKey/:ghKey/:id/toggle', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await query(`UPDATE automation_rules SET is_active = NOT is_active, updated_at = now()::text WHERE id = $1`, [id]);
    sendSuccess(res, { message: 'สลับสถานะสำเร็จ' });
  } catch (error) {
    console.error('Error toggling automation rule:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.delete('/automation/:projectKey/:ghKey/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM automation_rules WHERE id = $1', [id]);
    sendSuccess(res, { message: 'ลบสำเร็จ' });
  } catch (error) {
    console.error('Error deleting automation rule:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// SCENES / PRESETS
// ============================================================

router.get('/scenes/:projectKey/:ghKey', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const ghId = await getGreenhouseId(projectKey, ghKey);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const result = await query(`
      SELECT * FROM control_scenes WHERE greenhouse_id = $1 ORDER BY sort_order, created_at
    `, [ghId]);

    const parsed = result.rows.map((s: any) => ({
      ...s,
      actions: JSON.parse(s.actions || '[]'),
    }));

    sendSuccess(res, { scenes: parsed });
  } catch (error) {
    console.error('Error fetching scenes:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/scenes/:projectKey/:ghKey', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const { name, description, icon, color, actions } = req.body;

    const ghId = await getGreenhouseId(projectKey, ghKey);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const result = await query(`
      INSERT INTO control_scenes (greenhouse_id, name, description, icon, color, actions, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [ghId, name, description || null, icon || 'Zap', color || '#3b82f6', JSON.stringify(actions || []), req.session.userId]);

    await logAudit({ userId: req.session.userId ?? null, action: AuditActions.CREATED, projectKey, ghKey, detail: { entity: 'scene', name } });
    sendSuccess(res, { id: result.rows[0].id, message: 'สร้าง Scene สำเร็จ' });
  } catch (error) {
    console.error('Error creating scene:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.put('/scenes/:projectKey/:ghKey/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, icon, color, actions } = req.body;

    await query(`
      UPDATE control_scenes SET name = $1, description = $2, icon = $3, color = $4, actions = $5
      WHERE id = $6
    `, [name, description || null, icon || 'Zap', color || '#3b82f6', JSON.stringify(actions || []), id]);

    sendSuccess(res, { message: 'อัปเดตสำเร็จ' });
  } catch (error) {
    console.error('Error updating scene:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.delete('/scenes/:projectKey/:ghKey/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM control_scenes WHERE id = $1', [id]);
    sendSuccess(res, { message: 'ลบสำเร็จ' });
  } catch (error) {
    console.error('Error deleting scene:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/scenes/:projectKey/:ghKey/:id/execute', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey, id } = req.params;

    const sceneResult = await query('SELECT * FROM control_scenes WHERE id = $1', [id]);
    const scene = sceneResult.rows[0] as any;
    if (!scene) { sendError(res, 'ไม่พบ Scene', 404); return; }

    const actions = JSON.parse(scene.actions || '[]');

    const { sendRpcCommand, getProject } = await import('../../services/thingsboard.js');
    const project = await getProject(projectKey);
    if (!project) { sendError(res, 'ไม่พบโปรเจกต์', 404); return; }

    const ghResult = await query(`
      SELECT tb_device_id FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = $1 AND g.gh_key = $2
    `, [projectKey, ghKey]);
    const greenhouse = ghResult.rows[0] as any;

    if (!greenhouse?.tb_device_id) { sendError(res, 'ไม่พบ Device ID', 404); return; }

    for (const action of actions) {
      const method = `set${action.control_key.charAt(0).toUpperCase() + action.control_key.slice(1)}`;
      await sendRpcCommand(projectKey, ghKey, method, { value: action.action === 'on' });

      await query(`
        INSERT INTO control_history (greenhouse_id, control_key, control_name, action, value, source, source_id, user_id)
        VALUES ($1, $2, $3, $4, $5, 'scene', $6, $7)
      `, [
        scene.greenhouse_id,
        action.control_key,
        action.control_key,
        action.action,
        action.action === 'on' ? '1' : '0',
        scene.id,
        req.session.userId,
      ]);
    }

    await logAudit({ userId: req.session.userId ?? null, action: 'SCENE_EXECUTED', projectKey, ghKey, detail: { scene_id: id, scene_name: scene.name } });
    sendSuccess(res, { message: `ทำ "${scene.name}" สำเร็จ`, executed: actions.length });
  } catch (error) {
    console.error('Error executing scene:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// CONTROL HISTORY
// ============================================================

router.get('/control-history/:projectKey/:ghKey', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const { limit = '100' } = req.query;

    const ghId = await getGreenhouseId(projectKey, ghKey);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const result = await query(`
      SELECT ch.*, u.username
      FROM control_history ch
      LEFT JOIN users u ON ch.user_id = u.id
      WHERE ch.greenhouse_id = $1
      ORDER BY ch.created_at DESC
      LIMIT $2
    `, [ghId, parseInt(limit as string)]);

    sendSuccess(res, { history: result.rows });
  } catch (error) {
    console.error('Error fetching control history:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;