import { Router, Request, Response } from 'express';
import { query } from '../../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../../utils/response.js';
import { requireAdmin } from '../../middleware/auth.js';
import { logAudit, AuditActions } from '../../utils/audit.js';
import { z } from 'zod';

const router = Router();
router.use(requireAdmin);

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

// GET /api/admin/settings
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query(`SELECT key, value, updated_at FROM app_settings`);
    const settingsObj: Record<string, any> = {};
    for (const setting of result.rows) {
      try { settingsObj[setting.key] = JSON.parse(setting.value); }
      catch { settingsObj[setting.key] = setting.value; }
    }
    sendSuccess(res, { settings: settingsObj });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// GET /api/admin/settings/:key
router.get('/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const result = await query(`SELECT value, updated_at FROM app_settings WHERE key = $1`, [key]);
    const setting = result.rows[0];
    if (!setting) { sendError(res, 'ไม่พบการตั้งค่า', 404); return; }
    let value;
    try { value = JSON.parse(setting.value); } catch { value = setting.value; }
    sendSuccess(res, { key, value, updatedAt: setting.updated_at });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// PUT /api/admin/settings/:key
router.put('/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, now()::text)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()::text`,
      [key, valueStr]
    );
    logAudit({ userId: req.session.userId ?? null, action: AuditActions.SETTINGS_UPDATED, detail: { key, value } });
    sendSuccess(res, { message: 'บันทึกการตั้งค่าสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// GET /api/admin/settings/line-notify/config
router.get('/line-notify/config', async (req: Request, res: Response) => {
  try {
    const result = await query(`SELECT value FROM app_settings WHERE key = 'line_notify'`);
    const config = result.rows[0] ? JSON.parse(result.rows[0].value) : {
      enabled: false, token: '', alertOnOffline: true, alertOnThreshold: true,
      thresholds: { temp_min: 20, temp_max: 40, humidity_min: 40, humidity_max: 80, soil_moisture_min: 30, soil_moisture_max: 70 },
    };
    if (config.token) config.tokenMasked = config.token.substring(0, 10) + '****';
    sendSuccess(res, { config });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// PUT /api/admin/settings/line-notify/config
router.put('/line-notify/config', async (req: Request, res: Response) => {
  try {
    const parsed = lineNotifySettingsSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const existing = await query(`SELECT value FROM app_settings WHERE key = 'line_notify'`);
    const existingConfig = existing.rows[0] ? JSON.parse(existing.rows[0].value) : {};
    const newConfig = {
      ...existingConfig, ...parsed.data,
      token: parsed.data.token || existingConfig.token || '',
      thresholds: { ...existingConfig.thresholds, ...parsed.data.thresholds },
    };
    await query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('line_notify', $1, now()::text)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()::text`,
      [JSON.stringify(newConfig)]
    );
    logAudit({ userId: req.session.userId ?? null, action: AuditActions.LINE_NOTIFY_UPDATED, detail: { enabled: newConfig.enabled } });
    sendSuccess(res, { message: 'บันทึกการตั้งค่า Line Notify สำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// POST /api/admin/settings/line-notify/test
router.post('/line-notify/test', async (req: Request, res: Response) => {
  try {
    const result = await query(`SELECT value FROM app_settings WHERE key = 'line_notify'`);
    if (!result.rows[0]) { sendError(res, 'ยังไม่ได้ตั้งค่า Line Notify', 400); return; }
    const config = JSON.parse(result.rows[0].value);
    if (!config.token) { sendError(res, 'ยังไม่ได้ใส่ Line Notify Token', 400); return; }

    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Bearer ${config.token}` },
      body: new URLSearchParams({ message: '\n🌿 GreenHouse Pro\n✅ ทดสอบการแจ้งเตือนสำเร็จ!' }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      sendError(res, `Line Notify error: ${errorData.message || response.statusText}`, 400); return;
    }
    logAudit({ userId: req.session.userId ?? null, action: AuditActions.LINE_NOTIFY_TEST, detail: { success: true } });
    sendSuccess(res, { message: 'ส่งข้อความทดสอบสำเร็จ' });
  } catch (error) {
    sendError(res, 'ไม่สามารถส่งข้อความทดสอบได้', 500);
  }
});

export default router;