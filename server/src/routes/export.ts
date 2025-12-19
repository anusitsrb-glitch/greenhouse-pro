/**
 * Data Export Routes
 * Export telemetry data to CSV/Excel
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';
import { getTelemetryTimeseries, getProject } from '../services/thingsboard.js';
import { logAudit, AuditActions } from '../utils/audit.js';
import ExcelJS from 'exceljs';

const router = Router();

/**
 * Helper: Convert telemetry data to rows
 */
function telemetryToRows(data: Record<string, Array<{ ts: number; value: string }>>, keys: string[]) {
  // Get all unique timestamps
  const timestamps = new Set<number>();
  for (const key of keys) {
    if (data[key]) {
      data[key].forEach(item => timestamps.add(item.ts));
    }
  }

  const sortedTimestamps = Array.from(timestamps).sort((a, b) => a - b);

  // Create rows
  const rows: any[] = [];
  for (const ts of sortedTimestamps) {
    const row: any = {
      timestamp: new Date(ts).toISOString(),
      timestamp_local: new Date(ts).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
    };

    for (const key of keys) {
      const item = data[key]?.find(d => d.ts === ts);
      row[key] = item ? parseFloat(item.value) : null;
    }

    rows.push(row);
  }

  return rows;
}

/**
 * POST /api/export/telemetry/csv
 * Export telemetry data to CSV
 */
router.post('/telemetry/csv', requireAuth, async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey, keys, startTime, endTime } = req.body;

    if (!projectKey || !ghKey || !keys || !Array.isArray(keys) || keys.length === 0) {
      sendError(res, 'กรุณาระบุข้อมูลให้ครบ', 400);
      return;
    }

    // Get project and greenhouse
    const project = getProject(projectKey);
    if (!project) {
      sendError(res, 'ไม่พบโปรเจกต์', 404);
      return;
    }

    const greenhouse = db.prepare(`
      SELECT * FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ?
    `).get(projectKey, ghKey) as any;

    if (!greenhouse || !greenhouse.tb_device_id) {
      sendError(res, 'ไม่พบโรงเรือนหรือยังไม่ได้เชื่อมต่อ Device', 404);
      return;
    }

    // Get telemetry data
    const start = startTime || Date.now() - 24 * 60 * 60 * 1000; // Default: 24 hours
    const end = endTime || Date.now();

    const data = await getTelemetryTimeseries(project, greenhouse.tb_device_id, keys.join(','), start, end);

    if (!data) {
      sendError(res, 'ไม่สามารถดึงข้อมูลได้', 500);
      return;
    }

    // Convert to rows
    const rows = telemetryToRows(data, keys);

    // Generate CSV
    const headers = ['Timestamp', 'Timestamp (Local)', ...keys];
    const csvRows = [headers.join(',')];

    for (const row of rows) {
      const values = [
        row.timestamp,
        `"${row.timestamp_local}"`,
        ...keys.map(k => row[k] ?? ''),
      ];
      csvRows.push(values.join(','));
    }

    const csv = csvRows.join('\n');

    // Log export
    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.DATA_EXPORTED,
      projectKey,
      ghKey,
      detail: { format: 'csv', keys, rowCount: rows.length },
    });

    // Record in export history
    db.prepare(`
      INSERT INTO export_history (user_id, export_type, data_type, row_count, filters)
      VALUES (?, 'csv', 'telemetry', ?, ?)
    `).run(req.session.userId, rows.length, JSON.stringify({ projectKey, ghKey, keys, startTime: start, endTime: end }));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="telemetry-${projectKey}-${ghKey}-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8 support
  } catch (error) {
    console.error('Error exporting CSV:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/export/telemetry/excel
 * Export telemetry data to Excel
 */
router.post('/telemetry/excel', requireAuth, async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey, keys, startTime, endTime } = req.body;

    if (!projectKey || !ghKey || !keys || !Array.isArray(keys) || keys.length === 0) {
      sendError(res, 'กรุณาระบุข้อมูลให้ครบ', 400);
      return;
    }

    // Get project and greenhouse
    const project = getProject(projectKey);
    if (!project) {
      sendError(res, 'ไม่พบโปรเจกต์', 404);
      return;
    }

    const greenhouse = db.prepare(`
      SELECT g.*, p.name_th as project_name FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = ? AND g.gh_key = ?
    `).get(projectKey, ghKey) as any;

    if (!greenhouse || !greenhouse.tb_device_id) {
      sendError(res, 'ไม่พบโรงเรือนหรือยังไม่ได้เชื่อมต่อ Device', 404);
      return;
    }

    // Get telemetry data
    const start = startTime || Date.now() - 24 * 60 * 60 * 1000;
    const end = endTime || Date.now();

    const data = await getTelemetryTimeseries(project, greenhouse.tb_device_id, keys.join(','), start, end);

    if (!data) {
      sendError(res, 'ไม่สามารถดึงข้อมูลได้', 500);
      return;
    }

    // Convert to rows
    const rows = telemetryToRows(data, keys);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GreenHouse Pro';
    workbook.created = new Date();

    // Info sheet
    const infoSheet = workbook.addWorksheet('Info');
    infoSheet.columns = [
      { header: 'Property', key: 'property', width: 20 },
      { header: 'Value', key: 'value', width: 40 },
    ];
    infoSheet.addRows([
      { property: 'โปรเจกต์', value: greenhouse.project_name },
      { property: 'โรงเรือน', value: greenhouse.name_th },
      { property: 'ช่วงเวลา', value: `${new Date(start).toLocaleString('th-TH')} - ${new Date(end).toLocaleString('th-TH')}` },
      { property: 'จำนวนข้อมูล', value: rows.length },
      { property: 'สร้างเมื่อ', value: new Date().toLocaleString('th-TH') },
    ]);

    // Data sheet
    const dataSheet = workbook.addWorksheet('Data');
    dataSheet.columns = [
      { header: 'Timestamp', key: 'timestamp', width: 25 },
      { header: 'Timestamp (Local)', key: 'timestamp_local', width: 25 },
      ...keys.map(k => ({ header: k, key: k, width: 15 })),
    ];

    // Style header row
    dataSheet.getRow(1).font = { bold: true };
    dataSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF10B981' },
    };

    // Add data rows
    for (const row of rows) {
      dataSheet.addRow(row);
    }

    // Log export
    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.DATA_EXPORTED,
      projectKey,
      ghKey,
      detail: { format: 'excel', keys, rowCount: rows.length },
    });

    // Record in export history
    db.prepare(`
      INSERT INTO export_history (user_id, export_type, data_type, row_count, filters)
      VALUES (?, 'excel', 'telemetry', ?, ?)
    `).run(req.session.userId, rows.length, JSON.stringify({ projectKey, ghKey, keys, startTime: start, endTime: end }));

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="telemetry-${projectKey}-${ghKey}-${new Date().toISOString().split('T')[0]}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting Excel:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/export/history
 * Get export history
 */
router.get('/history', requireAuth, (req: Request, res: Response) => {
  try {
    const history = db.prepare(`
      SELECT eh.*, u.username
      FROM export_history eh
      LEFT JOIN users u ON eh.user_id = u.id
      WHERE eh.user_id = ?
      ORDER BY eh.created_at DESC
      LIMIT 50
    `).all(req.session.userId);

    sendSuccess(res, { history });
  } catch (error) {
    console.error('Error fetching export history:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;
