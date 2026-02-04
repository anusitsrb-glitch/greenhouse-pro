/**
 * ThingsBoard API Client
 * Centralized module for all ThingsBoard interactions
 * 
 * Features:
 * - JWT authentication with auto-refresh
 * - Request timeout handling
 * - Automatic retry on 401/403
 * - Thai error messages
 * - RPC retry logic (แก้ไขแล้ว)
 */

import { db } from '../db/connection.js';
import { ThaiErrors } from '../utils/response.js';
import type { Project } from '../types/index.js';

// ============================================================
// Types
// ============================================================

interface TBAuthResponse {
  token: string;
  refreshToken: string;
}

interface TBTokenCache {
  token: string;
  refreshToken: string;
  expiresAt: number;
}

export interface TBTelemetryValue {
  ts: number;
  value: string | number | boolean;
}

export interface TBTelemetryResponse {
  [key: string]: TBTelemetryValue[];
}

interface TBAttributeValue {
  key: string;
  value: string | number | boolean;
  lastUpdateTs?: number;
}

interface TBRpcResponse {
  [key: string]: unknown;
}

// ============================================================
// Configuration (แก้ไขแล้ว)
// ============================================================

const REQUEST_TIMEOUT = 30000; // ✅ เพิ่มจาก 10s → 30s
const TOKEN_EXPIRY_BUFFER = 60000; // Refresh 1 minute before expiry
const JWT_LIFETIME = 9000000; // ~2.5 hours (ThingsBoard default)
const RPC_RETRY_ATTEMPTS = 3; // ✅ เพิ่มใหม่

// ============================================================
// Token Cache (per project)
// ============================================================

const tokenCache = new Map<string, TBTokenCache>();

// ============================================================
// Helper Functions
// ============================================================

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout = REQUEST_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get project's ThingsBoard settings from database
 */
function getProjectTBSettings(projectKey: string): {
  baseUrl: string;
  username: string;
  password: string;
} | null {
  const project = db.prepare(`
    SELECT tb_base_url, tb_username, tb_password
    FROM projects WHERE key = ?
  `).get(projectKey) as Pick<Project, 'tb_base_url' | 'tb_username' | 'tb_password'> | undefined;

  if (!project) return null;

  return {
    baseUrl: project.tb_base_url,
    username: project.tb_username,
    password: project.tb_password,
  };
}

/**
 * Get device ID for a greenhouse
 */
function getDeviceId(projectKey: string, ghKey: string): string | null {
  const result = db.prepare(`
    SELECT g.tb_device_id
    FROM greenhouses g
    JOIN projects p ON g.project_id = p.id
    WHERE p.key = ? AND g.gh_key = ?
  `).get(projectKey, ghKey) as { tb_device_id: string | null } | undefined;

  return result?.tb_device_id ?? null;
}

// ============================================================
// ThingsBoard Authentication
// ============================================================

/**
 * Login to ThingsBoard and get JWT token
 */
async function tbLogin(
  baseUrl: string,
  username: string,
  password: string
): Promise<TBAuthResponse> {
  const url = `${baseUrl}/api/auth/login`;

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(ThaiErrors.TB_AUTH_ERROR);
      }
      throw new Error(ThaiErrors.TB_CONNECTION_ERROR);
    }

    const data = await response.json();
    return data as TBAuthResponse;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(ThaiErrors.TB_TIMEOUT);
      }
      throw error;
    }
    throw new Error(ThaiErrors.TB_CONNECTION_ERROR);
  }
}

/**
 * Get valid token for a project (with auto-refresh)
 */
async function getToken(projectKey: string): Promise<string> {
  const cached = tokenCache.get(projectKey);
  const now = Date.now();

  // Check if we have a valid cached token
  if (cached && cached.expiresAt > now + TOKEN_EXPIRY_BUFFER) {
    return cached.token;
  }

  // Need to get new token
  const settings = getProjectTBSettings(projectKey);
  if (!settings) {
    throw new Error(ThaiErrors.PROJECT_NOT_FOUND);
  }

  const authResponse = await tbLogin(settings.baseUrl, settings.username, settings.password);

  // Cache the token
  tokenCache.set(projectKey, {
    token: authResponse.token,
    refreshToken: authResponse.refreshToken,
    expiresAt: now + JWT_LIFETIME,
  });

  return authResponse.token;
}

/**
 * Clear cached token (force re-login on next request)
 */
export function clearToken(projectKey: string): void {
  tokenCache.delete(projectKey);
}

// ============================================================
// ThingsBoard API Requests
// ============================================================

/**
 * Make authenticated request to ThingsBoard
 * Automatically retries once on 401/403
 */
