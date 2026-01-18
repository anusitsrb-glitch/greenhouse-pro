/**
 * External Data API
 * Provides read-only access to greenhouse data for third-party applications
 */

import { Router, Request, Response } from 'express';
import { sendSuccess, sendError, ThaiErrors } from '../../utils/response.js';
import { tbService } from '../../services/thingsboard.js';
import { apiKeyAuth } from '../../middleware/apiKey.js';
import { z } from 'zod';

const router = Router();

// Apply API Key authentication with 'read' permission to all routes
router.use(apiKeyAuth('read'));

// ============================================================
// Validation Schemas
// ============================================================

const latestDataSchema = z.object({
  projectKey: z.string().min(1),
  ghKey: z.string().min(1),
});

const historyQuerySchema = z.object({
  days: z.string().transform(Number).optional().default('7'),
  keys: z.string().optional().default('air_temp,air_humidity,soil1_moisture,soil1_temp'),
});

const deviceStatusSchema = z.object({
  projectKey: z.string().min(1),
  ghKey: z.string().min(1),
});

// ============================================================
// Routes
// ============================================================

/**
 * GET /api/external/v1/data/greenhouses/:projectKey/:ghKey/latest
 * Get latest telemetry data
 * 
 * Example:
 * GET /api/external/v1/data/greenhouses/maejard/greenhouse8/latest
 * Headers: X-API-Key: ghp_readonly_abc123xyz789
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "soil_moisture": 45.5,
 *     "soil_temp": 28.3,
 *     "air_temp": 32.1,
 *     "air_humidity": 65.2,
 *     "timestamp": 1705478400000
 *   }
 * }
 */
router.get('/greenhouses/:projectKey/:ghKey/latest', async (req: Request, res: Response) => {
  try {
    const parsed = latestDataSchema.safeParse(req.params);
    
    if (!parsed.success) {
      sendError(res, 'Invalid parameters', 400);
      return;
    }
    
    const { projectKey, ghKey } = parsed.data;
    
    // Define keys to fetch
    const keys = [
      'soil1_moisture',
      'soil1_temp',
      'soil2_moisture',
      'soil2_temp',
      'air_temp',
      'air_humidity',
      'light',
      'co2',
    ];
    
    // Fetch latest telemetry from ThingsBoard
    const telemetry = await tbService.getLatestTelemetry(projectKey, ghKey, keys);
    
    // Format response
    const data: Record<string, any> = {};
    
    for (const key of keys) {
      const values = telemetry[key];
      if (values && values.length > 0) {
        data[key] = values[0].value;
        
        // Use the most recent timestamp
        if (!data.timestamp || values[0].ts > data.timestamp) {
          data.timestamp = values[0].ts;
        }
      }
    }
    
    sendSuccess(res, { data });
  } catch (error) {
    console.error('Error fetching latest data:', error);
    const message = error instanceof Error ? error.message : ThaiErrors.TB_CONNECTION_ERROR;
    sendError(res, message, 502);
  }
});

/**
 * GET /api/external/v1/data/greenhouses/:projectKey/:ghKey/history
 * Get historical telemetry data
 * 
 * Query Parameters:
 * - days: Number of days to fetch (default: 7)
 * - keys: Comma-separated list of telemetry keys (default: air_temp,air_humidity,soil1_moisture,soil1_temp)
 * 
 * Example:
 * GET /api/external/v1/data/greenhouses/maejard/greenhouse8/history?days=7
 * Headers: X-API-Key: ghp_readonly_abc123xyz789
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "air_temp": [
 *       { "ts": 1705478400000, "value": 32.1 },
 *       { "ts": 1705478460000, "value": 32.3 },
 *       ...
 *     ],
 *     "air_humidity": [...],
 *     ...
 *   },
 *   "metadata": {
 *     "startTime": 1705478400000,
 *     "endTime": 1706083200000,
 *     "days": 7,
 *     "keys": ["air_temp", "air_humidity", ...],
 *     "totalPoints": 1440
 *   }
 * }
 */
