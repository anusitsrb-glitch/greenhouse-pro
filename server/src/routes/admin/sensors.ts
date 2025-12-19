/**
 * Sensor Configuration Routes
 * Manage dynamic sensor configurations per greenhouse
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

// ============================================================
// Routes
// ============================================================

/**
 * GET /api/admin/sensors/:projectKey/:ghKey
 * Get all sensor configs for a greenhouse
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

    const sensors = db.prepare(`
      SELECT * FROM sensor_configs 
      WHERE greenhouse_id = ?
      ORDER BY sort_order, sensor_type, name_th
    `).all(greenhouse.id);

    sendSuccess(res, { sensors });
  } catch (error) {
    console.error('Error fetching sensors:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/admin/sensors/:projectKey/:ghKey
 * Create new sensor config
 */
router.post('/:projectKey/:ghKey', (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const parsed = sensorConfigSchema.safeParse(req.body);

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

    // Check if sensor_key already exists
    const existing = db.prepare(`
      SELECT id FROM sensor_configs WHERE greenhouse_id = ? AND sensor_key = ?
    `).get(greenhouse.id, parsed.data.sensor_key);

    if (existing) {
      sendError(res, 'Sensor key นี้มีอยู่แล้ว', 400);
      return;
    }

    const result = db.prepare(`
      INSERT INTO sensor_configs (
        greenhouse_id, sensor_key, name_th, sensor_type, data_key, unit,
        icon, color, min_value, max_value, alert_min, alert_max,
        calibration_offset, calibration_scale, sort_order, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      greenhouse.id,
      parsed.data.sensor_key,
      parsed.data.name_th,
      parsed.data.sensor_type,
      parsed.data.data_key,
      parsed.data.unit,
      parsed.data.icon || 'Thermometer',
      parsed.data.color || '#10b981',
      parsed.data.min_value ?? null,
      parsed.data.max_value ?? null,
      parsed.data.alert_min ?? null,
      parsed.data.alert_max ?? null,
      parsed.data.calibration_offset ?? 0,
      parsed.data.calibration_scale ?? 1,
      parsed.data.sort_order ?? 0,
      parsed.data.is_active !== false ? 1 : 0
    );

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.SENSOR_CREATED,
      projectKey,
      ghKey,
      detail: { sensorKey: parsed.data.sensor_key, sensorName: parsed.data.name_th },
    });

    sendSuccess(res, { 
      message: 'สร้าง Sensor สำเร็จ', 
      sensor: { id: result.lastInsertRowid } 
    });
  } catch (error) {
    console.error('Error creating sensor:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * PUT /api/admin/sensors/:projectKey/:ghKey/:sensorKey
 * Update sensor config
 */
router.put('/:projectKey/:ghKey/:sensorKey', (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey, sensorKey } = req.params;
    const parsed = sensorConfigSchema.partial().safeParse(req.body);

    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const sensor = db.prepare(`
      SELECT sc.id FROM sensor_configs sc
      JOIN greenhouses g ON sc.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ? AND sc.sensor_key = ?
    `).get(projectKey, ghKey, sensorKey) as { id: number } | undefined;

    if (!sensor) {
      sendError(res, 'ไม่พบ Sensor', 404);
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];

    const data = parsed.data;
    if (data.name_th !== undefined) { updates.push('name_th = ?'); values.push(data.name_th); }
    if (data.sensor_type !== undefined) { updates.push('sensor_type = ?'); values.push(data.sensor_type); }
    if (data.data_key !== undefined) { updates.push('data_key = ?'); values.push(data.data_key); }
    if (data.unit !== undefined) { updates.push('unit = ?'); values.push(data.unit); }
    if (data.icon !== undefined) { updates.push('icon = ?'); values.push(data.icon); }
    if (data.color !== undefined) { updates.push('color = ?'); values.push(data.color); }
    if (data.min_value !== undefined) { updates.push('min_value = ?'); values.push(data.min_value); }
    if (data.max_value !== undefined) { updates.push('max_value = ?'); values.push(data.max_value); }
    if (data.alert_min !== undefined) { updates.push('alert_min = ?'); values.push(data.alert_min); }
    if (data.alert_max !== undefined) { updates.push('alert_max = ?'); values.push(data.alert_max); }
    if (data.calibration_offset !== undefined) { updates.push('calibration_offset = ?'); values.push(data.calibration_offset); }
    if (data.calibration_scale !== undefined) { updates.push('calibration_scale = ?'); values.push(data.calibration_scale); }
    if (data.sort_order !== undefined) { updates.push('sort_order = ?'); values.push(data.sort_order); }
    if (data.is_active !== undefined) { updates.push('is_active = ?'); values.push(data.is_active ? 1 : 0); }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(sensor.id);

      db.prepare(`
        UPDATE sensor_configs SET ${updates.join(', ')} WHERE id = ?
      `).run(...values);
    }

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.SENSOR_UPDATED,
      projectKey,
      ghKey,
      detail: { sensorKey, changes: data },
    });

    sendSuccess(res, { message: 'บันทึก Sensor สำเร็จ' });
  } catch (error) {
    console.error('Error updating sensor:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * DELETE /api/admin/sensors/:projectKey/:ghKey/:sensorKey
 * Delete sensor config
 */
router.delete('/:projectKey/:ghKey/:sensorKey', (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey, sensorKey } = req.params;

    const sensor = db.prepare(`
      SELECT sc.id, sc.name_th FROM sensor_configs sc
      JOIN greenhouses g ON sc.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ? AND sc.sensor_key = ?
    `).get(projectKey, ghKey, sensorKey) as { id: number; name_th: string } | undefined;

    if (!sensor) {
      sendError(res, 'ไม่พบ Sensor', 404);
      return;
    }

    db.prepare('DELETE FROM sensor_configs WHERE id = ?').run(sensor.id);

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.SENSOR_DELETED,
      projectKey,
      ghKey,
      detail: { sensorKey, sensorName: sensor.name_th },
    });

    sendSuccess(res, { message: 'ลบ Sensor สำเร็จ' });
  } catch (error) {
    console.error('Error deleting sensor:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/admin/sensors/:projectKey/:ghKey/calibrate/:sensorKey
 * Update calibration for a sensor
 */
router.post('/:projectKey/:ghKey/calibrate/:sensorKey', (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey, sensorKey } = req.params;
    const { offset, scale } = req.body;

    const sensor = db.prepare(`
      SELECT sc.id FROM sensor_configs sc
      JOIN greenhouses g ON sc.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ? AND sc.sensor_key = ?
    `).get(projectKey, ghKey, sensorKey) as { id: number } | undefined;

    if (!sensor) {
      sendError(res, 'ไม่พบ Sensor', 404);
      return;
    }

    db.prepare(`
      UPDATE sensor_configs 
      SET calibration_offset = ?, calibration_scale = ?, calibration_date = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(offset ?? 0, scale ?? 1, sensor.id);

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.SENSOR_CALIBRATED,
      projectKey,
      ghKey,
      detail: { sensorKey, offset, scale },
    });

    sendSuccess(res, { message: 'บันทึกการ Calibrate สำเร็จ' });
  } catch (error) {
    console.error('Error calibrating sensor:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/admin/sensors/:projectKey/:ghKey/bulk-create
 * Create multiple sensors at once (for templates)
 */
router.post('/:projectKey/:ghKey/bulk-create', (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const { sensors, template } = req.body;

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
      'standard_10_soil': [
        { sensor_key: 'air_temp', name_th: 'อุณหภูมิอากาศ', sensor_type: 'air', data_key: 'air_temp', unit: '°C', icon: 'Thermometer', color: '#ef4444' },
        { sensor_key: 'air_humidity', name_th: 'ความชื้นอากาศ', sensor_type: 'air', data_key: 'air_humidity', unit: '%', icon: 'Droplets', color: '#3b82f6' },
        { sensor_key: 'air_co2', name_th: 'CO₂', sensor_type: 'air', data_key: 'air_co2', unit: 'ppm', icon: 'Wind', color: '#8b5cf6' },
        { sensor_key: 'air_light', name_th: 'แสง', sensor_type: 'light', data_key: 'air_light', unit: 'lux', icon: 'Sun', color: '#f59e0b' },
        ...Array.from({ length: 10 }, (_, i) => ({
          sensor_key: `soil${i + 1}_moisture`,
          name_th: `ความชื้นดิน จุด ${i + 1}`,
          sensor_type: 'soil',
          data_key: `soil${i + 1}_moisture`,
          unit: '%',
          icon: 'Sprout',
          color: '#10b981',
          sort_order: i + 10,
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          sensor_key: `soil${i + 1}_temp`,
          name_th: `อุณหภูมิดิน จุด ${i + 1}`,
          sensor_type: 'soil',
          data_key: `soil${i + 1}_temp`,
          unit: '°C',
          icon: 'Thermometer',
          color: '#f97316',
          sort_order: i + 20,
        })),
      ],
      'simple_air_only': [
        { sensor_key: 'air_temp', name_th: 'อุณหภูมิอากาศ', sensor_type: 'air', data_key: 'air_temp', unit: '°C', icon: 'Thermometer', color: '#ef4444' },
        { sensor_key: 'air_humidity', name_th: 'ความชื้นอากาศ', sensor_type: 'air', data_key: 'air_humidity', unit: '%', icon: 'Droplets', color: '#3b82f6' },
      ],
    };

    const sensorsToCreate = template ? templates[template] : sensors;

    if (!sensorsToCreate || !Array.isArray(sensorsToCreate)) {
      sendError(res, 'ไม่มีข้อมูล Sensor หรือ Template', 400);
      return;
    }

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO sensor_configs (
        greenhouse_id, sensor_key, name_th, sensor_type, data_key, unit,
        icon, color, sort_order, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    let created = 0;
    for (const sensor of sensorsToCreate) {
      const result = insertStmt.run(
        greenhouse.id,
        sensor.sensor_key,
        sensor.name_th,
        sensor.sensor_type,
        sensor.data_key,
        sensor.unit,
        sensor.icon || 'Thermometer',
        sensor.color || '#10b981',
        sensor.sort_order || 0
      );
      if (result.changes > 0) created++;
    }

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.SENSORS_BULK_CREATED,
      projectKey,
      ghKey,
      detail: { template, count: created },
    });

    sendSuccess(res, { message: `สร้าง Sensor ${created} รายการสำเร็จ`, created });
  } catch (error) {
    console.error('Error bulk creating sensors:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;
