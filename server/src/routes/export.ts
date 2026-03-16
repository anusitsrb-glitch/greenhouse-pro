/**
 * Data Export Routes (ENHANCED)
 * Export telemetry data to CSV/Excel with flexible date ranges
 */

import { Router, Request, Response } from 'express';
import { query } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';
import { getTelemetryTimeseries, getProject } from '../services/thingsboard.js';
import { logAudit, AuditActions } from '../utils/audit.js';
import ExcelJS from 'exceljs';
import { z } from 'zod';

const router = Router();

type TelemetryValue = { ts: number; value: string | number | boolean };
type TelemetryMap = Record<string, TelemetryValue[]>;

// ============================================================
// Validation Schemas
// ============================================================

const exportExcelSchema = z.object({
  projectKey: z.string().min(1),
  ghKey: z.string().min(1),
  keys: z.array(z.string()).min(1),
  days: z.number().min(1).max(365).optional(),
  startTs: z.number().optional(),
  endTs: z.number().optional(),
}).refine(
  (data) => {
    const hasDays = data.days !== undefined;
    const hasTimestamps = data.startTs !== undefined && data.endTs !== undefined;
    return hasDays || hasTimestamps;
  },
  { message: 'Must provide either days or both startTs and endTs' }
).refine(
  (data) => {
    if (data.startTs && data.endTs) {
      const diffDays = (data.endTs - data.startTs) / (1000 * 60 * 60 * 24);
      return diffDays > 0 && diffDays <= 365;
    }
    return true;
  },
  { message: 'Time range must be between 0 and 365 days' }
);

const exportCsvSchema = exportExcelSchema;

// ============================================================
// Helper Functions
// ============================================================

function normalizeValue(v: string | number | boolean): string | number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s);
  if (Number.isFinite(n)) return n;
  return s;
}

function telemetryToRows(data: TelemetryMap, keys: string[]) {
  const timestamps = new Set<number>();
  for (const key of keys) {
    if (data[key]) {
      data[key].forEach(item => timestamps.add(item.ts));
    }
  }

  const sortedTimestamps = Array.from(timestamps).sort((a, b) => a - b);

  const rows: any[] = [];
  for (const ts of sortedTimestamps) {
    const row: any = {
      timestamp: new Date(ts).toISOString(),
      timestamp_local: new Date(ts).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
    };
    for (const key of keys) {
      const item = data[key]?.find(d => d.ts === ts);
      row[key] = item ? normalizeValue(item.value) : null;
    }
    rows.push(row);
  }

  return rows;
}

// ============================================================
// Routes
// ============================================================

/**
 * POST /api/export/telemetry/excel
 */
