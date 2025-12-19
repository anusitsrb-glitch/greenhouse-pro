// User roles
export type UserRole = 'superadmin' | 'admin' | 'operator' | 'viewer';

// Project status
export type ProjectStatus = 'ready' | 'developing';

// Greenhouse status
export type GreenhouseStatus = 'ready' | 'developing';

// Language codes
export type LanguageCode = 'th' | 'en' | 'mm';

// Theme options
export type ThemeOption = 'light' | 'dark' | 'system';

// Database types
export interface User {
  id: number;
  username: string;
  email: string | null;
  phone: string | null;
  password_hash: string;
  role: UserRole;
  language: LanguageCode;
  theme: ThemeOption;
  is_active: boolean;
  last_login_at: string | null;
  last_login_ip: string | null;
  failed_login_count: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  key: string;
  name_th: string;
  status: ProjectStatus;
  tb_base_url: string;
  tb_username: string;
  tb_password: string;
  created_at: string;
  updated_at: string;
}

export interface Greenhouse {
  id: number;
  project_id: number;
  gh_key: string;
  name_th: string;
  status: GreenhouseStatus;
  tb_device_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProjectAccess {
  user_id: number;
  project_id: number;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  project_key: string | null;
  gh_key: string | null;
  detail_json: string;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: string;
  updated_at: string;
}

// Session types
declare module 'express-session' {
  interface SessionData {
    userId: number;
    username: string;
    role: UserRole;
    csrfToken: string;
  }
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ThingsBoard types
export interface TBAuthResponse {
  token: string;
  refreshToken: string;
}

export interface TBTelemetryValue {
  ts: number;
  value: string;
}

export interface TBTelemetryResponse {
  [key: string]: TBTelemetryValue[];
}

export interface TBAttributesResponse {
  [key: string]: string | boolean | number;
}

export interface TBRpcRequest {
  method: string;
  params: unknown;
  timeout?: number;
}

export interface TBRpcResponse {
  [key: string]: unknown;
}
