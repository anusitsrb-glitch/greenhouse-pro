/**
 * ThingsBoard API Client for Frontend (UPDATED)
 * Added setAttributes for WebApp-based Auto Config
 */

import { api } from './api';

// ============================================================
// Types
// ============================================================

export interface TelemetryValue {
  ts: number;
  value: string | number | boolean;
}

export interface TelemetryResponse {
  [key: string]: TelemetryValue[];
}

export interface AttributesResponse {
  [key: string]: unknown;
}

export interface DeviceStatus {
  online: boolean;
  status: string;
  statusTh: string;
}

export interface RpcResponse {
  rpcResponse: Record<string, unknown>;
  message: string;
}

// ============================================================
// API Functions
// ============================================================

/**
 * Get latest telemetry values
 */
export async function getLatestTelemetry(
  project: string,
  gh: string,
  keys: string[]
): Promise<TelemetryResponse> {
  const params = new URLSearchParams({
    project,
    gh,
    keys: keys.join(','),
  });

  const response = await api.get<{ telemetry: TelemetryResponse }>(
    `/tb/latest?${params}`
  );

  if (response.success && response.data) {
    return response.data.telemetry;
  }

  throw new Error(response.error || 'Failed to fetch telemetry');
}

/**
 * Get telemetry timeseries for charts
 */
export async function getTimeseries(
  project: string,
  gh: string,
  keys: string[],
  startTs: number,
  endTs: number,
  options?: {
    interval?: number;
    agg?: string;
    limit?: number;
  }
): Promise<TelemetryResponse> {
  const params = new URLSearchParams({
    project,
    gh,
    keys: keys.join(','),
    startTs: startTs.toString(),
    endTs: endTs.toString(),
  });

  if (options?.interval) params.append('interval', options.interval.toString());
  if (options?.agg) params.append('agg', options.agg);
  if (options?.limit) params.append('limit', options.limit.toString());

  const response = await api.get<{ timeseries: TelemetryResponse }>(
    `/tb/timeseries?${params}`
  );

  if (response.success && response.data) {
    return response.data.timeseries;
  }

  throw new Error(response.error || 'Failed to fetch timeseries');
}

/**
 * Get device attributes
 */
export async function getAttributes(
  project: string,
  gh: string,
  keys: string[]
): Promise<AttributesResponse> {
  const params = new URLSearchParams({
    project,
    gh,
    keys: keys.join(','),
  });

  const response = await api.get<{ attributes: AttributesResponse }>(
    `/tb/attributes?${params}`
  );

  if (response.success && response.data) {
    return response.data.attributes;
  }

  throw new Error(response.error || 'Failed to fetch attributes');
}

/**
 * 🆕 Set device attributes (CLIENT_SCOPE)
 * For WebApp-based configuration
 */
export async function setAttributes(
  project: string,
  gh: string,
  attributes: Record<string, unknown>
): Promise<void> {
  const response = await api.post<{ success: boolean; message?: string }>(
    '/tb/attributes',
    {
      project,
      gh,
      attributes,
    }
  );

  if (!response.success) {
    throw new Error(response.error || 'Failed to set attributes');
  }
}

/**
 * Get device online status
 */
export async function getDeviceStatus(
  project: string,
  gh: string
): Promise<DeviceStatus> {
  const params = new URLSearchParams({ project, gh });

  const response = await api.get<DeviceStatus>(`/tb/device-status?${params}`);

  if (response.success && response.data) {
    return response.data;
  }

  throw new Error(response.error || 'Failed to fetch device status');
}

/**
 * Send RPC command
 */
export async function sendRpc(
  project: string,
  gh: string,
  method: string,
  params: unknown,
  timeout?: number
): Promise<RpcResponse> {
  const response = await api.post<RpcResponse>('/tb/rpc', {
    project,
    gh,
    method,
    params,
    timeout,
  });

  if (response.success && response.data) {
    return response.data;
  }

  throw new Error(response.error || 'Failed to send RPC command');
}

/**
 * Test ThingsBoard connection (admin only)
 */
export async function testConnection(project: string): Promise<{
  success: boolean;
  message: string;
}> {
  const response = await api.post<{ success: boolean; message: string }>(
    '/tb/test-connection',
    { project }
  );

  if (response.success && response.data) {
    return response.data;
  }

  return {
    success: false,
    message: response.error || 'Connection test failed',
  };
}

/**
 * Send RPC command (new interface for hooks)
 * Takes deviceId in format "project_gh"
 */
export async function sendRPCCommand(
  deviceId: string,
  method: string,
  params: unknown,
  timeoutMs?: number
): Promise<RpcResponse> {
  const parts = deviceId.split('_');
  const project = parts.shift();
  const gh = parts.join('_');

  if (!project || !gh) {
    throw new Error('Invalid deviceId format. Expected: "project_gh"');
  }

  return sendRpc(project, gh, method, params, timeoutMs);
}

/**
 * Get device attributes (new interface for hooks)
 * Takes deviceId in format "project_gh"
 */
export async function getDeviceAttributes(
  deviceId: string
): Promise<AttributesResponse> {
  const parts = deviceId.split('_');
  const project = parts.shift();
  const gh = parts.join('_');

  if (!project || !gh) {
    throw new Error('Invalid deviceId format. Expected: "project_gh"');
  }

  const keys = ['*'];
  return getAttributes(project, gh, keys);
}

// Export as object
export const tbApi = {
  getLatestTelemetry,
  getTimeseries,
  getAttributes,
  setAttributes, // 🆕 NEW
  getDeviceStatus,
  sendRpc,
  testConnection,
  sendRPCCommand,
  getDeviceAttributes,
};