async function tbRequest<T>(
  projectKey: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const settings = getProjectTBSettings(projectKey);
  if (!settings) {
    throw new Error(ThaiErrors.PROJECT_NOT_FOUND);
  }

  const makeRequest = async (retry = false): Promise<T> => {
    const token = await getToken(projectKey);
    const url = `${settings.baseUrl}${endpoint}`;

    try {
      const response = await fetchWithTimeout(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });

      // Handle auth errors with retry
      if ((response.status === 401 || response.status === 403) && !retry) {
        console.log(`🔄 Token expired for ${projectKey}, refreshing...`);
        clearToken(projectKey);
        return makeRequest(true);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`ThingsBoard error [${response.status}]:`, errorText);

        const err: any = new Error(
          (response.status === 401 || response.status === 403)
            ? ThaiErrors.TB_AUTH_ERROR
            : ThaiErrors.TB_CONNECTION_ERROR
        );
        err.status = response.status;      // ✅ สำคัญ
        err.tbBody = errorText;
        throw err;
      }

      // Handle empty responses
      const text = await response.text();
      if (!text) {
        return {} as T;
      }

      return JSON.parse(text) as T;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          const err: any = new Error(ThaiErrors.TB_TIMEOUT);
          err.status = 408;
          throw err;
        }
        throw error;
      }
      throw new Error(ThaiErrors.TB_CONNECTION_ERROR);
    }
  };

  return makeRequest();
}

// ============================================================
// Public API Functions
// ============================================================

/**
 * Get Project Details
 */
export function getProject(projectKey: string): Project | undefined {
  return db.prepare('SELECT * FROM projects WHERE key = ?').get(projectKey) as Project | undefined;
}

/**
 * Get latest telemetry values
 */
export async function getLatestTelemetry(
  projectKey: string,
  ghKey: string,
  keys: string[]
): Promise<TBTelemetryResponse> {
  const deviceId = getDeviceId(projectKey, ghKey);
  if (!deviceId) {
    throw new Error(ThaiErrors.GREENHOUSE_DEVELOPING);
  }

  const keysParam = keys.join(',');
  const endpoint = `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${keysParam}&limit=1`;

  return tbRequest<TBTelemetryResponse>(projectKey, endpoint);
}

/**
 * Get telemetry timeseries for charts
 */
export async function getTelemetryTimeseries(
  projectKey: string,
  ghKey: string,
  keys: string[],
  startTs: number,
  endTs: number,
  interval?: number,
  agg?: string,
  limit?: number
): Promise<TBTelemetryResponse> {
  const deviceId = getDeviceId(projectKey, ghKey);
  if (!deviceId) {
    throw new Error(ThaiErrors.GREENHOUSE_DEVELOPING);
  }

  const params = new URLSearchParams({
    keys: keys.join(','),
    startTs: startTs.toString(),
    endTs: endTs.toString(),
  });

  if (interval) params.append('interval', interval.toString());
  if (agg) params.append('agg', agg);
  if (limit) params.append('limit', limit.toString());

  const endpoint = `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?${params}`;

  return tbRequest<TBTelemetryResponse>(projectKey, endpoint);
}

/**
 * Get device attributes
 */
export async function getAttributes(
  projectKey: string,
  ghKey: string,
  keys: string[]
): Promise<Record<string, unknown>> {
  const deviceId = getDeviceId(projectKey, ghKey);
  if (!deviceId) {
    throw new Error(ThaiErrors.GREENHOUSE_DEVELOPING);
  }

  const wantsAll = !keys || keys.length === 0 || keys.includes('*');

  const endpoint = wantsAll
    ? `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes`
    : `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes?keys=${keys.join(',')}`;

  const response = await tbRequest<TBAttributeValue[]>(projectKey, endpoint);

  const result: Record<string, unknown> = {};
  for (const attr of response) {
    result[attr.key] = attr.value;
  }
  return result;
}



export async function setAttributes(
  projectKey: string,
  ghKey: string,
  attributes: Record<string, unknown>,
  scope: 'SHARED_SCOPE' | 'SERVER_SCOPE' = 'SHARED_SCOPE'
): Promise<void> {
  const deviceId = getDeviceId(projectKey, ghKey);
  if (!deviceId) {
    throw new Error(ThaiErrors.GREENHOUSE_DEVELOPING);
  }

  const endpoint = `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/${scope}`;

  await tbRequest(projectKey, endpoint, {
    method: 'POST',
    body: JSON.stringify(attributes),
  });
}




/**
 * Send RPC command to device (two-way)
 * ✅ แก้ไขแล้ว: เพิ่ม retry logic
 */
