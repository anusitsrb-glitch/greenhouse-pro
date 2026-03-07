/**
 * API client with CSRF and error handling
 * ✅ Updated to support dynamic URLs for Capacitor
 * ✅ Patch 1: ทุก method ใช้ CapacitorHttp บน mobile
 */

import { getApiUrl, ENV } from '@/config/env';
import { CapacitorHttp } from '@capacitor/core';

const API_BASE = '/api';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

class ApiClient {
  private csrfToken: string | null = null;
  private csrfPromise: Promise<string> | null = null; // ✅ in-flight guard

  private async request<T>(
    method: HttpMethod,
    endpoint: string,
    body?: unknown,
    extraHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    const url = getApiUrl(`${API_BASE}${endpoint}`);

    if (ENV.IS_DEV) {
      console.log(`🔵 [API ${method}]`, url, body ?? '');
    }

    if (ENV.IS_CAPACITOR) {
      const response = await CapacitorHttp.request({
        url,
        method,
        headers: {
          'Accept': 'application/json',
          ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
          ...(extraHeaders ?? {}),
        },
        data: body,
        webFetchExtra: { credentials: 'include' },
      });

      if (ENV.IS_DEV) {
        console.log(`🟢 [API ${method}] Status:`, response.status);
      }

      return response.data as ApiResponse<T>;
    }

    const response = await fetch(url, {
      method,
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
        ...(extraHeaders ?? {}),
      },
      body: method === 'GET' ? undefined : body ? JSON.stringify(body) : undefined,
    });

    if (ENV.IS_DEV) {
      console.log(`🟢 [API ${method}] Status:`, response.status);
    }

    const text = await response.text();
    try {
      return JSON.parse(text) as ApiResponse<T>;
    } catch {
      return { success: false, error: text || `HTTP ${response.status}` } as ApiResponse<T>;
    }
  }

  async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    if (this.csrfPromise) return this.csrfPromise; // ✅ ถ้ากำลัง fetch อยู่ รอตัวเดิม

    this.csrfPromise = this.request<{ csrfToken: string }>('GET', '/auth/csrf')
      .then((data) => {
        if (data.success && data.data?.csrfToken) {
          this.csrfToken = data.data.csrfToken;
        }
        this.csrfPromise = null;
        return this.csrfToken ?? '';
      })
      .catch((e) => {
        console.error('Failed to get CSRF token:', e);
        this.csrfPromise = null;
        return '';
      });

    return this.csrfPromise;
  }

  clearCsrfToken(): void {
    this.csrfToken = null;
    this.csrfPromise = null; // ✅ clear promise ด้วย
  }

  setCsrfToken(token: string): void {
    this.csrfToken = token;
    this.csrfPromise = null; // ✅ clear promise ด้วย
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      return await this.request<T>('GET', endpoint);
    } catch (e) {
      console.error('GET error:', e);
      return { success: false, error: 'Network error' };
    }
  }

  async postWithoutCsrf<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    try {
      return await this.request<T>('POST', endpoint, body);
    } catch (e) {
      console.error('POST (no CSRF) error:', e);
      return { success: false, error: 'Network error' };
    }
  }

  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    try {
      const csrf = await this.getCsrfToken();
      return await this.request<T>('POST', endpoint, body, { 'X-CSRF-Token': csrf });
    } catch (e) {
      console.error('POST error:', e);
      return { success: false, error: 'Network error' };
    }
  }

  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    try {
      const csrf = await this.getCsrfToken();
      return await this.request<T>('PUT', endpoint, body, { 'X-CSRF-Token': csrf });
    } catch (e) {
      console.error('PUT error:', e);
      return { success: false, error: 'Network error' };
    }
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const csrf = await this.getCsrfToken();
      return await this.request<T>('DELETE', endpoint, undefined, { 'X-CSRF-Token': csrf });
    } catch (e) {
      console.error('DELETE error:', e);
      return { success: false, error: 'Network error' };
    }
  }
}

export const api = new ApiClient();

export const authApi = {
  login: (username: string, password: string) =>
    api.postWithoutCsrf<{ user: { id: number; username: string; role: string }; csrfToken: string }>(
      '/auth/login',
      { username, password }
    ),

  logout: () => api.post('/auth/logout'),

  me: () =>
    api.get<{
      user: {
        id: number;
        username: string;
        email: string | null;
        role: string;
        fullName?: string;
        phone?: string;
        language?: string;
        theme?: string;
        isActive: boolean;
        createdAt: string;
      };
    }>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

export const healthApi = {
  check: () => api.get<{ status: string; timestamp: string; uptime: number }>('/health'),
};