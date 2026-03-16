import { Router, Request, Response } from 'express';
import { query } from '../../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../../utils/response.js';
import { requireAdmin } from '../../middleware/auth.js';
import { logAudit, AuditActions } from '../../utils/audit.js';
import { z } from 'zod';

const router = Router();
router.use(requireAdmin);

const sensorConfigSchema = z.object({
  sensor_key: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/),
  name_th: z.string().min(1).max(100),
  sensor_type: z.enum(['air', 'soil', 'water', 'light', 'custom']),
  data_key: z.string().min(1).max(100),
  unit: z.string().max(20),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  min_value: z.number().optional().nullable(),
  max_value: z.number().optional().nullable(),
  alert_min: z.number().optional().nullable(),
  alert_max: z.number().optional().nullable(),
  calibration_offset: z.number().optional(),
  calibration_scale: z.number().optional(),
  sort_order: z.number().optional(),
  is_active: z.boolean().optional(),
});

// Helper: get greenhouse id
async function getGreenhouseId(projectKey: string, ghKey: string): Promise<number | null> {
  const result = await query(`
    SELECT g.id FROM greenhouses g
    JOIN projects p ON g.project_id = p.id
    WHERE p.key = $1 AND g.gh_key = $2
  `, [projectKey, ghKey]);
  return result.rows[0]?.id ?? null;
}

// GET /api/admin/sensors/:projectKey/:ghKey
router.get('/:projectKey/:ghKey', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const ghId = await getGreenhouseId(projectKey, ghKey);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const result = await query(`
      SELECT * FROM sensor_configs WHERE greenhouse_id = $1
      ORDER BY sort_order, sensor_type, name_th
    `, [ghId]);
    sendSuccess(res, { sensors: result.rows });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// POST /api/admin/sensors/:projectKey/:ghKey
router.post('/:projectKey/:ghKey', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const parsed = sensorConfigSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const ghId = await getGreenhouseId(projectKey, ghKey);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const existing = await query(`SELECT id FROM sensor_configs WHERE greenhouse_id = $1 AND sensor_key = $2`, [ghId, parsed.data.sensor_key]);
    if (existing.rows.length > 0) { sendError(res, 'Sensor key นี้มีอยู่แล้ว', 400); return; }

    const d = parsed.data;
    const result = await query(`
      INSERT INTO sensor_configs (
        greenhouse_id, sensor_key, name_th, sensor_type, data_key, unit,
        icon, color, min_value, max_value, alert_min, alert_max,
        calibration_offset, calibration_scale, sort_order, is_active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id
    `, [
      ghId, d.sensor_key, d.name_th, d.sensor_type, d.data_key, d.unit,
      d.icon || 'Thermometer', d.color || '#10b981',
      d.min_value ?? null, d.max_value ?? null, d.alert_min ?? null, d.alert_max ?? null,
      d.calibration_offset ?? 0, d.calibration_scale ?? 1,
      d.sort_order ?? 0, d.is_active !== false ? 1 : 0
    ]);

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.SENSOR_CREATED, projectKey, ghKey, detail: { sensorKey: d.sensor_key, sensorName: d.name_th } });
    sendSuccess(res, { message: 'สร้าง Sensor สำเร็จ', sensor: { id: result.rows[0].id } });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// PUT /api/admin/sensors/:projectKey/:ghKey/:sensorKey
