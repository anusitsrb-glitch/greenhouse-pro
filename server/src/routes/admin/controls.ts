import { Router, Request, Response } from 'express';
import { query } from '../../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../../utils/response.js';
import { requireAdmin } from '../../middleware/auth.js';
import { logAudit, AuditActions } from '../../utils/audit.js';
import { z } from 'zod';

const router = Router();
router.use(requireAdmin);

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

// Helper
async function getGreenhouseId(projectKey: string, ghKey: string): Promise<number | null> {
  const result = await query(`
    SELECT g.id FROM greenhouses g
    JOIN projects p ON g.project_id = p.id
    WHERE p.key = $1 AND g.gh_key = $2
  `, [projectKey, ghKey]);
  return result.rows[0]?.id ?? null;
}

// GET /api/admin/controls/:projectKey/:ghKey
router.get('/:projectKey/:ghKey', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const ghId = await getGreenhouseId(projectKey, ghKey);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const result = await query(`
      SELECT * FROM control_configs WHERE greenhouse_id = $1
      ORDER BY sort_order, control_type, name_th
    `, [ghId]);
    sendSuccess(res, { controls: result.rows });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// POST /api/admin/controls/:projectKey/:ghKey
router.post('/:projectKey/:ghKey', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const parsed = controlConfigSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const ghId = await getGreenhouseId(projectKey, ghKey);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const existing = await query(`SELECT id FROM control_configs WHERE greenhouse_id = $1 AND control_key = $2`, [ghId, parsed.data.control_key]);
    if (existing.rows.length > 0) { sendError(res, 'Control key นี้มีอยู่แล้ว', 400); return; }

    const d = parsed.data;
    const result = await query(`
      INSERT INTO control_configs (
        greenhouse_id, control_key, name_th, control_type, rpc_method, attribute_key,
        icon, color, auto_mode_key, timer_on_key, timer_off_key, sort_order, is_active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id
    `, [
      ghId, d.control_key, d.name_th, d.control_type, d.rpc_method, d.attribute_key,
      d.icon || 'Power', d.color || '#3b82f6',
      d.auto_mode_key || null, d.timer_on_key || null, d.timer_off_key || null,
      d.sort_order ?? 0, d.is_active !== false ? 1 : 0
    ]);

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.CONTROL_CREATED, projectKey, ghKey, detail: { controlKey: d.control_key, controlName: d.name_th } });
    sendSuccess(res, { message: 'สร้าง Control สำเร็จ', control: { id: result.rows[0].id } });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// PUT /api/admin/controls/:projectKey/:ghKey/:controlKey
router.put('/:projectKey/:ghKey/:controlKey', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey, controlKey } = req.params;
    const parsed = controlConfigSchema.partial().safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const controlRes = await query(`
      SELECT cc.id FROM control_configs cc
      JOIN greenhouses g ON cc.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = $1 AND g.gh_key = $2 AND cc.control_key = $3
    `, [projectKey, ghKey, controlKey]);
    const control = controlRes.rows[0];
    if (!control) { sendError(res, 'ไม่พบ Control', 404); return; }

    const d = parsed.data;
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (d.name_th !== undefined) { updates.push(`name_th = $${idx++}`); values.push(d.name_th); }
    if (d.control_type !== undefined) { updates.push(`control_type = $${idx++}`); values.push(d.control_type); }
    if (d.rpc_method !== undefined) { updates.push(`rpc_method = $${idx++}`); values.push(d.rpc_method); }
    if (d.attribute_key !== undefined) { updates.push(`attribute_key = $${idx++}`); values.push(d.attribute_key); }
    if (d.icon !== undefined) { updates.push(`icon = $${idx++}`); values.push(d.icon); }
    if (d.color !== undefined) { updates.push(`color = $${idx++}`); values.push(d.color); }
    if (d.auto_mode_key !== undefined) { updates.push(`auto_mode_key = $${idx++}`); values.push(d.auto_mode_key); }
    if (d.timer_on_key !== undefined) { updates.push(`timer_on_key = $${idx++}`); values.push(d.timer_on_key); }
    if (d.timer_off_key !== undefined) { updates.push(`timer_off_key = $${idx++}`); values.push(d.timer_off_key); }
    if (d.sort_order !== undefined) { updates.push(`sort_order = $${idx++}`); values.push(d.sort_order); }
    if (d.is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(d.is_active ? 1 : 0); }

    if (updates.length > 0) {
      updates.push(`updated_at = now()::text`);
      values.push(control.id);
      await query(`UPDATE control_configs SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    }

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.CONTROL_UPDATED, projectKey, ghKey, detail: { controlKey, changes: d } });
    sendSuccess(res, { message: 'บันทึก Control สำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// DELETE /api/admin/controls/:projectKey/:ghKey/:controlKey
router.delete('/:projectKey/:ghKey/:controlKey', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey, controlKey } = req.params;
    const controlRes = await query(`
      SELECT cc.id, cc.name_th FROM control_configs cc
      JOIN greenhouses g ON cc.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = $1 AND g.gh_key = $2 AND cc.control_key = $3
    `, [projectKey, ghKey, controlKey]);
    const control = controlRes.rows[0];
    if (!control) { sendError(res, 'ไม่พบ Control', 404); return; }

    await query('DELETE FROM control_configs WHERE id = $1', [control.id]);
    logAudit({ userId: req.session.userId ?? null, action: AuditActions.CONTROL_DELETED, projectKey, ghKey, detail: { controlKey, controlName: control.name_th } });
    sendSuccess(res, { message: 'ลบ Control สำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// POST /api/admin/controls/:projectKey/:ghKey/bulk-create
router.post('/:projectKey/:ghKey/bulk-create', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const { controls, template } = req.body;

    const ghId = await getGreenhouseId(projectKey, ghKey);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

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
    if (!controlsToCreate || !Array.isArray(controlsToCreate)) { sendError(res, 'ไม่มีข้อมูล Control หรือ Template', 400); return; }

    let created = 0;
    for (const c of controlsToCreate) {
      const result = await query(`
        INSERT INTO control_configs (
          greenhouse_id, control_key, name_th, control_type, rpc_method, attribute_key,
          icon, color, auto_mode_key, timer_on_key, timer_off_key, sort_order, is_active
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1)
        ON CONFLICT (greenhouse_id, control_key) DO NOTHING
      `, [
        ghId, c.control_key, c.name_th, c.control_type, c.rpc_method, c.attribute_key,
        c.icon || 'Power', c.color || '#3b82f6',
        c.auto_mode_key || null, c.timer_on_key || null, c.timer_off_key || null,
        c.sort_order || 0
      ]);
      if (result.rowCount && result.rowCount > 0) created++;
    }

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.CONTROLS_BULK_CREATED, projectKey, ghKey, detail: { template, count: created } });
    sendSuccess(res, { message: `สร้าง Control ${created} รายการสำเร็จ`, created });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;