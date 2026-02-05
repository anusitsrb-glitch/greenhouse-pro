/**
 * Activity Log Service
 * Logs device control actions from WebApp and External API
 */

import { db } from '../db/connection.js';

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
 * Log device control action
 */
export function logDeviceControl(data: ControlLogData): void {
  try {
    const stmt = db.prepare(`
      INSERT INTO control_history 
      (greenhouse_id, control_key, control_name, action, value, source, source_id, user_id, api_key_prefix, ip_address, user_agent, success, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
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
      data.success !== false ? 1 : 0,
      data.errorMessage || null
    );
    
    console.log(`📝 [Activity Log] ${data.source}: ${data.controlKey} -> ${data.action}`);
  } catch (error) {
    console.error('❌ Failed to log device control:', error);
    // Don't throw - logging failure shouldn't break the main operation
  }
}

/**
 * Get control logs for a greenhouse
 */
export function getControlLogs(
  greenhouseId: number,
  options?: {
    limit?: number;
    offset?: number;
    source?: string;
    startDate?: string;
    endDate?: string;
  }
): any[] {
  try {
    let query = 'SELECT * FROM control_history WHERE greenhouse_id = ?';
    const params: any[] = [greenhouseId];
    
    if (options?.source) {
      query += ' AND source = ?';
      params.push(options.source);
    }
    
    if (options?.startDate) {
      query += ' AND created_at >= ?';
      params.push(options.startDate);
    }
    
    if (options?.endDate) {
      query += ' AND created_at <= ?';
      params.push(options.endDate);
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
      
      if (options?.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }
    }
    
    const stmt = db.prepare(query);
    return stmt.all(...params);
  } catch (error) {
    console.error('❌ Failed to get control logs:', error);
    return [];
  }
}

/**
 * Get control log statistics
 */
export function getControlLogStats(greenhouseId: number, days: number = 7): any {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    const stmt = db.prepare(`
      SELECT 
        source,
        COUNT(*) as count,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failure_count
      FROM control_history
      WHERE greenhouse_id = ? AND created_at >= ?
      GROUP BY source
    `);
    
    return stmt.all(greenhouseId, startDate);
  } catch (error) {
    console.error('❌ Failed to get control log stats:', error);
    return [];
  }
}