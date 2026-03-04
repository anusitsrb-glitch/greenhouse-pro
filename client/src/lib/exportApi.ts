/**
 * Export API
 * ✅ Patch C2+C3: แก้ relative URL + รองรับ Mobile download ด้วย Filesystem/Share
 */

import { api } from './api';
import { getApiUrl, ENV } from '@/config/env';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface ExportParams {
  projectKey: string;
  ghKey: string;
  keys: string[];
  days?: number;
  startTs?: number;
  endTs?: number;
}

// ✅ Helper: บันทึกไฟล์บน Mobile แล้วเปิด Share sheet
async function saveMobileFile(base64Data: string, filename: string): Promise<void> {
  await Filesystem.writeFile({
    path: filename,
    data: base64Data,
    directory: Directory.Cache,
  });

  const fileUri = await Filesystem.getUri({
    path: filename,
    directory: Directory.Cache,
  });

  await Share.share({
    title: filename,
    url: fileUri.uri,
    dialogTitle: 'บันทึกหรือแชร์ไฟล์',
  });
}

// ✅ Helper: Download บน Web ด้วย <a download>
function saveWebFile(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// ✅ Helper: สร้าง filename จาก params
function buildFilename(params: ExportParams, ext: 'xlsx' | 'csv'): string {
  const dateStr =
    params.startTs && params.endTs
      ? `${new Date(params.startTs).toISOString().split('T')[0]}_to_${new Date(params.endTs).toISOString().split('T')[0]}`
      : `${params.days}days`;
  return `telemetry-${params.projectKey}-${params.ghKey}-${dateStr}.${ext}`;
}

/**
 * Export telemetry data to Excel
 */
export async function exportToExcel(params: ExportParams): Promise<void> {
  const filename = buildFilename(params, 'xlsx');
  const url = getApiUrl('/api/export/telemetry/excel'); // ✅ ใช้ getApiUrl แทน relative

  if (ENV.IS_CAPACITOR) {
    // ✅ Mobile: CapacitorHttp → Filesystem → Share
    const { CapacitorHttp } = await import('@capacitor/core');
    const csrf = await api.getCsrfToken();

    const response = await CapacitorHttp.request({
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      },
      data: params,
      responseType: 'blob',
      webFetchExtra: { credentials: 'include' },
    });

    if (response.status !== 200) {
      throw new Error('ไม่สามารถ Export ได้');
    }

    await saveMobileFile(response.data, filename);
  } else {
    // ✅ Web: fetch ปกติ
    const csrf = await api.getCsrfToken();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Export failed' }));
      throw new Error(error.error || 'ไม่สามารถ Export ได้');
    }

    // อ่าน filename จาก Content-Disposition ถ้ามี
    const contentDisposition = response.headers.get('Content-Disposition');
    let finalFilename = filename;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match) finalFilename = match[1];
    }

    const blob = await response.blob();
    saveWebFile(blob, finalFilename);
  }
}

/**
 * Export telemetry data to CSV
 */
export async function exportToCsv(params: ExportParams): Promise<void> {
  const filename = buildFilename(params, 'csv');
  const url = getApiUrl('/api/export/telemetry/csv'); // ✅ ใช้ getApiUrl แทน relative

  if (ENV.IS_CAPACITOR) {
    // ✅ Mobile: CapacitorHttp → Filesystem → Share
    const { CapacitorHttp } = await import('@capacitor/core');
    const csrf = await api.getCsrfToken();

    const response = await CapacitorHttp.request({
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      },
      data: params,
      responseType: 'blob',
      webFetchExtra: { credentials: 'include' },
    });

    if (response.status !== 200) {
      throw new Error('ไม่สามารถ Export ได้');
    }

    await saveMobileFile(response.data, filename);
  } else {
    // ✅ Web: fetch ปกติ
    const csrf = await api.getCsrfToken();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Export failed' }));
      throw new Error(error.error || 'ไม่สามารถ Export ได้');
    }

    // อ่าน filename จาก Content-Disposition ถ้ามี
    const contentDisposition = response.headers.get('Content-Disposition');
    let finalFilename = filename;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match) finalFilename = match[1];
    }

    const blob = await response.blob();
    saveWebFile(blob, finalFilename);
  }
}

export const exportApi = {
  toExcel: exportToExcel,
  toCSV: exportToCsv,
  toCsv: exportToCsv,
};