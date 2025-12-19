/**
 * Automation Rules and Scenes Routes
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../../utils/response.js';
import { requireAdmin } from '../../middleware/auth.js';
import { logAudit, AuditActions } from '../../utils/audit.js';

const router = Router();

// Helper to get greenhouse ID
function getGreenhouseId(projectKey: string, ghKey: string): number | null {
  const greenhouse = db.prepare(`
    SELECT g.id FROM greenhouses g
    JOIN projects p ON g.project_id = p.id
    WHERE p.key = ? AND g.gh_key = ?
  `).get(projectKey, ghKey) as any;
  return greenhouse?.id || null;
}

// ============================================================
// AUTOMATION RULES
// ============================================================

router.get('/automation/:projectKey/:ghKey', requireAdmin, (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const ghId = getGreenhouseId(projectKey, ghKey);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const rules = db.prepare(`
      SELECT * FROM automation_rules WHERE greenhouse_id = ? ORDER BY created_at DESC
    `).all(ghId);

    // Parse JSON fields
    const parsed = rules.map((r: any) => ({
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

router.post('/automation/:projectKey/:ghKey', requireAdmin, (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const { name, description, trigger_type, trigger_config, conditions, actions } = req.body;

    const ghId = getGreenhouseId(projectKey, ghKey);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const result = db.prepare(`
      INSERT INTO automation_rules (greenhouse_id, name, description, trigger_type, trigger_config, conditions, actions, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ghId, name, description || null, trigger_type,
      JSON.stringify(trigger_config || {}),
      JSON.stringify(conditions || []),
      JSON.stringify(actions || []),
      req.session.userId
    );

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.CREATED, projectKey, ghKey, detail: { entity: 'automation_rule', name } });
    sendSuccess(res, { id: result.lastInsertRowid, message: 'สร้างกฎสำเร็จ' });
  } catch (error) {
    console.error('Error creating automation rule:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.put('/automation/:projectKey/:ghKey/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, trigger_type, trigger_config, conditions, actions } = req.body;

    db.prepare(`
      UPDATE automation_rules SET name = ?, description = ?, trigger_type = ?, trigger_config = ?, conditions = ?, actions = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name, description || null, trigger_type,
      JSON.stringify(trigger_config || {}),
      JSON.stringify(conditions || []),
      JSON.stringify(actions || []),
      id
    );

    sendSuccess(res, { message: 'อัปเดตสำเร็จ' });
  } catch (error) {
    console.error('Error updating automation rule:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.put('/automation/:projectKey/:ghKey/:id/toggle', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    db.prepare(`UPDATE automation_rules SET is_active = NOT is_active, updated_at = datetime('now') WHERE id = ?`).run(id);
    sendSuccess(res, { message: 'สลับสถานะสำเร็จ' });
  } catch (error) {
    console.error('Error toggling automation rule:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.delete('/automation/:projectKey/:ghKey/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM automation_rules WHERE id = ?').run(id);
    sendSuccess(res, { message: 'ลบสำเร็จ' });
  } catch (error) {
    console.error('Error deleting automation rule:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// SCENES / PRESETS
// ============================================================

router.get('/scenes/:projectKey/:ghKey', requireAdmin, (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const ghId = getGreenhouseId(projectKey, ghKey);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const scenes = db.prepare(`
      SELECT * FROM control_scenes WHERE greenhouse_id = ? ORDER BY sort_order, created_at
    `).all(ghId);

    // Parse JSON fields
    const parsed = scenes.map((s: any) => ({
      ...s,
      actions: JSON.parse(s.actions || '[]'),
    }));

    sendSuccess(res, { scenes: parsed });
  } catch (error) {
    console.error('Error fetching scenes:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/scenes/:projectKey/:ghKey', requireAdmin, (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const { name, description, icon, color, actions } = req.body;

    const ghId = getGreenhouseId(projectKey, ghKey);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const result = db.prepare(`
      INSERT INTO control_scenes (greenhouse_id, name, description, icon, color, actions, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(ghId, name, description || null, icon || 'Zap', color || '#3b82f6', JSON.stringify(actions || []), req.session.userId);

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.CREATED, projectKey, ghKey, detail: { entity: 'scene', name } });
    sendSuccess(res, { id: result.lastInsertRowid, message: 'สร้าง Scene สำเร็จ' });
  } catch (error) {
    console.error('Error creating scene:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.put('/scenes/:projectKey/:ghKey/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, icon, color, actions } = req.body;

    db.prepare(`
      UPDATE control_scenes SET name = ?, description = ?, icon = ?, color = ?, actions = ?
      WHERE id = ?
    `).run(name, description || null, icon || 'Zap', color || '#3b82f6', JSON.stringify(actions || []), id);

    sendSuccess(res, { message: 'อัปเดตสำเร็จ' });
  } catch (error) {
    console.error('Error updating scene:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.delete('/scenes/:projectKey/:ghKey/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM control_scenes WHERE id = ?').run(id);
    sendSuccess(res, { message: 'ลบสำเร็จ' });
  } catch (error) {
    console.error('Error deleting scene:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/scenes/:projectKey/:ghKey/:id/execute', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey, id } = req.params;

    const scene = db.prepare('SELECT * FROM control_scenes WHERE id = ?').get(id) as any;
    if (!scene) { sendError(res, 'ไม่พบ Scene', 404); return; }

    const actions = JSON.parse(scene.actions || '[]');

    // Get ThingsBoard service and execute actions
    const { sendRpcCommand, getProject } = await import('../../services/thingsboard.js');
    const project = getProject(projectKey);
    if (!project) { sendError(res, 'ไม่พบโปรเจกต์', 404); return; }

    const greenhouse = db.prepare(`
      SELECT tb_device_id FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ?
    `).get(projectKey, ghKey) as any;

    if (!greenhouse?.tb_device_id) { sendError(res, 'ไม่พบ Device ID', 404); return; }

    // Execute all actions
    for (const action of actions) {
      const method = `set${action.control_key.charAt(0).toUpperCase() + action.control_key.slice(1)}`;
      await sendRpcCommand(project, greenhouse.tb_device_id, method, { value: action.action === 'on' });

      // Log to control history
      db.prepare(`
        INSERT INTO control_history (greenhouse_id, control_key, control_name, action, value, source, source_id, user_id)
        VALUES (?, ?, ?, ?, ?, 'scene', ?, ?)
      `).run(scene.greenhouse_id, action.control_key, action.control_key, action.action, action.action === 'on' ? '1' : '0', scene.id, req.session.userId);
    }

    logAudit({ userId: req.session.userId ?? null, action: 'SCENE_EXECUTED', projectKey, ghKey, detail: { scene_id: id, scene_name: scene.name } });
    sendSuccess(res, { message: `ทำ "${scene.name}" สำเร็จ`, executed: actions.length });
  } catch (error) {
    console.error('Error executing scene:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// CONTROL HISTORY
// ============================================================

router.get('/control-history/:projectKey/:ghKey', requireAdmin, (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const { limit = '100' } = req.query;

    const ghId = getGreenhouseId(projectKey, ghKey);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const history = db.prepare(`
      SELECT ch.*, u.username
      FROM control_history ch
      LEFT JOIN users u ON ch.user_id = u.id
      WHERE ch.greenhouse_id = ?
      ORDER BY ch.created_at DESC
      LIMIT ?
    `).all(ghId, parseInt(limit as string));

    sendSuccess(res, { history });
  } catch (error) {
    console.error('Error fetching control history:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;
