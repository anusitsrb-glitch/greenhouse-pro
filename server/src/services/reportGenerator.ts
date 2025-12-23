/**
 * Report Generator Service
 * Generates PDF reports for greenhouse data
 */

import PDFDocument from 'pdfkit';
import { db } from '../db/connection.js';
import { tbService } from './thingsboard.js';
import { AIR_TELEMETRY_KEYS, getSoilKeysArray } from '../config/dataKeys.js';

interface ReportOptions {
  projectKey: string;
  ghKey: string;
  period: '1d' | '7d' | '30d';
  includeCharts?: boolean;
}

interface ReportData {
  project: {
    name: string;
    key: string;
  };
  greenhouse: {
    name: string;
    key: string;
  };
  period: {
    start: Date;
    end: Date;
    label: string;
  };
  summary: {
    avgTemp: number | null;
    minTemp: number | null;
    maxTemp: number | null;
    avgHumidity: number | null;
    avgCo2: number | null;
    avgLight: number | null;
    soilMoisture: {
      node: number;
      avg: number | null;
      min: number | null;
      max: number | null;
    }[];
  };
  generatedAt: Date;
}

type TbPoint = { ts: number; value: number | string };
type TbSeries = Record<string, TbPoint[]>;

/**
 * Get period in milliseconds
 */
function getPeriodMs(period: '1d' | '7d' | '30d'): number {
  switch (period) {
    case '1d':
      return 24 * 60 * 60 * 1000;
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return 30 * 24 * 60 * 60 * 1000;
  }
}

/**
 * Get period label in Thai
 */
function getPeriodLabel(period: '1d' | '7d' | '30d'): string {
  switch (period) {
    case '1d':
      return 'รายวัน (24 ชั่วโมง)';
    case '7d':
      return 'รายสัปดาห์ (7 วัน)';
    case '30d':
      return 'รายเดือน (30 วัน)';
  }
}

/**
 * Calculate statistics from telemetry data
 */
function calculateStats(values: TbPoint[]): {
  avg: number | null;
  min: number | null;
  max: number | null;
} {
  if (!values || values.length === 0) {
    return { avg: null, min: null, max: null };
  }

  const nums = values
    .map((v) => (typeof v.value === 'number' ? v.value : parseFloat(String(v.value))))
    .filter((n) => !Number.isNaN(n));

  if (nums.length === 0) {
    return { avg: null, min: null, max: null };
  }

  return {
    avg: nums.reduce((a, b) => a + b, 0) / nums.length,
    min: Math.min(...nums),
    max: Math.max(...nums),
  };
}

/**
 * Fetch report data from ThingsBoard
 */
export async function fetchReportData(options: ReportOptions): Promise<ReportData> {
  const { projectKey, ghKey, period } = options;

  // Get project and greenhouse info
  const projectInfo = db
    .prepare(
      `
    SELECT name_th FROM projects WHERE key = ?
  `
    )
    .get(projectKey) as { name_th: string } | undefined;

  const ghInfo = db
    .prepare(
      `
    SELECT g.name_th FROM greenhouses g
    JOIN projects p ON g.project_id = p.id
    WHERE p.key = ? AND g.gh_key = ?
  `
    )
    .get(projectKey, ghKey) as { name_th: string } | undefined;

  if (!projectInfo || !ghInfo) {
    throw new Error('ไม่พบข้อมูลโปรเจกต์หรือโรงเรือน');
  }

  const endTs = Date.now();
  const startTs = endTs - getPeriodMs(period);

  // Fetch air telemetry
  const airData = ((await tbService.getTelemetryTimeseries(
    projectKey,
    ghKey,
    AIR_TELEMETRY_KEYS,
    startTs,
    endTs,
    undefined,
    'NONE',
    10000
  )) ?? {}) as TbSeries;

  // Fetch soil telemetry (moisture only) for nodes 1..10
  const soilNodes: { node: number; avg: number | null; min: number | null; max: number | null }[] = [];

  for (let i = 1; i <= 10; i++) {
    try {
      const soilKeys = getSoilKeysArray(i).slice(0, 1); // Just moisture
      const soilData = ((await tbService.getTelemetryTimeseries(
        projectKey,
        ghKey,
        soilKeys,
        startTs,
        endTs,
        undefined,
        'NONE',
        10000
      )) ?? {}) as TbSeries;

      const moistureKey = `soil${i}_moisture`;
      const stats = calculateStats(soilData[moistureKey] ?? []);
      soilNodes.push({ node: i, ...stats });
    } catch {
      soilNodes.push({ node: i, avg: null, min: null, max: null });
    }
  }

  // Calculate summary statistics
  const tempStats = calculateStats(airData['air_temp'] ?? []);
  const humidityStats = calculateStats(airData['air_humidity'] ?? []);
  const co2Stats = calculateStats(airData['air_co2'] ?? []);
  const lightStats = calculateStats(airData['air_light'] ?? []);

  return {
    project: {
      name: projectInfo.name_th,
      key: projectKey,
    },
    greenhouse: {
      name: ghInfo.name_th,
      key: ghKey,
    },
    period: {
      start: new Date(startTs),
      end: new Date(endTs),
      label: getPeriodLabel(period),
    },
    summary: {
      avgTemp: tempStats.avg,
      minTemp: tempStats.min,
      maxTemp: tempStats.max,
      avgHumidity: humidityStats.avg,
      avgCo2: co2Stats.avg,
      avgLight: lightStats.avg,
      soilMoisture: soilNodes,
    },
    generatedAt: new Date(),
  };
}

