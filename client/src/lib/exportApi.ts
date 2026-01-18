/**
 * Export API
 * For downloading telemetry data as Excel/CSV
 */

import { api } from './api';

export interface ExportParams {
  projectKey: string;
  ghKey: string;
  keys: string[];
  days: number;
}

/**
 * Export telemetry data to Excel
 */
export async function exportToExcel(params: ExportParams): Promise<void> {
  try {
    const response = await fetch('/api/export/telemetry/excel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Export failed' }));
      throw new Error(error.error || 'ไม่สามารถ Export ได้');
    }

    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `telemetry-${params.projectKey}-${params.ghKey}-${params.days}days.xlsx`;
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Download file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    throw error;
  }
}

/**
 * Export telemetry data to CSV
 */
export async function exportToCsv(params: ExportParams): Promise<void> {
  try {
    const response = await fetch('/api/export/telemetry/csv', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Export failed' }));
      throw new Error(error.error || 'ไม่สามารถ Export ได้');
    }

    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `telemetry-${params.projectKey}-${params.ghKey}-${params.days}days.csv`;
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Download file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    throw error;
  }
}

export const exportApi = {
  toExcel: exportToExcel,
  toCsv: exportToCsv,
};