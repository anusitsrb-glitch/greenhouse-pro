import { Router, Request, Response } from 'express';
import { query } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const CACHE_MINUTES = 3;

// GET /api/weather/:projectKey/:ghKey
router.get('/:projectKey/:ghKey', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;

    // Resolve greenhouse
    const ghRes = await query(`
      SELECT g.id FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = $1 AND g.gh_key = $2
    `, [projectKey, ghKey]);
    const greenhouse = ghRes.rows[0];
    if (!greenhouse) { sendError(res, ThaiErrors.GREENHOUSE_NOT_FOUND, 404); return; }

    // Get weather config (fallback to Bangkok)
    const configRes = await query(
      'SELECT * FROM weather_configs WHERE greenhouse_id = $1',
      [greenhouse.id]
    );
    const config = configRes.rows[0] ?? {
      location_name: 'กรุงเทพมหานคร',
      latitude: 13.7563,
      longitude: 100.5018,
      show_temperature: 1,
      show_humidity: 1,
      show_condition: 1,
      show_wind_speed: 1,
      show_uv_index: 0,
      show_rain_chance: 1,
    };

    const cacheKey = `${config.latitude},${config.longitude}`;

    // Check cache
    const cacheRes = await query(
      'SELECT weather_data, fetched_at FROM weather_cache WHERE location = $1',
      [cacheKey]
    );
    if (cacheRes.rows.length > 0) {
      const cached = cacheRes.rows[0];
      const fetchedAt = new Date(cached.fetched_at);
      const diffMinutes = (Date.now() - fetchedAt.getTime()) / 1000 / 60;
      if (diffMinutes < CACHE_MINUTES) {
        return sendSuccess(res, {
          weather: JSON.parse(cached.weather_data),
          config,
          cached: true,
        });
      }
    }

    // Fetch from Open-Meteo
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${config.latitude}&longitude=${config.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,uv_index,precipitation_probability&timezone=Asia%2FBangkok`;
    const response = await fetch(url);
    if (!response.ok) { sendError(res, 'ไม่สามารถดึงข้อมูลสภาพอากาศได้', 502); return; }

    const data = await response.json() as any;
    const current = data.current;

    const weather = {
      temperature: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      weather_code: current.weather_code,
      condition: getWeatherCondition(current.weather_code),
      wind_speed: current.wind_speed_10m,
      uv_index: current.uv_index,
      rain_chance: current.precipitation_probability,
      location_name: config.location_name,
      updated_at: current.time,
    };

    // Upsert cache
    await query(`
      INSERT INTO weather_cache (location, weather_data, fetched_at)
      VALUES ($1, $2, now()::text)
      ON CONFLICT (location) DO UPDATE SET
        weather_data = $2,
        fetched_at = now()::text
    `, [cacheKey, JSON.stringify(weather)]);

    sendSuccess(res, { weather, config, cached: false });
  } catch (error) {
    console.error('Weather fetch error:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

function getWeatherCondition(code: number): { label_th: string; icon: string } {
  if (code === 0) return { label_th: 'ท้องฟ้าแจ่มใส', icon: 'sunny' };
  if (code <= 2) return { label_th: 'มีเมฆบางส่วน', icon: 'partly_cloudy' };
  if (code <= 3) return { label_th: 'มีเมฆมาก', icon: 'cloudy' };
  if (code <= 49) return { label_th: 'หมอก', icon: 'foggy' };
  if (code <= 59) return { label_th: 'ฝนปรอย', icon: 'drizzle' };
  if (code <= 69) return { label_th: 'ฝนตก', icon: 'rainy' };
  if (code <= 79) return { label_th: 'หิมะ', icon: 'snowy' };
  if (code <= 82) return { label_th: 'ฝนหนัก', icon: 'heavy_rain' };
  if (code <= 99) return { label_th: 'พายุฝนฟ้าคะนอง', icon: 'thunderstorm' };
  return { label_th: 'ไม่ทราบ', icon: 'unknown' };
}

export default router;