/**
 * Generate PDF report
 */
export async function generatePdfReport(options: ReportOptions): Promise<Buffer> {
  const data = await fetchReportData(options);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `GreenHouse Pro Report - ${data.greenhouse.name}`,
        Author: 'GreenHouse Pro',
        Subject: data.period.label,
      },
    });

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(24).text('GreenHouse Pro', { align: 'center' });
    doc.fontSize(16).text('รายงานข้อมูลโรงเรือน', { align: 'center' });
    doc.moveDown();

    // Report info
    doc.fontSize(12);
    doc.text(`โปรเจกต์: ${data.project.name}`, { continued: false });
    doc.text(`โรงเรือน: ${data.greenhouse.name}`);
    doc.text(`ช่วงเวลา: ${data.period.label}`);
    doc.text(`ตั้งแต่: ${data.period.start.toLocaleString('th-TH')}`);
    doc.text(`ถึง: ${data.period.end.toLocaleString('th-TH')}`);
    doc.text(`สร้างเมื่อ: ${data.generatedAt.toLocaleString('th-TH')}`);
    doc.moveDown(2);

    // Divider
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Air Summary
    doc.fontSize(14).text('สรุปค่าอากาศ', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);

    const formatValue = (val: number | null, decimals = 1, unit = ''): string => {
      if (val === null) return '-';
      return `${val.toFixed(decimals)}${unit}`;
    };

    doc.text(`อุณหภูมิเฉลี่ย: ${formatValue(data.summary.avgTemp, 1, '°C')}`);
    doc.text(`อุณหภูมิต่ำสุด: ${formatValue(data.summary.minTemp, 1, '°C')}`);
    doc.text(`อุณหภูมิสูงสุด: ${formatValue(data.summary.maxTemp, 1, '°C')}`);
    doc.text(`ความชื้นเฉลี่ย: ${formatValue(data.summary.avgHumidity, 1, '%')}`);
    doc.text(`CO2 เฉลี่ย: ${formatValue(data.summary.avgCo2, 0, ' ppm')}`);
    doc.text(`แสงเฉลี่ย: ${formatValue(data.summary.avgLight, 0, ' lux')}`);
    doc.moveDown(2);

    // Soil Summary
    doc.fontSize(14).text('สรุปค่าดิน (ความชื้น)', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);

    // Table header
    const tableTop = doc.y;
    const tableLeft = 50;
    const colWidths: [number, number, number, number] = [80, 100, 100, 100];


    doc.text('จุดที่', tableLeft, tableTop);
    doc.text('เฉลี่ย (%)', tableLeft + colWidths[0], tableTop);
    doc.text('ต่ำสุด (%)', tableLeft + colWidths[0] + colWidths[1], tableTop);
    doc.text('สูงสุด (%)', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], tableTop);
    doc.moveDown(0.5);

    // Divider
    doc.moveTo(tableLeft, doc.y).lineTo(tableLeft + 380, doc.y).stroke();
    doc.moveDown(0.3);

    // Table rows
    for (const soil of data.summary.soilMoisture) {
      const y = doc.y;
      doc.text(`${soil.node}`, tableLeft, y);
      doc.text(formatValue(soil.avg), tableLeft + colWidths[0], y);
      doc.text(formatValue(soil.min), tableLeft + colWidths[0] + colWidths[1], y);
      doc.text(formatValue(soil.max), tableLeft + colWidths[0] + colWidths[1] + colWidths[2], y);
      doc.moveDown(0.5);
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(9).fillColor('#666666');
    doc.text('รายงานนี้สร้างโดยอัตโนมัติจากระบบ GreenHouse Pro', { align: 'center' });

    doc.end();
  });
}

/**
 * Generate report filename
 */
export function getReportFilename(projectKey: string, ghKey: string, period: '1d' | '7d' | '30d'): string {
  const date = new Date().toISOString().slice(0, 10);
  return `greenhouse-report-${projectKey}-${ghKey}-${period}-${date}.pdf`;
}

export const reportService = {
  fetchReportData,
  generatePdfReport,
  getReportFilename,
};
