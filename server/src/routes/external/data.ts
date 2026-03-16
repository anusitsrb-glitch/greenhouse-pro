/**
 * External Data API
 * Provides read-only access to greenhouse data for third-party applications
 */

import { Router, Request, Response } from 'express';
import { sendSuccess, sendError, ThaiErrors } from '../../utils/response.js';
import { tbService } from '../../services/thingsboard.js';
import { apiKeyAuth } from '../../middleware/apiKey.js';
import { z } from 'zod';
import { query } from '../../db/connection.js';

const router = Router();

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

router.get('/greenhouses/:projectKey/:ghKey/latest', async (req: Request, res: Response) => {
  try {
    const parsed = latestDataSchema.safeParse(req.params);
    if (!parsed.success) { sendError(res, 'Invalid parameters', 400); return; }

    const { projectKey, ghKey } = parsed.data;

    const keys = [
      'soil1_moisture', 'soil1_temp', 'soil1_ec', 'soil1_ph', 'soil1_n', 'soil1_p', 'soil1_k',
      'soil2_moisture', 'soil2_temp', 'soil2_ec', 'soil2_ph', 'soil2_n', 'soil2_p', 'soil2_k',
      'soil3_moisture', 'soil3_temp', 'soil3_ec', 'soil3_ph', 'soil3_n', 'soil3_p', 'soil3_k',
      'soil4_moisture', 'soil4_temp', 'soil4_ec', 'soil4_ph', 'soil4_n', 'soil4_p', 'soil4_k',
      'soil5_moisture', 'soil5_temp', 'soil5_ec', 'soil5_ph', 'soil5_n', 'soil5_p', 'soil5_k',
      'soil6_moisture', 'soil6_temp', 'soil6_ec', 'soil6_ph', 'soil6_n', 'soil6_p', 'soil6_k',
      'soil7_moisture', 'soil7_temp', 'soil7_ec', 'soil7_ph', 'soil7_n', 'soil7_p', 'soil7_k',
      'soil8_moisture', 'soil8_temp', 'soil8_ec', 'soil8_ph', 'soil8_n', 'soil8_p', 'soil8_k',
      'soil9_moisture', 'soil9_temp', 'soil9_ec', 'soil9_ph', 'soil9_n', 'soil9_p', 'soil9_k',
      'soil10_moisture', 'soil10_temp', 'soil10_ec', 'soil10_ph', 'soil10_n', 'soil10_p', 'soil10_k',
      'air_temp', 'air_humidity', 'air_light', 'air_co2',
    ];

    const telemetry = await tbService.getLatestTelemetry(projectKey, ghKey, keys);

    const data: Record<string, any> = {};
    for (const key of keys) {
      const values = telemetry[key];
      if (values && values.length > 0) {
        data[key] = values[0].value;
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

router.get('/greenhouses/:projectKey/:ghKey/history', async (req: Request, res: Response) => {
  try {
    const paramsResult = latestDataSchema.safeParse(req.params);
    const queryResult = historyQuerySchema.safeParse(req.query);
    if (!paramsResult.success || !queryResult.success) { sendError(res, 'Invalid parameters', 400); return; }

    const { projectKey, ghKey } = paramsResult.data;
    const { days, keys: keysStr } = queryResult.data;
    const keys = keysStr.split(',').map(k => k.trim()).filter(Boolean);

    if (keys.length === 0) { sendError(res, 'At least one key is required', 400); return; }

    const endTime = Date.now();
    const startTime = endTime - (days * 24 * 60 * 60 * 1000);

    const telemetry = await tbService.getTelemetryTimeseries(projectKey, ghKey, keys, startTime, endTime);

    let totalPoints = 0;
    for (const key of keys) {
      if (telemetry[key]) totalPoints += telemetry[key].length;
    }

    sendSuccess(res, { data: telemetry, metadata: { startTime, endTime, days, keys, totalPoints } });
  } catch (error) {
    console.error('Error fetching history:', error);
    const message = error instanceof Error ? error.message : ThaiErrors.TB_CONNECTION_ERROR;
    sendError(res, message, 502);
  }
});

router.get('/devices/:projectKey/:ghKey/status', async (req: Request, res: Response) => {
  try {
    const parsed = deviceStatusSchema.safeParse(req.params);
    if (!parsed.success) { sendError(res, 'Invalid parameters', 400); return; }

    const { projectKey, ghKey } = parsed.data;

    const isOnline = await tbService.isDeviceOnline(projectKey, ghKey);
    const attributes = await tbService.getAttributes(projectKey, ghKey, ['pump_status', 'fan_status', 'light_status', 'mode']);

    sendSuccess(res, { data: { online: isOnline, status: isOnline ? 'active' : 'inactive', ...attributes } });
  } catch (error) {
    console.error('Error fetching device status:', error);
    const message = error instanceof Error ? error.message : ThaiErrors.TB_CONNECTION_ERROR;
    sendError(res, message, 502);
  }
});

router.get('/devices/:projectKey/:ghKey/controls', async (req: Request, res: Response) => {
  try {
    const parsed = deviceStatusSchema.safeParse(req.params);
    if (!parsed.success) { sendError(res, 'Invalid parameters', 400); return; }

    const { projectKey, ghKey } = parsed.data;

    // Get project and greenhouse
    const projectResult = await query('SELECT * FROM projects WHERE key = $1', [projectKey]);
    const project = projectResult.rows[0] as any;
    if (!project) { sendError(res, 'Project not found', 404); return; }

    const ghResult = await query(`
      SELECT * FROM greenhouses WHERE project_id = $1 AND gh_key = $2
    `, [project.id, ghKey]);
    const greenhouse = ghResult.rows[0] as any;
    if (!greenhouse) { sendError(res, 'Greenhouse not found', 404); return; }

    try {
      const attributes = await tbService.getAttributes(projectKey, ghKey, [
        'fan_1_cmd', 'fan_2_cmd', 'pump_1_cmd', 'valve_2_cmd', 'light_1_cmd',
        'motor_1_fw', 'motor_1_re', 'motor_2_fw', 'motor_2_re',
        'motor_3_fw', 'motor_3_re', 'motor_4_fw', 'motor_4_re',
      ]);

      const controlMap: Record<string, { controlKey: string; type: string; icon: string; nameTH: string; state?: 'fw' | 're' }> = {
        fan_1_cmd:   { controlKey: 'fan1',   type: 'fan',   icon: '🌀', nameTH: 'พัดลม 1' },
        fan_2_cmd:   { controlKey: 'fan2',   type: 'fan',   icon: '🌀', nameTH: 'พัดลม 2' },
        pump_1_cmd:  { controlKey: 'pump1',  type: 'pump',  icon: '💧', nameTH: 'ปั๊มน้ำ 1' },
        valve_2_cmd: { controlKey: 'valve2', type: 'valve', icon: '🚰', nameTH: 'วาล์ว 2' },
        light_1_cmd: { controlKey: 'light1', type: 'light', icon: '💡', nameTH: 'ไฟ 1' },
        motor_1_fw:  { controlKey: 'motor1', type: 'motor', icon: '⚙️', nameTH: 'มอเตอร์ 1', state: 'fw' },
        motor_1_re:  { controlKey: 'motor1', type: 'motor', icon: '⚙️', nameTH: 'มอเตอร์ 1', state: 're' },
        motor_2_fw:  { controlKey: 'motor2', type: 'motor', icon: '⚙️', nameTH: 'มอเตอร์ 2', state: 'fw' },
        motor_2_re:  { controlKey: 'motor2', type: 'motor', icon: '⚙️', nameTH: 'มอเตอร์ 2', state: 're' },
        motor_3_fw:  { controlKey: 'motor3', type: 'motor', icon: '⚙️', nameTH: 'มอเตอร์ 3', state: 'fw' },
        motor_3_re:  { controlKey: 'motor3', type: 'motor', icon: '⚙️', nameTH: 'มอเตอร์ 3', state: 're' },
        motor_4_fw:  { controlKey: 'motor4', type: 'motor', icon: '⚙️', nameTH: 'มอเตอร์ 4', state: 'fw' },
        motor_4_re:  { controlKey: 'motor4', type: 'motor', icon: '⚙️', nameTH: 'มอเตอร์ 4', state: 're' },
      };

      const motorGroups: Record<string, { fw: boolean; re: boolean }> = {};

      const controls = Object.keys(attributes)
        .filter(key => controlMap[key])
        .map(key => {
          const config = controlMap[key];
          if (config.type === 'motor' && config.state) {
            const motorKey = config.controlKey;
            if (!motorGroups[motorKey]) motorGroups[motorKey] = { fw: false, re: false };
            motorGroups[motorKey][config.state] = attributes[key] === true || attributes[key] === 'true' || attributes[key] === 1;
            return null;
          }
          return {
            controlKey: config.controlKey,
            name: config.nameTH,
            type: config.type,
            icon: config.icon,
            status: attributes[key] === true || attributes[key] === 'true' || attributes[key] === 1,
          };
        })
        .filter(Boolean);

      Object.entries(motorGroups).forEach(([motorKey, states]) => {
        const motorNumber = motorKey.replace('motor', '');
        const status: 'forward' | 'reverse' | 'stop' = states.fw ? 'forward' : states.re ? 'reverse' : 'stop';
        controls.push({ controlKey: motorKey, name: `มอเตอร์ ${motorNumber}`, type: 'motor', icon: '⚙️', status } as any);
      });

      sendSuccess(res, {
        data: { greenhouse: greenhouse.name_th || greenhouse.name_en, greenhouseKey: ghKey, totalControls: controls.length, controls },
      });
    } catch (tbError) {
      console.error('ThingsBoard error (returning empty controls):', tbError);
      sendSuccess(res, {
        data: { greenhouse: greenhouse.name_th || greenhouse.name_en, greenhouseKey: ghKey, totalControls: 0, controls: [] },
      });
    }
  } catch (error) {
    console.error('Error fetching controls list:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch controls';
    sendError(res, message, 500);
  }
});

export default router;