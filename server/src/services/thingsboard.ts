/**
 * ThingsBoard API Client
 * Centralized module for all ThingsBoard interactions
 */

import { query } from '../db/connection.js';
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
// Configuration
// ============================================================

const REQUEST_TIMEOUT = 30000;
const TOKEN_EXPIRY_BUFFER = 60000;
const JWT_LIFETIME = 9000000;
const RPC_RETRY_ATTEMPTS = 3;

// ============================================================
// Token Cache (per project)
// ============================================================

const tokenCache = new Map<string, TBTokenCache>();

// ============================================================
// Helper Functions
// ============================================================

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
async function getProjectTBSettings(projectKey: string): Promise<{
  baseUrl: string;
  username: string;
  password: string;
} | null> {
  const result = await query(`
    SELECT tb_base_url, tb_username, tb_password
    FROM projects WHERE key = $1
  `, [projectKey]);

  const project = result.rows[0] as Pick<Project, 'tb_base_url' | 'tb_username' | 'tb_password'> | undefined;

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
async function getDeviceId(projectKey: string, ghKey: string): Promise<string | null> {
  const result = await query(`
    SELECT g.tb_device_id
    FROM greenhouses g
    JOIN projects p ON g.project_id = p.id
    WHERE p.key = $1 AND g.gh_key = $2
  `, [projectKey, ghKey]);

  const row = result.rows[0] as { tb_device_id: string | null } | undefined;
  return row?.tb_device_id ?? null;
}

// ============================================================
// ThingsBoard Authentication
// ============================================================

async function tbLogin(
  baseUrl: string,
  username: string,
  password: string
): Promise<TBAuthResponse> {
  const url = `${baseUrl}/api/auth/login`;

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error(ThaiErrors.TB_AUTH_ERROR);
      throw new Error(ThaiErrors.TB_CONNECTION_ERROR);
    }

    const data = await response.json();
    return data as TBAuthResponse;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') throw new Error(ThaiErrors.TB_TIMEOUT);
      throw error;
    }
    throw new Error(ThaiErrors.TB_CONNECTION_ERROR);
  }
}

async function getToken(projectKey: string): Promise<string> {
  const cached = tokenCache.get(projectKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now + TOKEN_EXPIRY_BUFFER) {
    return cached.token;
  }

  const settings = await getProjectTBSettings(projectKey);
  if (!settings) {
    throw new Error(ThaiErrors.PROJECT_NOT_FOUND);
  }

  const authResponse = await tbLogin(settings.baseUrl, settings.username, settings.password);

  tokenCache.set(projectKey, {
    token: authResponse.token,
    refreshToken: authResponse.refreshToken,
    expiresAt: now + JWT_LIFETIME,
  });

  return authResponse.token;
}

export function clearToken(projectKey: string): void {
  tokenCache.delete(projectKey);
}

// ============================================================
// ThingsBoard API Requests
// ============================================================

async function tbRequest<T>(
  projectKey: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const settings = await getProjectTBSettings(projectKey);
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
        err.status = response.status;
        err.tbBody = errorText;
        throw err;
      }

      const text = await response.text();
      if (!text) return {} as T;

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
export async function getProject(projectKey: string): Promise<Project | undefined> {
  const result = await query('SELECT * FROM projects WHERE key = $1', [projectKey]);
  return result.rows[0] as Project | undefined;
}

export async function getLatestTelemetry(
  projectKey: string,
  ghKey: string,
  keys: string[]
): Promise<TBTelemetryResponse> {
  const deviceId = await getDeviceId(projectKey, ghKey);
  if (!deviceId) throw new Error(ThaiErrors.GREENHOUSE_DEVELOPING);

  const keysParam = keys.join(',');
  const endpoint = `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${keysParam}&limit=1`;

  return tbRequest<TBTelemetryResponse>(projectKey, endpoint);
}

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
  const deviceId = await getDeviceId(projectKey, ghKey);
  if (!deviceId) throw new Error(ThaiErrors.GREENHOUSE_DEVELOPING);

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

export async function getAttributes(
  projectKey: string,
  ghKey: string,
  keys: string[]
): Promise<Record<string, unknown>> {
  const deviceId = await getDeviceId(projectKey, ghKey);
  if (!deviceId) throw new Error(ThaiErrors.GREENHOUSE_DEVELOPING);

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
  const deviceId = await getDeviceId(projectKey, ghKey);
  if (!deviceId) throw new Error(ThaiErrors.GREENHOUSE_DEVELOPING);

  const endpoint = `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/${scope}`;

  await tbRequest(projectKey, endpoint, {
    method: 'POST',
    body: JSON.stringify(attributes),
  });
}

export async function sendRpcCommand(
  projectKey: string,
  ghKey: string,
  method: string,
  params: unknown,
  timeout?: number
): Promise<TBRpcResponse> {
  const deviceId = await getDeviceId(projectKey, ghKey);
  if (!deviceId) throw new Error(ThaiErrors.GREENHOUSE_DEVELOPING);

  const isTwoWay = typeof timeout === 'number' && timeout > 0;

  const endpoint = isTwoWay
    ? `/api/rpc/twoway/${deviceId}`
    : `/api/rpc/oneway/${deviceId}`;

  const body = isTwoWay
    ? { method, params, timeout }
    : { method, params };

  console.log(`🚀 RPC ${isTwoWay ? 'two-way' : 'one-way'} to ${ghKey}: ${method}`);

  return tbRequest<TBRpcResponse>(projectKey, endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export const sendRpc = sendRpcCommand;

export async function isDeviceOnline(
  projectKey: string,
  ghKey: string
): Promise<boolean> {
  try {
    console.log(`🔍 [isDeviceOnline] Checking ${ghKey}...`);

    const OFFLINE_THRESHOLD_SEC = 180;

    const attrs = await getAttributes(projectKey, ghKey, ['status', 'last_seen']);
    console.log(`  📦 Attributes:`, attrs);

    const statusRaw =
      typeof attrs.status === 'string' ? attrs.status.trim().toLowerCase() : '';

    const lastSeenVal = (attrs as any).last_seen;
    const lastSeenSec =
      typeof lastSeenVal === 'number'
        ? lastSeenVal
        : typeof lastSeenVal === 'string'
          ? Number(lastSeenVal)
          : NaN;

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

    if (statusRaw) {
      console.log(`  ⚠️ Has status="${statusRaw}" but no last_seen → check telemetry...`);
    } else {
      console.log(`  ⚠️ No status in attributes, checking telemetry...`);
    }

    const telemetry = await getLatestTelemetry(projectKey, ghKey, ['status']);
    console.log(`  📊 Telemetry:`, telemetry);

    if (telemetry.status && telemetry.status.length > 0) {
      const latest = telemetry.status[0];
      const latestStatus = latest.value;
      const lastUpdateTs = latest.ts;
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

export async function testConnection(projectKey: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    await getToken(projectKey);
    return { success: true, message: 'เชื่อมต่อ ThingsBoard สำเร็จ' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : ThaiErrors.TB_CONNECTION_ERROR,
    };
  }
}

export const tbService = {
  getLatestTelemetry,
  getTelemetryTimeseries,
  getAttributes,
  setAttributes,
  sendRpcCommand,
  sendRpc,
  isDeviceOnline,
  testConnection,
  clearToken,
  getProject,
};