router.put('/:projectKey/:ghKey/:sensorKey', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey, sensorKey } = req.params;
    const parsed = sensorConfigSchema.partial().safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const sensorRes = await query(`
      SELECT sc.id FROM sensor_configs sc
      JOIN greenhouses g ON sc.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = $1 AND g.gh_key = $2 AND sc.sensor_key = $3
    `, [projectKey, ghKey, sensorKey]);
    const sensor = sensorRes.rows[0];
    if (!sensor) { sendError(res, 'ไม่พบ Sensor', 404); return; }

    const d = parsed.data;
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (d.name_th !== undefined) { updates.push(`name_th = $${idx++}`); values.push(d.name_th); }
    if (d.sensor_type !== undefined) { updates.push(`sensor_type = $${idx++}`); values.push(d.sensor_type); }
    if (d.data_key !== undefined) { updates.push(`data_key = $${idx++}`); values.push(d.data_key); }
    if (d.unit !== undefined) { updates.push(`unit = $${idx++}`); values.push(d.unit); }
    if (d.icon !== undefined) { updates.push(`icon = $${idx++}`); values.push(d.icon); }
    if (d.color !== undefined) { updates.push(`color = $${idx++}`); values.push(d.color); }
    if (d.min_value !== undefined) { updates.push(`min_value = $${idx++}`); values.push(d.min_value); }
    if (d.max_value !== undefined) { updates.push(`max_value = $${idx++}`); values.push(d.max_value); }
    if (d.alert_min !== undefined) { updates.push(`alert_min = $${idx++}`); values.push(d.alert_min); }
    if (d.alert_max !== undefined) { updates.push(`alert_max = $${idx++}`); values.push(d.alert_max); }
    if (d.calibration_offset !== undefined) { updates.push(`calibration_offset = $${idx++}`); values.push(d.calibration_offset); }
    if (d.calibration_scale !== undefined) { updates.push(`calibration_scale = $${idx++}`); values.push(d.calibration_scale); }
    if (d.sort_order !== undefined) { updates.push(`sort_order = $${idx++}`); values.push(d.sort_order); }
    if (d.is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(d.is_active ? 1 : 0); }

    if (updates.length > 0) {
      updates.push(`updated_at = now()::text`);
      values.push(sensor.id);
      await query(`UPDATE sensor_configs SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    }

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.SENSOR_UPDATED, projectKey, ghKey, detail: { sensorKey, changes: d } });
    sendSuccess(res, { message: 'บันทึก Sensor สำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// DELETE /api/admin/sensors/:projectKey/:ghKey/:sensorKey
router.delete('/:projectKey/:ghKey/:sensorKey', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey, sensorKey } = req.params;
    const sensorRes = await query(`
      SELECT sc.id, sc.name_th FROM sensor_configs sc
      JOIN greenhouses g ON sc.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = $1 AND g.gh_key = $2 AND sc.sensor_key = $3
    `, [projectKey, ghKey, sensorKey]);
    const sensor = sensorRes.rows[0];
    if (!sensor) { sendError(res, 'ไม่พบ Sensor', 404); return; }

    await query('DELETE FROM sensor_configs WHERE id = $1', [sensor.id]);
    logAudit({ userId: req.session.userId ?? null, action: AuditActions.SENSOR_DELETED, projectKey, ghKey, detail: { sensorKey, sensorName: sensor.name_th } });
    sendSuccess(res, { message: 'ลบ Sensor สำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// POST /api/admin/sensors/:projectKey/:ghKey/calibrate/:sensorKey
router.post('/:projectKey/:ghKey/calibrate/:sensorKey', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey, sensorKey } = req.params;
    const { offset, scale } = req.body;

    const sensorRes = await query(`
      SELECT sc.id FROM sensor_configs sc
      JOIN greenhouses g ON sc.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = $1 AND g.gh_key = $2 AND sc.sensor_key = $3
    `, [projectKey, ghKey, sensorKey]);
    const sensor = sensorRes.rows[0];
    if (!sensor) { sendError(res, 'ไม่พบ Sensor', 404); return; }

    await query(`
      UPDATE sensor_configs
      SET calibration_offset = $1, calibration_scale = $2,
          calibration_date = now()::text, updated_at = now()::text
      WHERE id = $3
    `, [offset ?? 0, scale ?? 1, sensor.id]);

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.SENSOR_CALIBRATED, projectKey, ghKey, detail: { sensorKey, offset, scale } });
    sendSuccess(res, { message: 'บันทึกการ Calibrate สำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// POST /api/admin/sensors/:projectKey/:ghKey/bulk-create
router.post('/:projectKey/:ghKey/bulk-create', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const { sensors, template } = req.body;

    const ghId = await getGreenhouseId(projectKey, ghKey);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const templates: Record<string, any[]> = {
      'standard_10_soil': [
        { sensor_key: 'air_temp', name_th: 'อุณหภูมิอากาศ', sensor_type: 'air', data_key: 'air_temp', unit: '°C', icon: 'Thermometer', color: '#ef4444' },
        { sensor_key: 'air_humidity', name_th: 'ความชื้นอากาศ', sensor_type: 'air', data_key: 'air_humidity', unit: '%', icon: 'Droplets', color: '#3b82f6' },
        { sensor_key: 'air_co2', name_th: 'CO₂', sensor_type: 'air', data_key: 'air_co2', unit: 'ppm', icon: 'Wind', color: '#8b5cf6' },
        { sensor_key: 'air_light', name_th: 'แสง', sensor_type: 'light', data_key: 'air_light', unit: 'lux', icon: 'Sun', color: '#f59e0b' },
        ...Array.from({ length: 10 }, (_, i) => ({ sensor_key: `soil${i+1}_moisture`, name_th: `ความชื้นดิน จุด ${i+1}`, sensor_type: 'soil', data_key: `soil${i+1}_moisture`, unit: '%', icon: 'Sprout', color: '#10b981', sort_order: i + 10 })),
        ...Array.from({ length: 10 }, (_, i) => ({ sensor_key: `soil${i+1}_temp`, name_th: `อุณหภูมิดิน จุด ${i+1}`, sensor_type: 'soil', data_key: `soil${i+1}_temp`, unit: '°C', icon: 'Thermometer', color: '#f97316', sort_order: i + 20 })),
      ],
      'simple_air_only': [
        { sensor_key: 'air_temp', name_th: 'อุณหภูมิอากาศ', sensor_type: 'air', data_key: 'air_temp', unit: '°C', icon: 'Thermometer', color: '#ef4444' },
        { sensor_key: 'air_humidity', name_th: 'ความชื้นอากาศ', sensor_type: 'air', data_key: 'air_humidity', unit: '%', icon: 'Droplets', color: '#3b82f6' },
      ],
    };

    const sensorsToCreate = template ? templates[template] : sensors;
    if (!sensorsToCreate || !Array.isArray(sensorsToCreate)) { sendError(res, 'ไม่มีข้อมูล Sensor หรือ Template', 400); return; }

    let created = 0;
    for (const s of sensorsToCreate) {
      const result = await query(`
        INSERT INTO sensor_configs (greenhouse_id, sensor_key, name_th, sensor_type, data_key, unit, icon, color, sort_order, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1)
        ON CONFLICT (greenhouse_id, sensor_key) DO NOTHING
      `, [ghId, s.sensor_key, s.name_th, s.sensor_type, s.data_key, s.unit, s.icon || 'Thermometer', s.color || '#10b981', s.sort_order || 0]);
      if (result.rowCount && result.rowCount > 0) created++;
    }

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.SENSORS_BULK_CREATED, projectKey, ghKey, detail: { template, count: created } });
    sendSuccess(res, { message: `สร้าง Sensor ${created} รายการสำเร็จ`, created });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;