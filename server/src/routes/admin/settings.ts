/**
 * Admin Settings Routes
 * Manage app-wide settings including Line Notify
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

const updateSettingSchema = z.object({
  value: z.string(),
});

const lineNotifySettingsSchema = z.object({
  enabled: z.boolean(),
  token: z.string().optional(),
  alertOnOffline: z.boolean().optional(),
  alertOnThreshold: z.boolean().optional(),
  thresholds: z.object({
    temp_min: z.number().optional(),
    temp_max: z.number().optional(),
    humidity_min: z.number().optional(),
    humidity_max: z.number().optional(),
    soil_moisture_min: z.number().optional(),
    soil_moisture_max: z.number().optional(),
  }).optional(),
});

// ============================================================
// Routes
// ============================================================

/**
 * GET /api/admin/settings
 * Get all app settings
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const settings = db.prepare(`
      SELECT key, value, updated_at FROM app_settings
    `).all() as { key: string; value: string; updated_at: string }[];

    // Convert to object
    const settingsObj: Record<string, any> = {};
    for (const setting of settings) {
      try {
        settingsObj[setting.key] = JSON.parse(setting.value);
      } catch {
        settingsObj[setting.key] = setting.value;
      }
    }

    sendSuccess(res, { settings: settingsObj });
  } catch (error) {
    console.error('Error fetching settings:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/admin/settings/:key
 * Get single setting
 */
router.get('/:key', (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const setting = db.prepare(`
      SELECT value, updated_at FROM app_settings WHERE key = ?
    `).get(key) as { value: string; updated_at: string } | undefined;

    if (!setting) {
      sendError(res, 'ไม่พบการตั้งค่า', 404);
      return;
    }

    let value;
    try {
      value = JSON.parse(setting.value);
    } catch {
      value = setting.value;
    }

    sendSuccess(res, { key, value, updatedAt: setting.updated_at });
  } catch (error) {
    console.error('Error fetching setting:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * PUT /api/admin/settings/:key
 * Update single setting
 */
router.put('/:key', (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
    `).run(key, valueStr, valueStr);

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.SETTINGS_UPDATED,
      detail: { key, value },
    });

    sendSuccess(res, { message: 'บันทึกการตั้งค่าสำเร็จ' });
  } catch (error) {
    console.error('Error updating setting:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/admin/settings/line-notify/config
 * Get Line Notify configuration
 */
router.get('/line-notify/config', (req: Request, res: Response) => {
  try {
    const setting = db.prepare(`
      SELECT value FROM app_settings WHERE key = 'line_notify'
    `).get() as { value: string } | undefined;

    const config = setting ? JSON.parse(setting.value) : {
      enabled: false,
      token: '',
      alertOnOffline: true,
      alertOnThreshold: true,
      thresholds: {
        temp_min: 20,
        temp_max: 40,
        humidity_min: 40,
        humidity_max: 80,
        soil_moisture_min: 30,
        soil_moisture_max: 70,
      },
    };

    // Mask token for security
    if (config.token) {
      config.tokenMasked = config.token.substring(0, 10) + '****';
    }

    sendSuccess(res, { config });
  } catch (error) {
    console.error('Error fetching Line Notify config:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * PUT /api/admin/settings/line-notify/config
 * Update Line Notify configuration
 */
router.put('/line-notify/config', (req: Request, res: Response) => {
  try {
    const parsed = lineNotifySettingsSchema.safeParse(req.body);

    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    // Get existing config to preserve token if not provided
    const existing = db.prepare(`
      SELECT value FROM app_settings WHERE key = 'line_notify'
    `).get() as { value: string } | undefined;

    let existingConfig = existing ? JSON.parse(existing.value) : {};

    const newConfig = {
      ...existingConfig,
      ...parsed.data,
      // Only update token if provided
      token: parsed.data.token || existingConfig.token || '',
      thresholds: {
        ...existingConfig.thresholds,
        ...parsed.data.thresholds,
      },
    };

    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('line_notify', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
    `).run(JSON.stringify(newConfig), JSON.stringify(newConfig));

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.LINE_NOTIFY_UPDATED,
      detail: { enabled: newConfig.enabled },
    });

    sendSuccess(res, { message: 'บันทึกการตั้งค่า Line Notify สำเร็จ' });
  } catch (error) {
    console.error('Error updating Line Notify config:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/admin/settings/line-notify/test
 * Send test notification
 */
router.post('/line-notify/test', async (req: Request, res: Response) => {
  try {
    const setting = db.prepare(`
      SELECT value FROM app_settings WHERE key = 'line_notify'
    `).get() as { value: string } | undefined;

    if (!setting) {
      sendError(res, 'ยังไม่ได้ตั้งค่า Line Notify', 400);
      return;
    }

    const config = JSON.parse(setting.value);

    if (!config.token) {
      sendError(res, 'ยังไม่ได้ใส่ Line Notify Token', 400);
      return;
    }

    // Send test message
    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${config.token}`,
      },
      body: new URLSearchParams({
        message: '\n🌿 GreenHouse Pro\n✅ ทดสอบการแจ้งเตือนสำเร็จ!',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      sendError(res, `Line Notify error: ${errorData.message || response.statusText}`, 400);
      return;
    }

    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.LINE_NOTIFY_TEST,
      detail: { success: true },
    });

    sendSuccess(res, { message: 'ส่งข้อความทดสอบสำเร็จ' });
  } catch (error) {
    console.error('Error testing Line Notify:', error);
    sendError(res, 'ไม่สามารถส่งข้อความทดสอบได้', 500);
  }
});

export default router;
