/**
 * Agriculture Routes
 * Crops, Growth Records, Fertilizer, Pest/Disease, Yield, Weather
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth, requireOperator } from '../middleware/auth.js';
import { logAudit, AuditActions } from '../utils/audit.js';

const router = Router();

// ============================================================
// CROPS
// ============================================================

router.get('/crops', requireAuth, (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, status } = req.query;
    
    let query = `
      SELECT c.*, g.name_th as greenhouse_name, p.name_th as project_name
      FROM crops c
      JOIN greenhouses g ON c.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (project_key) {
      query += ` AND p.key = ?`;
      params.push(project_key);
    }
    if (gh_key) {
      query += ` AND g.gh_key = ?`;
      params.push(gh_key);
    }
    if (status) {
      query += ` AND c.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY c.plant_date DESC`;
    const crops = db.prepare(query).all(...params);
    sendSuccess(res, { crops });
  } catch (error) {
    console.error('Error fetching crops:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/crops', requireOperator, (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, name, variety, plant_date, expected_harvest_date, quantity, unit, notes } = req.body;

    const greenhouse = db.prepare(`
      SELECT g.id FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ?
    `).get(project_key, gh_key) as any;

    if (!greenhouse) {
      sendError(res, 'ไม่พบโรงเรือน', 404);
      return;
    }

    const result = db.prepare(`
      INSERT INTO crops (greenhouse_id, name, variety, plant_date, expected_harvest_date, quantity, unit, status, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'planted', ?, ?)
    `).run(greenhouse.id, name, variety || null, plant_date, expected_harvest_date, quantity || 0, unit || 'ต้น', notes || null, req.session.userId);

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.CREATED, detail: { entity: 'crop', name } });
    sendSuccess(res, { id: result.lastInsertRowid, message: 'เพิ่มพืชสำเร็จ' });
  } catch (error) {
    console.error('Error creating crop:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.put('/crops/:id', requireOperator, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, variety, plant_date, expected_harvest_date, actual_harvest_date, quantity, unit, status, notes } = req.body;

    db.prepare(`
      UPDATE crops SET name = ?, variety = ?, plant_date = ?, expected_harvest_date = ?, actual_harvest_date = ?, quantity = ?, unit = ?, status = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, variety || null, plant_date, expected_harvest_date, actual_harvest_date || null, quantity, unit, status, notes || null, id);

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.UPDATED, detail: { entity: 'crop', id } });
    sendSuccess(res, { message: 'อัปเดตสำเร็จ' });
  } catch (error) {
    console.error('Error updating crop:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.delete('/crops/:id', requireOperator, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM crops WHERE id = ?').run(id);
    logAudit({ userId: req.session.userId ?? null, action: AuditActions.DELETED, detail: { entity: 'crop', id } });
    sendSuccess(res, { message: 'ลบสำเร็จ' });
  } catch (error) {
    console.error('Error deleting crop:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// GROWTH RECORDS
// ============================================================

router.get('/crops/:cropId/growth', requireAuth, (req: Request, res: Response) => {
  try {
    const { cropId } = req.params;
    const records = db.prepare(`
      SELECT gr.*, u.username as recorded_by_name
      FROM growth_records gr
      LEFT JOIN users u ON gr.recorded_by = u.id
      WHERE gr.crop_id = ?
      ORDER BY gr.record_date DESC
    `).all(cropId);
    sendSuccess(res, { records });
  } catch (error) {
    console.error('Error fetching growth records:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/crops/:cropId/growth', requireOperator, (req: Request, res: Response) => {
  try {
    const { cropId } = req.params;
    const { record_date, height, leaf_count, health_status, notes, photo_url } = req.body;

    const result = db.prepare(`
      INSERT INTO growth_records (crop_id, record_date, height, leaf_count, health_status, notes, photo_url, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(cropId, record_date, height || null, leaf_count || null, health_status || null, notes || null, photo_url || null, req.session.userId);

    sendSuccess(res, { id: result.lastInsertRowid, message: 'บันทึกสำเร็จ' });
  } catch (error) {
    console.error('Error creating growth record:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// FERTILIZER SCHEDULES
// ============================================================

router.get('/fertilizer', requireAuth, (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, completed } = req.query;
    
    let query = `
      SELECT fs.*, g.name_th as greenhouse_name, c.name as crop_name
      FROM fertilizer_schedules fs
      JOIN greenhouses g ON fs.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      LEFT JOIN crops c ON fs.crop_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (project_key) { query += ` AND p.key = ?`; params.push(project_key); }
    if (gh_key) { query += ` AND g.gh_key = ?`; params.push(gh_key); }
    if (completed !== undefined) { query += ` AND fs.is_completed = ?`; params.push(completed === 'true' ? 1 : 0); }

    query += ` ORDER BY fs.schedule_date ASC`;
    const schedules = db.prepare(query).all(...params);
    sendSuccess(res, { schedules });
  } catch (error) {
    console.error('Error fetching fertilizer schedules:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/fertilizer', requireOperator, (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, crop_id, fertilizer_name, fertilizer_type, amount, unit, schedule_date, notes } = req.body;

    const greenhouse = db.prepare(`
      SELECT g.id FROM greenhouses g JOIN projects p ON g.project_id = p.id WHERE p.key = ? AND g.gh_key = ?
    `).get(project_key, gh_key) as any;

    if (!greenhouse) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const result = db.prepare(`
      INSERT INTO fertilizer_schedules (greenhouse_id, crop_id, fertilizer_name, fertilizer_type, amount, unit, schedule_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(greenhouse.id, crop_id || null, fertilizer_name, fertilizer_type || null, amount || null, unit || 'g', schedule_date, notes || null);

    sendSuccess(res, { id: result.lastInsertRowid, message: 'เพิ่มตารางปุ๋ยสำเร็จ' });
  } catch (error) {
    console.error('Error creating fertilizer schedule:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.put('/fertilizer/:id/complete', requireOperator, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    db.prepare(`UPDATE fertilizer_schedules SET is_completed = 1, completed_at = datetime('now'), completed_by = ? WHERE id = ?`).run(req.session.userId, id);
    sendSuccess(res, { message: 'บันทึกสำเร็จ' });
  } catch (error) {
    console.error('Error completing fertilizer:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// PEST/DISEASE RECORDS
// ============================================================

router.get('/pest-disease', requireAuth, (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, type, resolved } = req.query;
    
    let query = `
      SELECT pdr.*, g.name_th as greenhouse_name, c.name as crop_name
      FROM pest_disease_records pdr
      JOIN greenhouses g ON pdr.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      LEFT JOIN crops c ON pdr.crop_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (project_key) { query += ` AND p.key = ?`; params.push(project_key); }
    if (gh_key) { query += ` AND g.gh_key = ?`; params.push(gh_key); }
    if (type) { query += ` AND pdr.record_type = ?`; params.push(type); }
    if (resolved !== undefined) { query += ` AND pdr.resolved = ?`; params.push(resolved === 'true' ? 1 : 0); }

    query += ` ORDER BY pdr.created_at DESC`;
    const records = db.prepare(query).all(...params);
    sendSuccess(res, { records });
  } catch (error) {
    console.error('Error fetching pest/disease records:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/pest-disease', requireOperator, (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, crop_id, record_type, name, severity, affected_area, treatment, photo_url, notes } = req.body;

    const greenhouse = db.prepare(`
      SELECT g.id FROM greenhouses g JOIN projects p ON g.project_id = p.id WHERE p.key = ? AND g.gh_key = ?
    `).get(project_key, gh_key) as any;

    if (!greenhouse) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const result = db.prepare(`
      INSERT INTO pest_disease_records (greenhouse_id, crop_id, record_type, name, severity, affected_area, treatment, photo_url, notes, reported_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(greenhouse.id, crop_id || null, record_type, name, severity || null, affected_area || null, treatment || null, photo_url || null, notes || null, req.session.userId);

    sendSuccess(res, { id: result.lastInsertRowid, message: 'บันทึกสำเร็จ' });
  } catch (error) {
    console.error('Error creating pest/disease record:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// YIELD RECORDS
// ============================================================

router.get('/yield', requireAuth, (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, start_date, end_date } = req.query;
    
    let query = `
      SELECT yr.*, g.name_th as greenhouse_name, c.name as crop_name
      FROM yield_records yr
      JOIN greenhouses g ON yr.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      LEFT JOIN crops c ON yr.crop_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (project_key) { query += ` AND p.key = ?`; params.push(project_key); }
    if (gh_key) { query += ` AND g.gh_key = ?`; params.push(gh_key); }
    if (start_date) { query += ` AND yr.harvest_date >= ?`; params.push(start_date); }
    if (end_date) { query += ` AND yr.harvest_date <= ?`; params.push(end_date); }

    query += ` ORDER BY yr.harvest_date DESC`;
    const records = db.prepare(query).all(...params);

    // Calculate totals
    const totals = db.prepare(`
      SELECT SUM(quantity) as total_quantity, SUM(total_revenue) as total_revenue
      FROM yield_records yr
      JOIN greenhouses g ON yr.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE 1=1 ${project_key ? 'AND p.key = ?' : ''} ${gh_key ? 'AND g.gh_key = ?' : ''}
    `).get(...params.filter((_, i) => i < 2)) as any;

    sendSuccess(res, { records, totals });
  } catch (error) {
    console.error('Error fetching yield records:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/yield', requireOperator, (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, crop_id, harvest_date, quantity, unit, quality_grade, price_per_unit, notes } = req.body;

    const greenhouse = db.prepare(`
      SELECT g.id FROM greenhouses g JOIN projects p ON g.project_id = p.id WHERE p.key = ? AND g.gh_key = ?
    `).get(project_key, gh_key) as any;

    if (!greenhouse) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const total_revenue = (quantity || 0) * (price_per_unit || 0);

    const result = db.prepare(`
      INSERT INTO yield_records (greenhouse_id, crop_id, harvest_date, quantity, unit, quality_grade, price_per_unit, total_revenue, notes, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(greenhouse.id, crop_id || null, harvest_date, quantity, unit || 'kg', quality_grade || null, price_per_unit || null, total_revenue, notes || null, req.session.userId);

    sendSuccess(res, { id: result.lastInsertRowid, message: 'บันทึกผลผลิตสำเร็จ' });
  } catch (error) {
    console.error('Error creating yield record:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// WATER USAGE
// ============================================================

router.get('/water-usage', requireAuth, (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, start_date, end_date } = req.query;
    
    let query = `
      SELECT wu.*, g.name_th as greenhouse_name
      FROM water_usage wu
      JOIN greenhouses g ON wu.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (project_key) { query += ` AND p.key = ?`; params.push(project_key); }
    if (gh_key) { query += ` AND g.gh_key = ?`; params.push(gh_key); }
    if (start_date) { query += ` AND wu.record_date >= ?`; params.push(start_date); }
    if (end_date) { query += ` AND wu.record_date <= ?`; params.push(end_date); }

    query += ` ORDER BY wu.record_date DESC`;
    const records = db.prepare(query).all(...params);

    // Calculate totals
    const totals = db.prepare(`
      SELECT SUM(usage_liters) as total_liters, SUM(cost) as total_cost
      FROM water_usage wu
      JOIN greenhouses g ON wu.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE 1=1 ${project_key ? 'AND p.key = ?' : ''} ${gh_key ? 'AND g.gh_key = ?' : ''}
    `).get(...params.filter((_, i) => i < 2)) as any;

    sendSuccess(res, { records, totals });
  } catch (error) {
    console.error('Error fetching water usage:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/water-usage', requireOperator, (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, record_date, usage_liters, source, cost, notes } = req.body;

    const greenhouse = db.prepare(`
      SELECT g.id FROM greenhouses g JOIN projects p ON g.project_id = p.id WHERE p.key = ? AND g.gh_key = ?
    `).get(project_key, gh_key) as any;

    if (!greenhouse) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const result = db.prepare(`
      INSERT INTO water_usage (greenhouse_id, record_date, usage_liters, source, cost, notes, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(greenhouse.id, record_date, usage_liters, source || null, cost || null, notes || null, req.session.userId);

    sendSuccess(res, { id: result.lastInsertRowid, message: 'บันทึกการใช้น้ำสำเร็จ' });
  } catch (error) {
    console.error('Error creating water usage record:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// WEATHER (OpenWeatherMap)
// ============================================================

router.get('/weather', requireAuth, async (req: Request, res: Response) => {
  try {
    const { lat, lon } = req.query;
    
    // Get API key from settings
    const apiKeySetting = db.prepare(`SELECT api_key FROM system_api_keys WHERE service_name = 'openweathermap' AND is_active = 1`).get() as any;
    
    if (!apiKeySetting) {
      sendError(res, 'ยังไม่ได้ตั้งค่า Weather API Key', 400);
      return;
    }

    // Default location: Chiang Mai
    const latitude = lat || '18.7883';
    const longitude = lon || '98.9853';

    // Check cache first
    const cached = db.prepare(`
      SELECT * FROM weather_cache 
      WHERE location = ? 
      AND fetched_at > datetime('now', '-30 minutes')
    `).get(`${latitude},${longitude}`) as any;

    if (cached) {
      sendSuccess(res, {
        weather: JSON.parse(cached.weather_data),
        forecast: cached.forecast_data ? JSON.parse(cached.forecast_data) : null,
        cached: true,
      });
      return;
    }

    // Fetch from API
    const fetch = (await import('node-fetch')).default;
    const weatherResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKeySetting.api_key}&units=metric&lang=th`
    );
    const weatherData = await weatherResponse.json();

    const forecastResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKeySetting.api_key}&units=metric&lang=th&cnt=8`
    );
    const forecastData = await forecastResponse.json();

    // Cache the result
    db.prepare(`
      INSERT OR REPLACE INTO weather_cache (location, weather_data, forecast_data, fetched_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(`${latitude},${longitude}`, JSON.stringify(weatherData), JSON.stringify(forecastData));

    sendSuccess(res, {
      weather: weatherData,
      forecast: forecastData,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching weather:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;
