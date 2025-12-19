/**
 * Control Configuration Routes
 * Manage dynamic relay/motor configurations per greenhouse
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../../utils/response.js';
import { requireAdmin } from '../../middleware/auth.js';
import { logAudit, AuditActions } from '../../utils/audit.js';
import { z } from 'zod';

const router = Router();
router.use(requireAdmin);

// ============================================================
// Validation Schemas
// ============================================================

const controlConfigSchema = z.object({
  control_key: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/),
  name_th: z.string().min(1).max(100),
  control_type: z.enum(['relay', 'motor', 'dimmer', 'custom']),
  rpc_method: z.string().min(1).max(100),
  attribute_key: z.string().min(1).max(100),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  auto_mode_key: z.string().max(100).optional().nullable(),
  timer_on_key: z.string().max(100).optional().nullable(),
  timer_off_key: z.string().max(100).optional().nullable(),
  sort_order: z.number().optional(),
  is_active: z.boolean().optional(),
});

// ============================================================
// Routes
// ============================================================

/**
 * GET /api/admin/controls/:projectKey/:ghKey
 * Get all control configs for a greenhouse
 */
router.get('/:projectKey/:ghKey', (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;

    const greenhouse = db.prepare(`
      SELECT g.id FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ?
    `).get(projectKey, ghKey) as { id: number } | undefined;

    if (!greenhouse) {
      sendError(res, 'ไม่พบโรงเรือน', 404);
      return;
    }

    const controls = db.prepare(`
      SELECT * FROM control_configs 
      WHERE greenhouse_id = ?
      ORDER BY sort_order, control_type, name_th
    `).all(greenhouse.id);

    sendSuccess(res, { controls });
  } catch (error) {
    console.error('Error fetching controls:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/admin/controls/:projectKey/:ghKey
 * Create new control config
 */
router.post('/:projectKey/:ghKey', (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const parsed = controlConfigSchema.safeParse(req.body);

    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const greenhouse = db.prepare(`
      SELECT g.id FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ?
    `).get(projectKey, ghKey) as { id: number } | undefined;

    if (!greenhouse) {
      sendError(res, 'ไม่พบโรงเรือน', 404);
      return;
    }

    const existing = db.prepare(`
      SELECT id FROM control_configs WHERE greenhouse_id = ? AND control_key = ?
    `).get(greenhouse.id, parsed.data.control_key);

    if (existing) {
      sendError(res, 'Control key นี้มีอยู่แล้ว', 400);
      return;
    }

    const result = db.prepare(`
      INSERT INTO control_configs (
        greenhouse_id, control_key, name_th, control_type, rpc_method, attribute_key,
        icon, color, auto_mode_key, timer_on_key, timer_off_key, sort_order, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      greenhouse.id,
      parsed.data.control_key,
      parsed.data.name_th,
      parsed.data.control_type,
      parsed.data.rpc_method,
      parsed.data.attribute_key,
      parsed.data.icon || 'Power',
      parsed.data.color || '#3b82f6',
      parsed.data.auto_mode_key || null,
      parsed.data.timer_on_key || null,
      parsed.data.timer_off_key || null,
      parsed.data.sort_order ?? 0,
      parsed.data.is_active !== false ? 1 : 0
    );

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.CONTROL_CREATED,
      projectKey,
      ghKey,
      detail: { controlKey: parsed.data.control_key, controlName: parsed.data.name_th },
    });

    sendSuccess(res, { 
      message: 'สร้าง Control สำเร็จ', 
      control: { id: result.lastInsertRowid } 
    });
  } catch (error) {
    console.error('Error creating control:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * PUT /api/admin/controls/:projectKey/:ghKey/:controlKey
 * Update control config
 */
router.put('/:projectKey/:ghKey/:controlKey', (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey, controlKey } = req.params;
    const parsed = controlConfigSchema.partial().safeParse(req.body);

    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const control = db.prepare(`
      SELECT cc.id FROM control_configs cc
      JOIN greenhouses g ON cc.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ? AND cc.control_key = ?
    `).get(projectKey, ghKey, controlKey) as { id: number } | undefined;

    if (!control) {
      sendError(res, 'ไม่พบ Control', 404);
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];

    const data = parsed.data;
    if (data.name_th !== undefined) { updates.push('name_th = ?'); values.push(data.name_th); }
    if (data.control_type !== undefined) { updates.push('control_type = ?'); values.push(data.control_type); }
    if (data.rpc_method !== undefined) { updates.push('rpc_method = ?'); values.push(data.rpc_method); }
    if (data.attribute_key !== undefined) { updates.push('attribute_key = ?'); values.push(data.attribute_key); }
    if (data.icon !== undefined) { updates.push('icon = ?'); values.push(data.icon); }
    if (data.color !== undefined) { updates.push('color = ?'); values.push(data.color); }
    if (data.auto_mode_key !== undefined) { updates.push('auto_mode_key = ?'); values.push(data.auto_mode_key); }
    if (data.timer_on_key !== undefined) { updates.push('timer_on_key = ?'); values.push(data.timer_on_key); }
    if (data.timer_off_key !== undefined) { updates.push('timer_off_key = ?'); values.push(data.timer_off_key); }
    if (data.sort_order !== undefined) { updates.push('sort_order = ?'); values.push(data.sort_order); }
    if (data.is_active !== undefined) { updates.push('is_active = ?'); values.push(data.is_active ? 1 : 0); }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(control.id);

      db.prepare(`
        UPDATE control_configs SET ${updates.join(', ')} WHERE id = ?
      `).run(...values);
    }

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.CONTROL_UPDATED,
      projectKey,
      ghKey,
      detail: { controlKey, changes: data },
    });

    sendSuccess(res, { message: 'บันทึก Control สำเร็จ' });
  } catch (error) {
    console.error('Error updating control:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * DELETE /api/admin/controls/:projectKey/:ghKey/:controlKey
 * Delete control config
 */
router.delete('/:projectKey/:ghKey/:controlKey', (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey, controlKey } = req.params;

    const control = db.prepare(`
      SELECT cc.id, cc.name_th FROM control_configs cc
      JOIN greenhouses g ON cc.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ? AND cc.control_key = ?
    `).get(projectKey, ghKey, controlKey) as { id: number; name_th: string } | undefined;

    if (!control) {
      sendError(res, 'ไม่พบ Control', 404);
      return;
    }

    db.prepare('DELETE FROM control_configs WHERE id = ?').run(control.id);

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.CONTROL_DELETED,
      projectKey,
      ghKey,
      detail: { controlKey, controlName: control.name_th },
    });

    sendSuccess(res, { message: 'ลบ Control สำเร็จ' });
  } catch (error) {
    console.error('Error deleting control:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/admin/controls/:projectKey/:ghKey/bulk-create
 * Create multiple controls at once (for templates)
 */
router.post('/:projectKey/:ghKey/bulk-create', (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const { controls, template } = req.body;

    const greenhouse = db.prepare(`
      SELECT g.id FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ?
    `).get(projectKey, ghKey) as { id: number } | undefined;

    if (!greenhouse) {
      sendError(res, 'ไม่พบโรงเรือน', 404);
      return;
    }

    // Predefined templates
    const templates: Record<string, any[]> = {
      'standard_5_relay_4_motor': [
        { control_key: 'fan_1', name_th: 'พัดลม 1', control_type: 'relay', rpc_method: 'setFan1', attribute_key: 'fan_1', icon: 'Fan', color: '#3b82f6', auto_mode_key: 'auto_fan_1', timer_on_key: 'fan_1_on_time', timer_off_key: 'fan_1_off_time', sort_order: 1 },
        { control_key: 'fan_2', name_th: 'พัดลม 2', control_type: 'relay', rpc_method: 'setFan2', attribute_key: 'fan_2', icon: 'Fan', color: '#3b82f6', auto_mode_key: 'auto_fan_2', timer_on_key: 'fan_2_on_time', timer_off_key: 'fan_2_off_time', sort_order: 2 },
        { control_key: 'valve_2', name_th: 'วาล์วน้ำ', control_type: 'relay', rpc_method: 'setValve2', attribute_key: 'valve_2', icon: 'Droplets', color: '#06b6d4', auto_mode_key: 'auto_valve_2', timer_on_key: 'valve_2_on_time', timer_off_key: 'valve_2_off_time', sort_order: 3 },
        { control_key: 'pump_1', name_th: 'ปั๊มน้ำ', control_type: 'relay', rpc_method: 'setPump1', attribute_key: 'pump_1', icon: 'Waves', color: '#0ea5e9', auto_mode_key: 'auto_pump_1', timer_on_key: 'pump_1_on_time', timer_off_key: 'pump_1_off_time', sort_order: 4 },
        { control_key: 'light_1', name_th: 'ไฟ', control_type: 'relay', rpc_method: 'setLight1', attribute_key: 'light_1', icon: 'Lightbulb', color: '#f59e0b', auto_mode_key: 'auto_light_1', timer_on_key: 'light_1_on_time', timer_off_key: 'light_1_off_time', sort_order: 5 },
        { control_key: 'motor_1', name_th: 'มอเตอร์ 1', control_type: 'motor', rpc_method: 'setMotor1', attribute_key: 'motor_1_fw,motor_1_re', icon: 'Cog', color: '#6366f1', sort_order: 10 },
        { control_key: 'motor_2', name_th: 'มอเตอร์ 2', control_type: 'motor', rpc_method: 'setMotor2', attribute_key: 'motor_2_fw,motor_2_re', icon: 'Cog', color: '#6366f1', sort_order: 11 },
        { control_key: 'motor_3', name_th: 'มอเตอร์ 3', control_type: 'motor', rpc_method: 'setMotor3', attribute_key: 'motor_3_fw,motor_3_re', icon: 'Cog', color: '#6366f1', sort_order: 12 },
        { control_key: 'motor_4', name_th: 'มอเตอร์ 4', control_type: 'motor', rpc_method: 'setMotor4', attribute_key: 'motor_4_fw,motor_4_re', icon: 'Cog', color: '#6366f1', sort_order: 13 },
      ],
      'simple_2_relay': [
        { control_key: 'relay_1', name_th: 'รีเลย์ 1', control_type: 'relay', rpc_method: 'setRelay1', attribute_key: 'relay_1', icon: 'Power', color: '#3b82f6', sort_order: 1 },
        { control_key: 'relay_2', name_th: 'รีเลย์ 2', control_type: 'relay', rpc_method: 'setRelay2', attribute_key: 'relay_2', icon: 'Power', color: '#3b82f6', sort_order: 2 },
      ],
    };

    const controlsToCreate = template ? templates[template] : controls;

    if (!controlsToCreate || !Array.isArray(controlsToCreate)) {
      sendError(res, 'ไม่มีข้อมูล Control หรือ Template', 400);
      return;
    }

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO control_configs (
        greenhouse_id, control_key, name_th, control_type, rpc_method, attribute_key,
        icon, color, auto_mode_key, timer_on_key, timer_off_key, sort_order, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    let created = 0;
    for (const control of controlsToCreate) {
      const result = insertStmt.run(
        greenhouse.id,
        control.control_key,
        control.name_th,
        control.control_type,
        control.rpc_method,
        control.attribute_key,
        control.icon || 'Power',
        control.color || '#3b82f6',
        control.auto_mode_key || null,
        control.timer_on_key || null,
        control.timer_off_key || null,
        control.sort_order || 0
      );
      if (result.changes > 0) created++;
    }

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.CONTROLS_BULK_CREATED,
      projectKey,
      ghKey,
      detail: { template, count: created },
    });

    sendSuccess(res, { message: `สร้าง Control ${created} รายการสำเร็จ`, created });
  } catch (error) {
    console.error('Error bulk creating controls:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;
