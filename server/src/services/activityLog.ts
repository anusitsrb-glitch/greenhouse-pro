/**
 * Activity Log Service
 * Logs device control actions from WebApp and External API
 */

import { query } from '../db/connection.js';

export interface ControlLogData {
  greenhouseId: number;
  controlKey: string;
  controlName?: string;
  action: string;
  value?: string;
  source: 'manual' | 'automation' | 'schedule' | 'scene' | 'external_api';
  sourceId?: number;
  userId?: number;
  apiKeyPrefix?: string;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  errorMessage?: string;
}

/**
 * Log device control action (fire-and-forget)
 */
export function logDeviceControl(data: ControlLogData): void {
  query(`
    INSERT INTO control_history
    (greenhouse_id, control_key, control_name, action, value, source, source_id, user_id, api_key_prefix, ip_address, user_agent, success, error_message)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
  `, [
    data.greenhouseId,
    data.controlKey,
    data.controlName || null,
    data.action,
    data.value || null,
    data.source,
    data.sourceId || null,
    data.userId || null,
    data.apiKeyPrefix || null,
    data.ipAddress || null,
    data.userAgent || null,
    data.success !== false,
    data.errorMessage || null,
  ]).then(() => {
    console.log(`📝 [Activity Log] ${data.source}: ${data.controlKey} -> ${data.action}`);
  }).catch(error => {
    console.error('❌ Failed to log device control:', error);
  });
}

/**
 * Get control logs for a greenhouse
 */
export async function getControlLogs(
  greenhouseId: number,
  options?: {
    limit?: number;
    offset?: number;
    source?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<any[]> {
  try {
    let sql = 'SELECT * FROM control_history WHERE greenhouse_id = $1';
    const params: any[] = [greenhouseId];
    let idx = 2;

    if (options?.source) {
      sql += ` AND source = $${idx++}`;
      params.push(options.source);
    }
    if (options?.startDate) {
      sql += ` AND created_at >= $${idx++}`;
      params.push(options.startDate);
    }
    if (options?.endDate) {
      sql += ` AND created_at <= $${idx++}`;
      params.push(options.endDate);
    }

    sql += ' ORDER BY created_at DESC';

    if (options?.limit) {
      sql += ` LIMIT $${idx++}`;
      params.push(options.limit);
      if (options?.offset) {
        sql += ` OFFSET $${idx++}`;
        params.push(options.offset);
      }
    }

    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    console.error('❌ Failed to get control logs:', error);
    return [];
  }
}

/**
 * Get control log statistics
 */
export async function getControlLogStats(greenhouseId: number, days: number = 7): Promise<any[]> {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const result = await query(`
      SELECT
        source,
        COUNT(*) as count,
        SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failure_count
      FROM control_history
      WHERE greenhouse_id = $1 AND created_at >= $2
      GROUP BY source
    `, [greenhouseId, startDate]);

    return result.rows;
  } catch (error) {
    console.error('❌ Failed to get control log stats:', error);
    return [];
  }
}