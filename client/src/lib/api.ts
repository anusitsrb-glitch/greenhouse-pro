/**
 * API client with CSRF and error handling
 * ✅ Updated to support dynamic URLs for Capacitor
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

class ApiClient {
  private csrfToken: string | null = null;

  /**
   * Fetch CSRF token
   */
  async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken ?? '';

    try {
      const url = getApiUrl(`${API_BASE}/auth/csrf`);
      const response = await fetch(url, {
        credentials: 'include',
      });
      const data = await response.json();
      
      if (data.success && data.data?.csrfToken) {
        this.csrfToken = data.data.csrfToken;
        return this.csrfToken ?? '';
      }
    } catch (e) {
      console.error('Failed to get CSRF token:', e);
    }
    
    return '';
  }

  /**
   * Clear CSRF token (call on logout)
   */
  clearCsrfToken(): void {
    this.csrfToken = null;
  }

  /**
   * Set CSRF token (call after login)
   */
  setCsrfToken(token: string): void {
    this.csrfToken = token;
  }

  /**
   * Make a GET request
   */
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const url = getApiUrl(`${API_BASE}${endpoint}`);
      
      console.log('🔵 [API GET] Starting...');
      console.log('🔵 Endpoint:', endpoint);
      console.log('🔵 Full URL:', url);
      
      // ✅ ใช้ CapacitorHttp แทน fetch บน mobile
      if (ENV.IS_CAPACITOR) {
        const response = await CapacitorHttp.get({
          url,
          headers: {
            'Accept': 'application/json',
          },
          webFetchExtra: {
            credentials: 'include',
          },
        });

        console.log('🟢 [API GET] Response received!');
        console.log('🟢 Status:', response.status);
        
        return response.data;
      }
      
      // Web: ใช้ fetch ปกติ
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('🟢 [API GET] Response received!');
      console.log('🟢 Status:', response.status);
      
      return response.json();
    } catch (e) {
      console.error('🔴 [API GET] CATCH ERROR!');
      console.error('🔴 Error:', e);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Make a POST request (without CSRF for login)
   */
  async postWithoutCsrf<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    try {
      const url = getApiUrl(`${API_BASE}${endpoint}`);
      
      console.log('🔵 [API POST (no CSRF)] Starting...');
      console.log('🔵 Endpoint:', endpoint);
      console.log('🔵 Full URL:', url);
      console.log('🔵 Body:', JSON.stringify(body));
      
      // ✅ ใช้ CapacitorHttp แทน fetch บน mobile
      if (ENV.IS_CAPACITOR) {
        const response = await CapacitorHttp.post({
          url,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          data: body,
          webFetchExtra: {
            credentials: 'include',
          },
        });

        console.log('🟢 [API POST] Response received!');
        console.log('🟢 Status:', response.status);
        console.log('🟢 Result:', JSON.stringify(response.data));
        
        return response.data;
      }
      
      // Web: ใช้ fetch ปกติ
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      console.log('🟢 [API POST] Response received!');
      console.log('🟢 Status:', response.status);
      
      return response.json();
    } catch (e) {
      console.error('🔴 [API POST] CATCH ERROR!');
      console.error('🔴 Error:', e);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Make a POST request (with CSRF)
   */
  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    try {
      const csrf = await this.getCsrfToken();
      const url = getApiUrl(`${API_BASE}${endpoint}`);
      
      if (ENV.IS_DEV) {
        console.log('[API POST]', url);
      }
      
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': csrf,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      
      return response.json();
    } catch (e) {
      console.error('POST error:', e);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Make a PUT request
   */
  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    try {
      const csrf = await this.getCsrfToken();
      const url = getApiUrl(`${API_BASE}${endpoint}`);
      
      if (ENV.IS_DEV) {
        console.log('[API PUT]', url);
      }

      const response = await fetch(url, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': csrf,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        return { success: false, error: text || `HTTP ${response.status}` };
      }
    } catch (e) {
      console.error('PUT error:', e);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const csrf = await this.getCsrfToken();
      const url = getApiUrl(`${API_BASE}${endpoint}`);
      
      if (ENV.IS_DEV) {
        console.log('[API DELETE]', url);
      }
      
      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-CSRF-Token': csrf,
        },
      });
      
      return response.json();
    } catch (e) {
      console.error('DELETE error:', e);
      return { success: false, error: 'Network error' };
    }
  }
}

// Export singleton instance
export const api = new ApiClient();

// Auth API functions - login uses postWithoutCsrf
export const authApi = {
  login: (username: string, password: string) => 
    api.postWithoutCsrf<{ user: { id: number; username: string; role: string }; csrfToken: string }>('/auth/login', { username, password }),
  
  logout: () => api.post('/auth/logout'),
  
  me: () => api.get<{ user: { id: number; username: string; email: string | null; role: string; fullName?: string; phone?: string; language?: string; theme?: string; isActive: boolean; createdAt: string } }>('/auth/me'),
  
  changePassword: (currentPassword: string, newPassword: string) => 
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Health check
export const healthApi = {
  check: () => api.get<{ status: string; timestamp: string; uptime: number }>('/health'),
};