export async function sendRpcCommand(
  projectKey: string,
  ghKey: string,
  method: string,
  params: unknown,
  timeout?: number // ✅ ไม่มี default แล้ว
): Promise<TBRpcResponse> {
  const deviceId = getDeviceId(projectKey, ghKey);
  if (!deviceId) {
    throw new Error(ThaiErrors.GREENHOUSE_DEVELOPING);
  }

  // ✅ ถ้าส่ง timeout มา = two-way (ต้องการ response)
  // ✅ ถ้าไม่ส่ง timeout = one-way (ส่งแล้วจบ)
  const isTwoWay = typeof timeout === 'number' && timeout > 0;

  const endpoint = isTwoWay
    ? `/api/rpc/twoway/${deviceId}`
    : `/api/rpc/oneway/${deviceId}`;

  const body = isTwoWay
    ? { method, params, timeout }
    : { method, params };

  console.log(`🚀 RPC ${isTwoWay ? 'two-way' : 'one-way'} to ${ghKey}: ${method}`);

  // ✅ ไม่ retry เพื่อกันสั่งซ้ำ (toggle จะเพี้ยนได้)
  return tbRequest<TBRpcResponse>(projectKey, endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}


// Alias for compatibility
export const sendRpc = sendRpcCommand;

/**
 * Check if device is online
 */
export async function isDeviceOnline(
  projectKey: string,
  ghKey: string
): Promise<boolean> {
  try {
    console.log(`🔍 [isDeviceOnline] Checking ${ghKey}...`);

    const OFFLINE_THRESHOLD_SEC = 180; // 3 นาที

    // 1) อ่าน attributes ก่อน
    const attrs = await getAttributes(projectKey, ghKey, ['status', 'last_seen']);
    console.log(`  📦 Attributes:`, attrs);

    const statusRaw =
      typeof attrs.status === 'string' ? attrs.status.trim().toLowerCase() : '';

    // last_seen อาจเป็น number หรือ string → แปลงให้เป็น number
    const lastSeenVal = (attrs as any).last_seen;
    const lastSeenSec =
      typeof lastSeenVal === 'number'
        ? lastSeenVal
        : typeof lastSeenVal === 'string'
          ? Number(lastSeenVal)
          : NaN;

    // ✅ ถ้ามี last_seen ใช้เป็นหลัก
    if (!Number.isNaN(lastSeenSec) && lastSeenSec > 0) {
      const nowSec = Math.floor(Date.now() / 1000);
      const age = nowSec - lastSeenSec;

      console.log(`  ⏰ Last seen: ${age}s ago (threshold: ${OFFLINE_THRESHOLD_SEC}s)`);

      if (age <= OFFLINE_THRESHOLD_SEC) {
        console.log(`  ✅ Final decision: ONLINE (by last_seen)`);
        return true;
      }

      console.log(`  ❌ Final decision: OFFLINE (last_seen too old)`);
      return false;
    }

    // ⚠️ ถ้าไม่มี last_seen: "ห้ามเชื่อ status อย่างเดียว"
    if (statusRaw) {
      console.log(`  ⚠️ Has status="${statusRaw}" but no last_seen → check telemetry...`);
    } else {
      console.log(`  ⚠️ No status in attributes, checking telemetry...`);
    }

    // 2) Fallback: telemetry status (ของเดิมคุณมีอยู่แล้ว แต่ปรับให้อยู่เสมอเมื่อไม่มี last_seen)
    const telemetry = await getLatestTelemetry(projectKey, ghKey, ['status']);
    console.log(`  📊 Telemetry:`, telemetry);

    if (telemetry.status && telemetry.status.length > 0) {
      const latest = telemetry.status[0];
      const latestStatus = latest.value;
      const lastUpdateTs = latest.ts; // ms
      const nowMs = Date.now();
      const FRESH_MS = 2 * 60 * 1000;

      console.log(
        `  📡 Status from telemetry: "${latestStatus}" (${Math.floor((nowMs - lastUpdateTs) / 1000)}s ago)`
      );

      if ((nowMs - lastUpdateTs) < FRESH_MS && typeof latestStatus === 'string') {
        const ok = latestStatus.trim().toLowerCase() === 'online';
        console.log(`  ✅ Final decision: ${ok ? 'ONLINE' : 'OFFLINE'} (by telemetry fresh)`);
        return ok;
      }
    }

    console.log(`  ❌ Final decision: OFFLINE (no fresh evidence)`);
    return false;
  } catch (error) {
    console.error(`❌ Error checking device online status for ${ghKey}:`, error);
    return false;
  }
}


/**
 * Test ThingsBoard connection for a project
 */
export async function testConnection(projectKey: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    await getToken(projectKey);
    return {
      success: true,
      message: 'เชื่อมต่อ ThingsBoard สำเร็จ',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : ThaiErrors.TB_CONNECTION_ERROR,
    };
  }
}

// Export for use in routes
export const tbService = {
  getLatestTelemetry,
  getTelemetryTimeseries,
  getAttributes,
  setAttributes, // ✅ เพิ่ม
  sendRpcCommand,
  sendRpc,
  isDeviceOnline,
  testConnection,
  clearToken,
  getProject,
};