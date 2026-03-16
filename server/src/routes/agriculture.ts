import { Router, Request, Response } from 'express';
import { query } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth, requireOperator } from '../middleware/auth.js';
import { logAudit, AuditActions } from '../utils/audit.js';

const router = Router();

// Helper: get greenhouse id
async function getGreenhouseId(projectKey: string, ghKey: string): Promise<number | null> {
  const result = await query(`
    SELECT g.id FROM greenhouses g
    JOIN projects p ON g.project_id = p.id
    WHERE p.key = $1 AND g.gh_key = $2
  `, [projectKey, ghKey]);
  return result.rows[0]?.id ?? null;
}

// Helper: build filter query
function buildFilter(base: string, filters: { key: string; col: string; val: any }[], extra = '') {
  const params: any[] = [];
  let idx = 1;
  let sql = base;
  for (const f of filters) {
    if (f.val !== undefined && f.val !== null && f.val !== '') {
      sql += ` AND ${f.col} = $${idx++}`;
      params.push(f.val);
    }
  }
  sql += extra;
  return { sql, params };
}

// ============================================================
// CROPS
// ============================================================

router.get('/crops', requireAuth, async (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, status } = req.query;
    const { sql, params } = buildFilter(`
      SELECT c.*, g.name_th as greenhouse_name, p.name_th as project_name
      FROM crops c
      JOIN greenhouses g ON c.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE 1=1
    `, [
      { key: 'project_key', col: 'p.key', val: project_key },
      { key: 'gh_key', col: 'g.gh_key', val: gh_key },
      { key: 'status', col: 'c.status', val: status },
    ], ' ORDER BY c.plant_date DESC');

    const result = await query(sql, params);
    sendSuccess(res, { crops: result.rows });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/crops', requireOperator, async (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, name, variety, plant_date, expected_harvest_date, quantity, unit, notes } = req.body;
    const ghId = await getGreenhouseId(project_key, gh_key);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const result = await query(`
      INSERT INTO crops (greenhouse_id, name, variety, plant_date, expected_harvest_date, quantity, unit, status, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'planted',$8,$9) RETURNING id
    `, [ghId, name, variety || null, plant_date, expected_harvest_date, quantity || 0, unit || 'ต้น', notes || null, req.session.userId]);

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.CREATED, detail: { entity: 'crop', name } });
    sendSuccess(res, { id: result.rows[0].id, message: 'เพิ่มพืชสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.put('/crops/:id', requireOperator, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, variety, plant_date, expected_harvest_date, actual_harvest_date, quantity, unit, status, notes } = req.body;
    await query(`
      UPDATE crops SET name=$1, variety=$2, plant_date=$3, expected_harvest_date=$4,
      actual_harvest_date=$5, quantity=$6, unit=$7, status=$8, notes=$9, updated_at=now()::text
      WHERE id=$10
    `, [name, variety || null, plant_date, expected_harvest_date, actual_harvest_date || null, quantity, unit, status, notes || null, id]);

    logAudit({ userId: req.session.userId ?? null, action: AuditActions.UPDATED, detail: { entity: 'crop', id } });
    sendSuccess(res, { message: 'อัปเดตสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.delete('/crops/:id', requireOperator, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM crops WHERE id = $1', [id]);
    logAudit({ userId: req.session.userId ?? null, action: AuditActions.DELETED, detail: { entity: 'crop', id } });
    sendSuccess(res, { message: 'ลบสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// GROWTH RECORDS
// ============================================================

router.get('/crops/:cropId/growth', requireAuth, async (req: Request, res: Response) => {
  try {
    const { cropId } = req.params;
    const result = await query(`
      SELECT gr.*, u.username as recorded_by_name
      FROM growth_records gr
      LEFT JOIN users u ON gr.recorded_by = u.id
      WHERE gr.crop_id = $1 ORDER BY gr.record_date DESC
    `, [cropId]);
    sendSuccess(res, { records: result.rows });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/crops/:cropId/growth', requireOperator, async (req: Request, res: Response) => {
  try {
    const { cropId } = req.params;
    const { record_date, height, leaf_count, health_status, notes, photo_url } = req.body;
    const result = await query(`
      INSERT INTO growth_records (crop_id, record_date, height, leaf_count, health_status, notes, photo_url, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id
    `, [cropId, record_date, height || null, leaf_count || null, health_status || null, notes || null, photo_url || null, req.session.userId]);
    sendSuccess(res, { id: result.rows[0].id, message: 'บันทึกสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.put('/growth/:id', requireOperator, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { record_date, height, leaf_count, health_status, notes, photo_url } = req.body;
    await query(`
      UPDATE growth_records SET record_date=$1, height=$2, leaf_count=$3, health_status=$4, notes=$5, photo_url=$6
      WHERE id=$7
    `, [record_date, height || null, leaf_count || null, health_status || null, notes || null, photo_url || null, id]);
    sendSuccess(res, { message: 'อัปเดตสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.delete('/growth/:id', requireOperator, async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM growth_records WHERE id = $1', [req.params.id]);
    sendSuccess(res, { message: 'ลบสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// FERTILIZER
// ============================================================

router.get('/fertilizer', requireAuth, async (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, completed } = req.query;
    const filters: any[] = [
      { key: 'project_key', col: 'p.key', val: project_key },
      { key: 'gh_key', col: 'g.gh_key', val: gh_key },
    ];
    let sql = `
      SELECT fs.*, g.name_th as greenhouse_name, c.name as crop_name
      FROM fertilizer_schedules fs
      JOIN greenhouses g ON fs.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      LEFT JOIN crops c ON fs.crop_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (project_key) { sql += ` AND p.key = $${idx++}`; params.push(project_key); }
    if (gh_key) { sql += ` AND g.gh_key = $${idx++}`; params.push(gh_key); }
    if (completed !== undefined) { sql += ` AND fs.is_completed = $${idx++}`; params.push(completed === 'true' ? 1 : 0); }
    sql += ' ORDER BY fs.schedule_date ASC';

    const result = await query(sql, params);
    sendSuccess(res, { schedules: result.rows });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/fertilizer', requireOperator, async (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, crop_id, fertilizer_name, fertilizer_type, amount, unit, schedule_date, notes } = req.body;
    const ghId = await getGreenhouseId(project_key, gh_key);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const result = await query(`
      INSERT INTO fertilizer_schedules (greenhouse_id, crop_id, fertilizer_name, fertilizer_type, amount, unit, schedule_date, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id
    `, [ghId, crop_id || null, fertilizer_name, fertilizer_type || null, amount || null, unit || 'g', schedule_date, notes || null]);
    sendSuccess(res, { id: result.rows[0].id, message: 'เพิ่มตารางปุ๋ยสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.put('/fertilizer/:id', requireOperator, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { fertilizer_name, fertilizer_type, amount, unit, schedule_date, notes } = req.body;
    await query(`
      UPDATE fertilizer_schedules SET fertilizer_name=$1, fertilizer_type=$2, amount=$3, unit=$4, schedule_date=$5, notes=$6
      WHERE id=$7
    `, [fertilizer_name, fertilizer_type || null, amount || null, unit || 'g', schedule_date, notes || null, id]);
    sendSuccess(res, { message: 'อัปเดตสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.put('/fertilizer/:id/complete', requireOperator, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await query(`UPDATE fertilizer_schedules SET is_completed=1, completed_at=now()::text, completed_by=$1 WHERE id=$2`, [req.session.userId, id]);
    sendSuccess(res, { message: 'บันทึกสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.delete('/fertilizer/:id', requireOperator, async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM fertilizer_schedules WHERE id = $1', [req.params.id]);
    sendSuccess(res, { message: 'ลบสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// PEST/DISEASE
// ============================================================

router.get('/pest-disease', requireAuth, async (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, type, resolved } = req.query;
    let sql = `
      SELECT pdr.*, g.name_th as greenhouse_name, c.name as crop_name
      FROM pest_disease_records pdr
      JOIN greenhouses g ON pdr.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      LEFT JOIN crops c ON pdr.crop_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (project_key) { sql += ` AND p.key = $${idx++}`; params.push(project_key); }
    if (gh_key) { sql += ` AND g.gh_key = $${idx++}`; params.push(gh_key); }
    if (type) { sql += ` AND pdr.record_type = $${idx++}`; params.push(type); }
    if (resolved !== undefined) { sql += ` AND pdr.resolved = $${idx++}`; params.push(resolved === 'true' ? 1 : 0); }
    sql += ' ORDER BY pdr.created_at DESC';

    const result = await query(sql, params);
    sendSuccess(res, { records: result.rows });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/pest-disease', requireOperator, async (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, crop_id, record_type, name, severity, affected_area, treatment, photo_url, notes } = req.body;
    const ghId = await getGreenhouseId(project_key, gh_key);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const result = await query(`
      INSERT INTO pest_disease_records (greenhouse_id, crop_id, record_type, name, severity, affected_area, treatment, photo_url, notes, reported_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id
    `, [ghId, crop_id || null, record_type, name, severity || null, affected_area || null, treatment || null, photo_url || null, notes || null, req.session.userId]);
    sendSuccess(res, { id: result.rows[0].id, message: 'บันทึกสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.put('/pest-disease/:id', requireOperator, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { record_type, name, severity, affected_area, treatment, photo_url, notes } = req.body;
    await query(`
      UPDATE pest_disease_records SET record_type=$1, name=$2, severity=$3, affected_area=$4, treatment=$5, photo_url=$6, notes=$7
      WHERE id=$8
    `, [record_type, name, severity || null, affected_area || null, treatment || null, photo_url || null, notes || null, id]);
    sendSuccess(res, { message: 'อัปเดตสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.put('/pest-disease/:id/resolve', requireOperator, async (req: Request, res: Response) => {
  try {
    await query(`UPDATE pest_disease_records SET resolved=1, resolved_at=now()::text WHERE id=$1`, [req.params.id]);
    sendSuccess(res, { message: 'บันทึกการแก้ไขสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.delete('/pest-disease/:id', requireOperator, async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM pest_disease_records WHERE id = $1', [req.params.id]);
    sendSuccess(res, { message: 'ลบสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// YIELD
// ============================================================

router.get('/yield', requireAuth, async (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, start_date, end_date } = req.query;
    let sql = `
      SELECT yr.*, g.name_th as greenhouse_name, c.name as crop_name
      FROM yield_records yr
      JOIN greenhouses g ON yr.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      LEFT JOIN crops c ON yr.crop_id = c.id
      WHERE 1=1
    `;
    let totalSql = `
      SELECT SUM(quantity) as total_quantity, SUM(total_revenue) as total_revenue
      FROM yield_records yr
      JOIN greenhouses g ON yr.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (project_key) { sql += ` AND p.key = $${idx}`; totalSql += ` AND p.key = $${idx}`; idx++; params.push(project_key); }
    if (gh_key) { sql += ` AND g.gh_key = $${idx}`; totalSql += ` AND g.gh_key = $${idx}`; idx++; params.push(gh_key); }
    if (start_date) { sql += ` AND yr.harvest_date >= $${idx++}`; params.push(start_date); }
    if (end_date) { sql += ` AND yr.harvest_date <= $${idx++}`; params.push(end_date); }
    sql += ' ORDER BY yr.harvest_date DESC';

    const [result, totalsResult] = await Promise.all([
      query(sql, params),
      query(totalSql, params.slice(0, (project_key ? 1 : 0) + (gh_key ? 1 : 0))),
    ]);
    sendSuccess(res, { records: result.rows, totals: totalsResult.rows[0] });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/yield', requireOperator, async (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, crop_id, harvest_date, quantity, unit, quality_grade, price_per_unit, notes } = req.body;
    const ghId = await getGreenhouseId(project_key, gh_key);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const total_revenue = (quantity || 0) * (price_per_unit || 0);
    const result = await query(`
      INSERT INTO yield_records (greenhouse_id, crop_id, harvest_date, quantity, unit, quality_grade, price_per_unit, total_revenue, notes, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id
    `, [ghId, crop_id || null, harvest_date, quantity, unit || 'kg', quality_grade || null, price_per_unit || null, total_revenue, notes || null, req.session.userId]);
    sendSuccess(res, { id: result.rows[0].id, message: 'บันทึกผลผลิตสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.put('/yield/:id', requireOperator, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { harvest_date, quantity, unit, quality_grade, price_per_unit, notes } = req.body;
    const total_revenue = (quantity || 0) * (price_per_unit || 0);
    await query(`
      UPDATE yield_records SET harvest_date=$1, quantity=$2, unit=$3, quality_grade=$4, price_per_unit=$5, total_revenue=$6, notes=$7
      WHERE id=$8
    `, [harvest_date, quantity, unit || 'kg', quality_grade || null, price_per_unit || null, total_revenue, notes || null, id]);
    sendSuccess(res, { message: 'อัปเดตสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.delete('/yield/:id', requireOperator, async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM yield_records WHERE id = $1', [req.params.id]);
    sendSuccess(res, { message: 'ลบสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// WATER USAGE
// ============================================================

router.get('/water-usage', requireAuth, async (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, start_date, end_date } = req.query;
    let sql = `
      SELECT wu.*, g.name_th as greenhouse_name
      FROM water_usage wu
      JOIN greenhouses g ON wu.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE 1=1
    `;
    let totalSql = `
      SELECT SUM(usage_liters) as total_liters, SUM(cost) as total_cost
      FROM water_usage wu
      JOIN greenhouses g ON wu.greenhouse_id = g.id
      JOIN projects p ON g.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (project_key) { sql += ` AND p.key = $${idx}`; totalSql += ` AND p.key = $${idx}`; idx++; params.push(project_key); }
    if (gh_key) { sql += ` AND g.gh_key = $${idx}`; totalSql += ` AND g.gh_key = $${idx}`; idx++; params.push(gh_key); }
    if (start_date) { sql += ` AND wu.record_date >= $${idx++}`; params.push(start_date); }
    if (end_date) { sql += ` AND wu.record_date <= $${idx++}`; params.push(end_date); }
    sql += ' ORDER BY wu.record_date DESC';

    const baseParams = params.slice(0, (project_key ? 1 : 0) + (gh_key ? 1 : 0));
    const [result, totalsResult] = await Promise.all([
      query(sql, params),
      query(totalSql, baseParams),
    ]);
    sendSuccess(res, { records: result.rows, totals: totalsResult.rows[0] });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.post('/water-usage', requireOperator, async (req: Request, res: Response) => {
  try {
    const { project_key, gh_key, record_date, usage_liters, source, cost, notes } = req.body;
    const ghId = await getGreenhouseId(project_key, gh_key);
    if (!ghId) { sendError(res, 'ไม่พบโรงเรือน', 404); return; }

    const result = await query(`
      INSERT INTO water_usage (greenhouse_id, record_date, usage_liters, source, cost, notes, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
    `, [ghId, record_date, usage_liters, source || null, cost || null, notes || null, req.session.userId]);
    sendSuccess(res, { id: result.rows[0].id, message: 'บันทึกการใช้น้ำสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.put('/water-usage/:id', requireOperator, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { record_date, usage_liters, source, cost, notes } = req.body;
    await query(`
      UPDATE water_usage SET record_date=$1, usage_liters=$2, source=$3, cost=$4, notes=$5
      WHERE id=$6
    `, [record_date, usage_liters, source || null, cost || null, notes || null, id]);
    sendSuccess(res, { message: 'อัปเดตสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

router.delete('/water-usage/:id', requireOperator, async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM water_usage WHERE id = $1', [req.params.id]);
    sendSuccess(res, { message: 'ลบสำเร็จ' });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

// ============================================================
// WEATHER
// ============================================================

router.get('/weather', requireAuth, async (req: Request, res: Response) => {
  try {
    const { lat, lon } = req.query;
    const apiKeyRes = await query(`SELECT api_key FROM system_api_keys WHERE service_name = 'openweathermap' AND is_active = 1`);
    if (!apiKeyRes.rows[0]) { sendError(res, 'ยังไม่ได้ตั้งค่า Weather API Key', 400); return; }

    const latitude = lat || '18.7883';
    const longitude = lon || '98.9853';
    const location = `${latitude},${longitude}`;

    const cached = await query(`
      SELECT * FROM weather_cache
      WHERE location = $1 AND fetched_at > (NOW() - INTERVAL '30 minutes')::text
    `, [location]);

    if (cached.rows[0]) {
      sendSuccess(res, {
        weather: JSON.parse(cached.rows[0].weather_data),
        forecast: cached.rows[0].forecast_data ? JSON.parse(cached.rows[0].forecast_data) : null,
        cached: true,
      });
      return;
    }

    const apiKey = apiKeyRes.rows[0].api_key;
    const fetch = (await import('node-fetch')).default;
    const [weatherRes, forecastRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric&lang=th`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric&lang=th&cnt=8`),
    ]);
    const [weatherData, forecastData] = await Promise.all([weatherRes.json(), forecastRes.json()]);

    await query(`
      INSERT INTO weather_cache (location, weather_data, forecast_data, fetched_at)
      VALUES ($1,$2,$3,now()::text)
      ON CONFLICT (location) DO UPDATE SET weather_data=$2, forecast_data=$3, fetched_at=now()::text
    `, [location, JSON.stringify(weatherData), JSON.stringify(forecastData)]);

    sendSuccess(res, { weather: weatherData, forecast: forecastData, cached: false });
  } catch (error) {
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;