router.get('/greenhouses/:projectKey/:ghKey/history', async (req: Request, res: Response) => {
  try {
    const paramsResult = latestDataSchema.safeParse(req.params);
    const queryResult = historyQuerySchema.safeParse(req.query);
    
    if (!paramsResult.success || !queryResult.success) {
      sendError(res, 'Invalid parameters', 400);
      return;
    }
    
    const { projectKey, ghKey } = paramsResult.data;
    const { days, keys: keysStr } = queryResult.data;
    
    // Parse keys
    const keys = keysStr.split(',').map(k => k.trim()).filter(Boolean);
    
    if (keys.length === 0) {
      sendError(res, 'At least one key is required', 400);
      return;
    }
    
    // Calculate time range
    const endTime = Date.now();
    const startTime = endTime - (days * 24 * 60 * 60 * 1000);
    
    // Fetch telemetry history from ThingsBoard
    const telemetry = await tbService.getTelemetryTimeseries(
      projectKey,
      ghKey,
      keys,
      startTime,
      endTime
    );
    
    // Count total data points
    let totalPoints = 0;
    for (const key of keys) {
      if (telemetry[key]) {
        totalPoints += telemetry[key].length;
      }
    }
    
    sendSuccess(res, {
      data: telemetry,
      metadata: {
        startTime,
        endTime,
        days,
        keys,
        totalPoints,
      },
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    const message = error instanceof Error ? error.message : ThaiErrors.TB_CONNECTION_ERROR;
    sendError(res, message, 502);
  }
});

/**
 * GET /api/external/v1/data/devices/:projectKey/:ghKey/status
 * Get device status and attributes
 * 
 * Example:
 * GET /api/external/v1/data/devices/maejard/greenhouse8/status
 * Headers: X-API-Key: ghp_readonly_abc123xyz789
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "online": true,
 *     "status": "active",
 *     "pump": "off",
 *     "fan": "on",
 *     "light": "off"
 *   }
 * }
 */
router.get('/devices/:projectKey/:ghKey/status', async (req: Request, res: Response) => {
  try {
    const parsed = deviceStatusSchema.safeParse(req.params);
    
    if (!parsed.success) {
      sendError(res, 'Invalid parameters', 400);
      return;
    }
    
    const { projectKey, ghKey } = parsed.data;
    
    // Check if device is online
    const isOnline = await tbService.isDeviceOnline(projectKey, ghKey);
    
    // Get device attributes
    const attributeKeys = ['pump_status', 'fan_status', 'light_status', 'mode'];
    const attributes = await tbService.getAttributes(projectKey, ghKey, attributeKeys);
    
    sendSuccess(res, {
      data: {
        online: isOnline,
        status: isOnline ? 'active' : 'inactive',
        ...attributes,
      },
    });
  } catch (error) {
    console.error('Error fetching device status:', error);
    const message = error instanceof Error ? error.message : ThaiErrors.TB_CONNECTION_ERROR;
    sendError(res, message, 502);
  }
});

/**
 * GET /api/external/v1/data/devices/:projectKey/:ghKey/controls
 * Get list of controllable devices
 * 
 * Example:
 * GET /api/external/v1/data/devices/maejard/greenhouse8/controls
 * Headers: X-API-Key: ghp_readonly_abc123xyz789
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "greenhouse": "โรงเรือน 8",
 *     "controls": [
 *       {
 *         "controlKey": "pump1",
 *         "name": "ปั๊มน้ำ 1",
 *         "type": "pump",
 *         "icon": "💧"
 *       }
 *     ]
 *   }
 * }
 */
router.get('/devices/:projectKey/:ghKey/controls', async (req: Request, res: Response) => {
  try {
    const parsed = deviceStatusSchema.safeParse(req.params);
    
    if (!parsed.success) {
      sendError(res, 'Invalid parameters', 400);
      return;
    }
    
    const { projectKey, ghKey } = parsed.data;
    
    // Get project from database
    const projectQuery = `SELECT * FROM projects WHERE key = ?`;
    const project: any = (await import('../../db/connection.js')).db.prepare(projectQuery).get(projectKey);
    
    if (!project) {
      sendError(res, 'Project not found', 404);
      return;
    }
    
    // Get greenhouse from database
    const greenhouseQuery = `
      SELECT * FROM greenhouses 
      WHERE project_id = ? AND gh_key = ?
    `;
    const greenhouse: any = (await import('../../db/connection.js')).db.prepare(greenhouseQuery).get(project.id, ghKey);
    
    if (!greenhouse) {
      sendError(res, 'Greenhouse not found', 404);
      return;
    }
    
    // Get control configurations from database
    const controlsQuery = `
      SELECT control_key, name_th, name_en, control_type, icon
      FROM control_configs 
      WHERE greenhouse_id = ?
      ORDER BY display_order, id
    `;
    const controls: any[] = (await import('../../db/connection.js')).db.prepare(controlsQuery).all(greenhouse.id);
    
    // Format controls data
    const formattedControls = controls.map(control => ({
      controlKey: control.control_key,
      name: control.name_th || control.name_en,
      nameEn: control.name_en,
      type: control.control_type || 'switch',
      icon: control.icon || '🔧',
    }));
    
    sendSuccess(res, {
      data: {
        greenhouse: greenhouse.name_th || greenhouse.name_en,
        greenhouseKey: ghKey,
        totalControls: formattedControls.length,
        controls: formattedControls,
      },
    });
  } catch (error) {
    console.error('Error fetching controls list:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch controls';
    sendError(res, message, 500);
  }
});

export default router;