router.post('/telemetry/excel', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = exportExcelSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 'กรุณาระบุข้อมูลให้ครบถ้วน: ' + parsed.error.message, 400);
      return;
    }

    const { projectKey, ghKey, keys, days, startTs, endTs } = parsed.data;

    const project = await getProject(projectKey);
    if (!project) {
      sendError(res, 'ไม่พบโปรเจกต์', 404);
      return;
    }

    const ghResult = await query(`
      SELECT g.*, p.name_th as project_name FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = $1 AND g.gh_key = $2
    `, [projectKey, ghKey]);
    const greenhouse = ghResult.rows[0] as any;

    if (!greenhouse || !greenhouse.tb_device_id) {
      sendError(res, 'ไม่พบโรงเรือนหรือยังไม่ได้เชื่อมต่อ Device', 404);
      return;
    }

    // Calculate time range
    let startTime: number;
    let endTime: number;
    let rangeDescription: string;

    if (startTs !== undefined && endTs !== undefined) {
      startTime = startTs;
      endTime = endTs;
      const diffDays = Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24));
      rangeDescription = `${diffDays} วัน (กำหนดเอง)`;
    } else if (days !== undefined) {
      endTime = Date.now();
      startTime = endTime - (days * 24 * 60 * 60 * 1000);
      rangeDescription = `${days} วัน`;
    } else {
      sendError(res, 'กรุณาระบุช่วงเวลา (days หรือ startTs/endTs)', 400);
      return;
    }

    const data = await getTelemetryTimeseries(projectKey, ghKey, keys, startTime, endTime);
    if (!data) {
      sendError(res, 'ไม่สามารถดึงข้อมูลได้', 500);
      return;
    }

    const rows = telemetryToRows(data as unknown as TelemetryMap, keys);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GreenHouse Pro';
    workbook.created = new Date();

    const infoSheet = workbook.addWorksheet('Info');
    infoSheet.columns = [
      { header: 'Property', key: 'property', width: 20 },
      { header: 'Value', key: 'value', width: 40 },
    ];
    infoSheet.addRows([
      { property: 'โปรเจกต์', value: greenhouse.project_name },
      { property: 'โรงเรือน', value: greenhouse.name_th },
      { property: 'ช่วงเวลา', value: rangeDescription },
      { property: 'วันที่เริ่มต้น', value: new Date(startTime).toLocaleString('th-TH') },
      { property: 'วันที่สิ้นสุด', value: new Date(endTime).toLocaleString('th-TH') },
      { property: 'เซนเซอร์', value: keys.join(', ') },
      { property: 'จำนวนข้อมูล', value: rows.length },
      { property: 'สร้างเมื่อ', value: new Date().toLocaleString('th-TH') },
    ]);

    const dataSheet = workbook.addWorksheet('Data');
    dataSheet.columns = [
      { header: 'Timestamp', key: 'timestamp', width: 25 },
      { header: 'Timestamp (Local)', key: 'timestamp_local', width: 25 },
      ...keys.map(k => ({ header: k, key: k, width: 15 })),
    ];
    dataSheet.getRow(1).font = { bold: true };
    dataSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF10B981' },
    };
    for (const row of rows) {
      dataSheet.addRow(row);
    }

    // Log export
    await logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.DATA_EXPORTED,
      projectKey,
      ghKey,
      detail: { format: 'excel', keys, days, startTs, endTs, rowCount: rows.length },
    });

    // Record in export history
    await query(`
      INSERT INTO export_history (user_id, export_type, data_type, row_count, filters)
      VALUES ($1, 'excel', 'telemetry', $2, $3)
    `, [
      req.session.userId,
      rows.length,
      JSON.stringify({ projectKey, ghKey, keys, days, startTime, endTime, startTs, endTs }),
    ]);

    const dateStr = startTs && endTs
      ? `${new Date(startTs).toISOString().split('T')[0]}_to_${new Date(endTs).toISOString().split('T')[0]}`
      : `${days}days`;
    const filename = `telemetry-${projectKey}-${ghKey}-${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting Excel:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * POST /api/export/telemetry/csv
 */
router.post('/telemetry/csv', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = exportCsvSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 'กรุณาระบุข้อมูลให้ครบถ้วน: ' + parsed.error.message, 400);
      return;
    }

    const { projectKey, ghKey, keys, days, startTs, endTs } = parsed.data;

    const project = await getProject(projectKey);
    if (!project) {
      sendError(res, 'ไม่พบโปรเจกต์', 404);
      return;
    }

    const ghResult = await query(`
      SELECT * FROM greenhouses g
      JOIN projects p ON g.project_id = p.id
      WHERE p.key = $1 AND g.gh_key = $2
    `, [projectKey, ghKey]);
    const greenhouse = ghResult.rows[0] as any;

    if (!greenhouse || !greenhouse.tb_device_id) {
      sendError(res, 'ไม่พบโรงเรือนหรือยังไม่ได้เชื่อมต่อ Device', 404);
      return;
    }

    // Calculate time range
    let startTime: number;
    let endTime: number;

    if (startTs !== undefined && endTs !== undefined) {
      startTime = startTs;
      endTime = endTs;
    } else if (days !== undefined) {
      endTime = Date.now();
      startTime = endTime - (days * 24 * 60 * 60 * 1000);
    } else {
      sendError(res, 'กรุณาระบุช่วงเวลา (days หรือ startTs/endTs)', 400);
      return;
    }

    const data = await getTelemetryTimeseries(projectKey, ghKey, keys, startTime, endTime);
    if (!data) {
      sendError(res, 'ไม่สามารถดึงข้อมูลได้', 500);
      return;
    }

    const rows = telemetryToRows(data as unknown as TelemetryMap, keys);

    // Generate CSV
    const headers = ['Timestamp', 'Timestamp (Local)', ...keys];
    const csvRows = [headers.join(',')];
    for (const row of rows) {
      const values = [
        row.timestamp,
        `"${row.timestamp_local}"`,
        ...keys.map(k => (row[k] ?? '')),
      ];
      csvRows.push(values.join(','));
    }
    const csv = csvRows.join('\n');

    // Log export
    await logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.DATA_EXPORTED,
      projectKey,
      ghKey,
      detail: { format: 'csv', keys, days, startTs, endTs, rowCount: rows.length },
    });

    // Record in export history
    await query(`
      INSERT INTO export_history (user_id, export_type, data_type, row_count, filters)
      VALUES ($1, 'csv', 'telemetry', $2, $3)
    `, [
      req.session.userId,
      rows.length,
      JSON.stringify({ projectKey, ghKey, keys, days, startTime, endTime, startTs, endTs }),
    ]);

    const dateStr = startTs && endTs
      ? `${new Date(startTs).toISOString().split('T')[0]}_to_${new Date(endTs).toISOString().split('T')[0]}`
      : `${days}days`;
    const filename = `telemetry-${projectKey}-${ghKey}-${dateStr}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

/**
 * GET /api/export/history
 */
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT eh.*, u.username
      FROM export_history eh
      LEFT JOIN users u ON eh.user_id = u.id
      WHERE eh.user_id = $1
      ORDER BY eh.created_at DESC
      LIMIT 50
    `, [req.session.userId]);

    sendSuccess(res, { history: result.rows });
  } catch (error) {
    console.error('Error fetching export history:', error);
    sendError(res, ThaiErrors.SERVER_ERROR, 500);
  }
});

export default router;