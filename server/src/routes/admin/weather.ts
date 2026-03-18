import { Router, Request, Response } from 'express';
import { query } from '../../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../../utils/response.js';
import { requireSuperAdmin } from '../../middleware/auth.js';
import { z } from 'zod';

const router = Router();
router.use(requireSuperAdmin);

const updateWeatherConfigSchema = z.object({
  location_name: z.string().min(1).max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  show_temperature: z.number().int().min(0).max(1).optional(),
  show_humidity: z.number().int().min(0).max(1).optional(),
  show_condition: z.number().int().min(0).max(1).optional(),
  show_wind_speed: z.number().int().min(0).max(1).optional(),
  show_uv_index: z.number().int().min(0).max(1).optional(),
  show_rain_chance: z.number().int().min(0).max(1).optional(),
});

// GET /api/admin/weather/:projectKey/:ghKey
router.get('/:projectKey/:ghKey', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const ghRes = await query(`
      SELECT g.id FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = $1 AND g.gh_key = $2
    `, [projectKey, ghKey]);
    const greenhouse = ghRes.rows[0];
    if (!greenhouse) { sendError(res, ThaiErrors.GREENHOUSE_NOT_FOUND, 404); return; }

    const configRes = await query(
      'SELECT * FROM weather_configs WHERE greenhouse_id = $1',
      [greenhouse.id]
    );

    if (configRes.rows.length === 0) {
      // Return default config if not set
      sendSuccess(res, {
        config: {
          greenhouse_id: greenhouse.id,
          location_name: 'กรุงเทพมหานคร',
          latitude: 13.7563,
          longitude: 100.5018,
          show_temperature: 1,
          show_humidity: 1,
          show_condition: 1,
          show_wind_speed: 1,
          show_uv_index: 0,
          show_rain_chance: 1,
        }
      });
      return;
    }

    sendSuccess(res, { config: configRes.rows[0] });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// PUT /api/admin/weather/:projectKey/:ghKey
router.put('/:projectKey/:ghKey', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const parsed = updateWeatherConfigSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, ThaiErrors.INVALID_INPUT, 400); return; }

    const ghRes = await query(`
      SELECT g.id FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = $1 AND g.gh_key = $2
    `, [projectKey, ghKey]);
    const greenhouse = ghRes.rows[0];
    if (!greenhouse) { sendError(res, ThaiErrors.GREENHOUSE_NOT_FOUND, 404); return; }

    const d = parsed.data;
    await query(`
      INSERT INTO weather_configs (greenhouse_id, location_name, latitude, longitude,
        show_temperature, show_humidity, show_condition, show_wind_speed, show_uv_index, show_rain_chance)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (greenhouse_id) DO UPDATE SET
        location_name = COALESCE($2, weather_configs.location_name),
        latitude = COALESCE($3, weather_configs.latitude),
        longitude = COALESCE($4, weather_configs.longitude),
        show_temperature = COALESCE($5, weather_configs.show_temperature),
        show_humidity = COALESCE($6, weather_configs.show_humidity),
        show_condition = COALESCE($7, weather_configs.show_condition),
        show_wind_speed = COALESCE($8, weather_configs.show_wind_speed),
        show_uv_index = COALESCE($9, weather_configs.show_uv_index),
        show_rain_chance = COALESCE($10, weather_configs.show_rain_chance),
        updated_at = now()::text
    `, [
      greenhouse.id,
      d.location_name ?? 'กรุงเทพมหานคร',
      d.latitude ?? 13.7563,
      d.longitude ?? 100.5018,
      d.show_temperature ?? 1,
      d.show_humidity ?? 1,
      d.show_condition ?? 1,
      d.show_wind_speed ?? 1,
      d.show_uv_index ?? 0,
      d.show_rain_chance ?? 1,
    ]);

    sendSuccess(res, { message: 'บันทึกการตั้งค่าสภาพอากาศสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;