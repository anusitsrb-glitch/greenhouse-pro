/**
 * Notification Routes
 * Real-time notifications for users
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';
import { notificationService } from '../services/notificationService.js';
import { z } from 'zod';

const router = Router();

// Apply auth middleware
router.use(requireAuth);

// ============================================================
// Validation Schemas
// ============================================================

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
});

// ============================================================
// Routes
// ============================================================

/**
 * GET /api/notifications
 * Get user notifications with filters
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const parsed = notificationQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const { project_id, greenhouse_id, type, severity, is_read, limit, offset } = parsed.data;

    let query = `
      SELECT 
        n.*,
        p.name_th as project_name,
        g.name_th as greenhouse_name
      FROM notifications n
      LEFT JOIN projects p ON n.project_id = p.id
      LEFT JOIN greenhouses g ON n.greenhouse_id = g.id
      WHERE n.user_id = ?
    `;
    const params: any[] = [req.session.userId];

    if (project_id) {
      query += ` AND n.project_id = ?`;
      params.push(parseInt(project_id));
    }
    if (greenhouse_id) {
      query += ` AND n.greenhouse_id = ?`;
      params.push(parseInt(greenhouse_id));
    }
    if (type) {
      query += ` AND n.type = ?`;
      params.push(type);
    }
    if (severity) {
      query += ` AND n.severity = ?`;
      params.push(severity);
    }
    if (is_read !== undefined) {
      query += ` AND n.is_read = ?`;
      params.push(is_read === 'true' ? 1 : 0);
    }

    query += ` ORDER BY n.created_at DESC`;

    const limitNum = parseInt(limit || '50');
    const offsetNum = parseInt(offset || '0');
    query += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offsetNum);

    const notifications = db.prepare(query).all(...params);

    // Parse metadata JSON
    const parsedNotifications = notifications.map((n: any) => ({
      ...n,
      metadata: JSON.parse(n.metadata || '{}'),
      is_read: Boolean(n.is_read),
      auto_dismiss: Boolean(n.auto_dismiss),
    }));

    // Get unread count
    const { unread_count } = db.prepare(`
      SELECT COUNT(*) as unread_count FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).get(req.session.userId) as { unread_count: number };

    sendSuccess(res, {
      notifications: parsedNotifications,
      unread_count,
      pagination: {
        total: parsedNotifications.length,
        limit: limitNum,
        offset: offsetNum,
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count (for badge)
 */
router.get('/unread-count', (req: Request, res: Response) => {
  try {
    const { unread_count } = db.prepare(`
      SELECT COUNT(*) as unread_count FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).get(req.session.userId) as { unread_count: number };

    sendSuccess(res, { unread_count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId!;

    const success = notificationService.markAsRead(parseInt(id), userId);

    if (!success) {
      sendError(res, 'ไม่พบการแจ้งเตือน', 404);
      return;
    }

    sendSuccess(res, { message: 'อ่านแล้ว' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', (req: Request, res: Response) => {
  try {
    const { project_id } = req.query;
    const userId = req.session.userId!;

    const count = notificationService.markAllAsRead(
      userId,
      project_id ? parseInt(project_id as string) : undefined
    );

    sendSuccess(res, { message: `อ่านแล้ว ${count} รายการ`, count });
  } catch (error) {
    console.error('Error marking all as read:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete notification
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId!;

    const result = db.prepare(`
      DELETE FROM notifications WHERE id = ? AND user_id = ?
    `).run(id, userId);

    if (result.changes === 0) {
      sendError(res, 'ไม่พบการแจ้งเตือน', 404);
      return;
    }

    sendSuccess(res, { message: 'ลบแล้ว' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * DELETE /api/notifications
 * Delete all read notifications
 */
router.delete('/', (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;

    const result = db.prepare(`
      DELETE FROM notifications WHERE user_id = ? AND is_read = 1
    `).run(userId);

    sendSuccess(res, { message: `ลบแล้ว ${result.changes} รายการ`, count: result.changes });
  } catch (error) {
    console.error('Error deleting notifications:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/notifications/settings
 * Get user notification settings
 */
router.get('/settings', (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const settings = notificationService.getUserSettings(userId);

    if (!settings) {
      sendError(res, 'ไม่พบการตั้งค่า', 404);
      return;
    }

    sendSuccess(res, { settings });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * PUT /api/notifications/settings
 * Update user notification settings
 */
router.put('/settings', (req: Request, res: Response) => {
  try {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const userId = req.session.userId!;
    const settings = parsed.data;

    // Ensure settings exist
    const existing = db.prepare(`
      SELECT id FROM notification_settings WHERE user_id = ?
    `).get(userId);

    if (!existing) {
      db.prepare(`
        INSERT INTO notification_settings (user_id) VALUES (?)
      `).run(userId);
    }

    // Build update query
    const updateFields: string[] = [];
    const updateParams: any[] = [];

    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          updateFields.push(`${key} = ?`);
          updateParams.push(JSON.stringify(value));
        } else if (typeof value === 'boolean') {
          updateFields.push(`${key} = ?`);
          updateParams.push(value ? 1 : 0);
        } else {
          updateFields.push(`${key} = ?`);
          updateParams.push(value);
        }
      }
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = datetime(\'now\')');
      updateParams.push(userId);

      db.prepare(`
        UPDATE notification_settings
        SET ${updateFields.join(', ')}
        WHERE user_id = ?
      `).run(...updateParams);
    }

    const updatedSettings = notificationService.getUserSettings(userId);
    sendSuccess(res, { message: 'อัปเดตการตั้งค่าสำเร็จ', settings: updatedSettings });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/notifications/recent
 * Get recent notifications (last 10 unread)
 */
router.get('/recent', (req: Request, res: Response) => {
  try {
    const notifications = db.prepare(`
      SELECT 
        n.*,
        p.name_th as project_name,
        g.name_th as greenhouse_name
      FROM notifications n
      LEFT JOIN projects p ON n.project_id = p.id
      LEFT JOIN greenhouses g ON n.greenhouse_id = g.id
      WHERE n.user_id = ? AND n.is_read = 0
      ORDER BY n.created_at DESC
      LIMIT 10
    `).all(req.session.userId);

    const parsedNotifications = notifications.map((n: any) => ({
      ...n,
      metadata: JSON.parse(n.metadata || '{}'),
      is_read: Boolean(n.is_read),
      auto_dismiss: Boolean(n.auto_dismiss),
    }));

    sendSuccess(res, { notifications: parsedNotifications });
  } catch (error) {
    console.error('Error fetching recent notifications:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});


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

router.post('/control-history/notify', (req: Request, res: Response) => {
  const { greenhouse_key, control_name, action, source } = req.body as {
    greenhouse_key: string;
    control_name: string;
    action: string;
    source?: 'manual' | 'auto' | string;
  };

  // ✅ NOTE: ตารางคุณใช้ gh_key ไม่ใช่ key (จากไฟล์อื่น ๆ)
  const greenhouse = db.prepare(`
    SELECT id, project_id, name_th FROM greenhouses WHERE gh_key = ?
  `).get(greenhouse_key) as { id: number; project_id: number; name_th: string } | undefined;

  if (!greenhouse) {
    res.status(404).json({ error: 'Greenhouse not found' });
    return;
  }

  notificationService.create({
    type: 'control_action',
    severity: 'info',
    title: `${control_name} ${action}`,
    message: `${source === 'manual' ? 'ผู้ใช้สั่ง' : 'โปรแกรม'}งาน ${control_name}`,
    projectId: greenhouse.project_id,
    greenhouseId: greenhouse.id,
  });

  res.json({ success: true });
});



export default router;