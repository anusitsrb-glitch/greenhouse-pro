import { Router, Request, Response } from 'express';
import { query } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { messaging } from '../services/firebase.js';
import { notificationService } from '../services/notificationService.js';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

const notificationQuerySchema = z.object({
  project_id: z.string().optional(),
  greenhouse_id: z.string().optional(),
  type: z.string().optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  is_read: z.enum(['true', 'false']).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

const updateSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  device_offline: z.boolean().optional(),
  device_online: z.boolean().optional(),
  sensor_alert: z.boolean().optional(),
  sensor_offline: z.boolean().optional(),
  control_action: z.boolean().optional(),
  auto_mode_changed: z.boolean().optional(),
  system_error: z.boolean().optional(),
  show_info: z.boolean().optional(),
  show_warning: z.boolean().optional(),
  show_critical: z.boolean().optional(),
  project_filter: z.array(z.string()).optional(),
  greenhouse_filter: z.array(z.string()).optional(),
  quiet_hours_enabled: z.boolean().optional(),
  quiet_hours_start: z.string().optional(),
  quiet_hours_end: z.string().optional(),
  in_app: z.boolean().optional(),
  email: z.boolean().optional(),
  line_notify: z.boolean().optional(),
  push: z.boolean().optional(),
});

// GET /api/notifications
router.get('/', async (req: Request, res: Response) => {
  try {
    const parsed = notificationQuerySchema.safeParse(req.query);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const { project_id, greenhouse_id, type, severity, is_read, limit, offset } = parsed.data;
    const limitNum = parseInt(limit || '50');
    const offsetNum = parseInt(offset || '0');

    let sql = `
      SELECT n.*, p.name_th as project_name, g.name_th as greenhouse_name
      FROM notifications n
      LEFT JOIN projects p ON n.project_id = p.id
      LEFT JOIN greenhouses g ON n.greenhouse_id = g.id
      WHERE n.user_id = $1
    `;
    const params: any[] = [req.session.userId];
    let idx = 2;

    if (project_id) { sql += ` AND n.project_id = $${idx++}`; params.push(parseInt(project_id)); }
    if (greenhouse_id) { sql += ` AND n.greenhouse_id = $${idx++}`; params.push(parseInt(greenhouse_id)); }
    if (type) { sql += ` AND n.type = $${idx++}`; params.push(type); }
    if (severity) { sql += ` AND n.severity = $${idx++}`; params.push(severity); }
    if (is_read !== undefined) { sql += ` AND n.is_read = $${idx++}`; params.push(is_read === 'true' ? 1 : 0); }

    sql += ` ORDER BY n.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limitNum, offsetNum);

    const result = await query(sql, params);
    const parsedNotifications = result.rows.map((n: any) => ({
      ...n,
      metadata: JSON.parse(n.metadata || '{}'),
      is_read: Boolean(n.is_read),
      auto_dismiss: Boolean(n.auto_dismiss),
    }));

    const countResult = await query(`SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = 0`, [req.session.userId]);
    const unread_count = parseInt(countResult.rows[0]?.unread_count ?? '0');

    sendSuccess(res, { notifications: parsedNotifications, unread_count, pagination: { total: parsedNotifications.length, limit: limitNum, offset: offsetNum } });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const result = await query(`SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = 0`, [req.session.userId]);
    sendSuccess(res, { unread_count: parseInt(result.rows[0]?.unread_count ?? '0') });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// GET /api/notifications/recent
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT n.*, p.name_th as project_name, g.name_th as greenhouse_name
      FROM notifications n
      LEFT JOIN projects p ON n.project_id = p.id
      LEFT JOIN greenhouses g ON n.greenhouse_id = g.id
      WHERE n.user_id = $1 AND n.is_read = 0
      ORDER BY n.created_at DESC LIMIT 10
    `, [req.session.userId]);

    const parsedNotifications = result.rows.map((n: any) => ({
      ...n,
      metadata: JSON.parse(n.metadata || '{}'),
      is_read: Boolean(n.is_read),
      auto_dismiss: Boolean(n.auto_dismiss),
    }));
    sendSuccess(res, { notifications: parsedNotifications });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// GET /api/notifications/settings
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const settings = await notificationService.getUserSettings(req.session.userId!);
    if (!settings) { sendError(res, 'ไม่พบการตั้งค่า', 404); return; }
    sendSuccess(res, { settings });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// PUT /api/notifications/settings
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const userId = req.session.userId!;
    const settings = parsed.data;

    const existing = await query(`SELECT id FROM notification_settings WHERE user_id = $1`, [userId]);
    if (existing.rows.length === 0) {
      await query(`INSERT INTO notification_settings (user_id) VALUES ($1)`, [userId]);
    }

    const updateFields: string[] = [];
    const updateParams: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) {
        updateFields.push(`${key} = $${idx++}`);
        if (Array.isArray(value)) updateParams.push(JSON.stringify(value));
        else if (typeof value === 'boolean') updateParams.push(value ? 1 : 0);
        else updateParams.push(value);
      }
    }

    if (updateFields.length > 0) {
      updateFields.push(`updated_at = now()::text`);
      updateParams.push(userId);
      await query(`UPDATE notification_settings SET ${updateFields.join(', ')} WHERE user_id = $${idx}`, updateParams);
    }

    const updatedSettings = await notificationService.getUserSettings(userId);
    sendSuccess(res, { message: 'อัปเดตการตั้งค่าสำเร็จ', settings: updatedSettings });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const success = await notificationService.markAsRead(parseInt(req.params.id), req.session.userId!);
    if (!success) { sendError(res, 'ไม่พบการแจ้งเตือน', 404); return; }
    sendSuccess(res, { message: 'อ่านแล้ว' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', async (req: Request, res: Response) => {
  try {
    const { project_id } = req.query;
    const count = await notificationService.markAllAsRead(
      req.session.userId!,
      project_id ? parseInt(project_id as string) : undefined
    );
    sendSuccess(res, { message: `อ่านแล้ว ${count} รายการ`, count });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// DELETE /api/notifications/unregister-token
router.delete('/unregister-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const userId = req.session.userId;

    if (!token) {
      sendError(res, 'กรุณาระบุ token', 400);
      return;
    }

    await query(
      `DELETE FROM device_tokens WHERE token = $1 AND user_id = $2`,
      [token, userId]
    );

    sendSuccess(res, { unregistered: true });
  } catch (err) {
    console.error('unregister-token error:', err);
    sendError(res, 'ไม่สามารถลบ token ได้', 500);
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(`DELETE FROM notifications WHERE id = $1 AND user_id = $2`, [req.params.id, req.session.userId]);
    if (result.rowCount === 0) { sendError(res, 'ไม่พบการแจ้งเตือน', 404); return; }
    sendSuccess(res, { message: 'ลบแล้ว' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// DELETE /api/notifications
router.delete('/', async (req: Request, res: Response) => {
  try {
    const result = await query(`DELETE FROM notifications WHERE user_id = $1 AND is_read = 1`, [req.session.userId]);
    sendSuccess(res, { message: `ลบแล้ว ${result.rowCount} รายการ`, count: result.rowCount });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// POST /api/notifications/test
router.post('/test', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ success: false, error: 'Not allowed' });
    return;
  }
  notificationService.create({
    userId: req.session.userId!,
    type: 'info',
    severity: 'info',
    title: 'ทดสอบแจ้งเตือน',
    message: 'แจ้งเตือนทดสอบจากระบบ',
    autoDismiss: false,
  });
  res.json({ success: true });
});

// POST /api/notifications/control-history/notify
router.post('/control-history/notify', async (req: Request, res: Response) => {
  try {
    const { greenhouse_key, control_name, action, source } = req.body;
    const result = await query(`SELECT id, project_id, name_th FROM greenhouses WHERE gh_key = $1`, [greenhouse_key]);
    const greenhouse = result.rows[0];
    if (!greenhouse) { res.status(404).json({ error: 'Greenhouse not found' }); return; }

    notificationService.create({
      type: 'control_action',
      severity: 'info',
      title: `${control_name} ${action}`,
      message: `${source === 'manual' ? 'ผู้ใช้สั่ง' : 'โปรแกรม'}งาน ${control_name}`,
      projectId: greenhouse.project_id,
      greenhouseId: greenhouse.id,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});


// POST /api/notifications/register-token
router.post('/register-token', async (req: Request, res: Response) => {
  try {
    const { token, platform } = req.body;
    const userId = req.session.userId;

    if (!token || !platform) {
      sendError(res, 'กรุณาระบุ token และ platform', 400);
      return;
    }
    if (!['ios', 'android', 'web'].includes(platform)) {
      sendError(res, 'platform ต้องเป็น ios, android หรือ web', 400);
      return;
    }

    await query(
      `INSERT INTO device_tokens (user_id, token, platform, updated_at)
       VALUES ($1, $2, $3, now()::text)
       ON CONFLICT (token) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             platform = EXCLUDED.platform,
             updated_at = now()::text`,
      [userId, token, platform]
    );

    sendSuccess(res, { registered: true });
  } catch (err) {
    console.error('register-token error:', err);
    sendError(res, 'ไม่สามารถบันทึก token ได้', 500);
  }
});



// POST /api/notifications/send (Admin only)
router.post('/send', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, body, userId } = req.body;

    if (!title || !body) {
      sendError(res, 'กรุณาระบุ title และ body', 400);
      return;
    }

    let rows: { token: string }[];
    if (userId) {
      const result = await query(`SELECT token FROM device_tokens WHERE user_id = $1`, [userId]);
      rows = result.rows;
    } else {
      const result = await query(`SELECT token FROM device_tokens`);
      rows = result.rows;
    }

    if (rows.length === 0) {
      sendSuccess(res, { sent: 0, message: 'ไม่มี device token' });
      return;
    }

    const tokens = rows.map((r) => r.token);
    const response = await messaging.sendEachForMulticast({ tokens, notification: { title, body } });

    // ลบ token ที่ invalid
    const invalidTokens: string[] = [];
    response.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code;
        if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(tokens[i]);
        }
      }
    });
    if (invalidTokens.length > 0) {
      await query(`DELETE FROM device_tokens WHERE token = ANY($1)`, [invalidTokens]);
    }

    sendSuccess(res, { sent: response.successCount, failed: response.failureCount, invalidRemoved: invalidTokens.length });
  } catch (err) {
    console.error('send notification error:', err);
    sendError(res, 'ไม่สามารถส่ง notification ได้', 500);
  }
});

export default router;