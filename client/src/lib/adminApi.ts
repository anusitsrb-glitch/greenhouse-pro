/**
 * Admin API Client
 * For user, project, greenhouse, and settings management
 */

import { api } from './api';

// ============================================================
// Types
// ============================================================

export interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  role: 'superadmin' | 'admin' | 'operator' | 'viewer';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  projectKeys?: string[];
  projects?: { id: number; key: string; nameTh: string }[];
  projectAccess?: { id: number; key: string; nameTh: string }[];
}


export interface AdminProject {
  id: number;
  key: string;
  nameTh: string;
  status: 'ready' | 'developing';
  tbBaseUrl: string;
  tbUsername: string;
  greenhouseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminGreenhouse {
  id: number;
  projectId: number;
  projectKey: string;
  projectName: string;
  ghKey: string;
  nameTh: string;
  status: 'ready' | 'developing';
  tbDeviceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LineNotifyConfig {
  enabled: boolean;
  token?: string;
  tokenMasked?: string;
  alertOnOffline: boolean;
  alertOnThreshold: boolean;
  thresholds: {
    temp_min: number;
    temp_max: number;
    humidity_min: number;
    humidity_max: number;
    soil_moisture_min: number;
    soil_moisture_max: number;
  };
}

// ============================================================
// User Management
// ============================================================

export async function getUsers(): Promise<AdminUser[]> {
  const response = await api.get<{ users: AdminUser[] }>('/admin/users');
  if (response.success && response.data) {
    return response.data.users;
  }
  throw new Error(response.error || 'Failed to fetch users');
}

export async function getUser(id: number): Promise<AdminUser> {
  const response = await api.get<{ user: AdminUser }>(`/admin/users/${id}`);
  if (response.success && response.data) {
    return response.data.user;
  }
  throw new Error(response.error || 'Failed to fetch user');
}

export async function createUser(data: {
  username: string;
  email?: string;
  password: string;
  role: string;
}): Promise<{ id: number }> {
  const response = await api.post<{ user: { id: number } }>('/admin/users', data);
  if (response.success && response.data) {
    return response.data.user;
  }
  throw new Error(response.error || 'Failed to create user');
}

export async function updateUser(id: number, data: {
  email?: string;
  role?: string;
  isActive?: boolean;
}): Promise<void> {
  const payload: any = { ...data };
  if (payload.isActive !== undefined) {
    payload.is_active = payload.isActive;
    delete payload.isActive;
  }

  const response = await api.put(`/admin/users/${id}`, payload);
  if (!response.success) throw new Error(response.error || 'Failed to update user');
}


export async function updateUserProjectAccess(id: number, projectIds: number[]): Promise<void> {
  const response = await api.post(`/admin/users/${id}/project-access`, { project_ids: projectIds });
  if (!response.success) {
    throw new Error(response.error || 'Failed to update project access');
  }
}

export async function deleteUser(id: number): Promise<void> {
  const response = await api.delete(`/admin/users/${id}`);
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete user');
  }
}

// ============================================================
// Project Management
// ============================================================

export async function getAdminProjects(): Promise<AdminProject[]> {
  const response = await api.get<{ projects: AdminProject[] }>('/admin/projects');
  if (response.success && response.data) {
    return response.data.projects;
  }
  throw new Error(response.error || 'Failed to fetch projects');
}

export async function getAdminProject(key: string): Promise<AdminProject> {
  const response = await api.get<{ project: AdminProject }>(`/admin/projects/${key}`);
  if (response.success && response.data) {
    return response.data.project;
  }
  throw new Error(response.error || 'Failed to fetch project');
}

export async function createProject(data: {
  key: string;
  name_th: string;
  status: string;
  tb_base_url: string;
  tb_username: string;
  tb_password: string;
}): Promise<{ id: number }> {
  const response = await api.post<{ project: { id: number } }>('/admin/projects', data);
  if (response.success && response.data) {
    return response.data.project;
  }
  throw new Error(response.error || 'Failed to create project');
}

export async function updateProject(key: string, data: {
  name_th?: string;
  status?: string;
  tb_base_url?: string;
  tb_username?: string;
  tb_password?: string;
}): Promise<void> {
  const response = await api.put(`/admin/projects/${key}`, data);
  if (!response.success) {
    throw new Error(response.error || 'Failed to update project');
  }
}

export async function deleteProject(key: string): Promise<void> {
  const response = await api.delete(`/admin/projects/${key}`);
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete project');
  }
}

// ============================================================
// Greenhouse Management
// ============================================================

export async function getAdminGreenhouses(projectKey?: string): Promise<AdminGreenhouse[]> {
  const url = projectKey 
    ? `/admin/greenhouses?project_key=${projectKey}`
    : '/admin/greenhouses';
  const response = await api.get<{ greenhouses: AdminGreenhouse[] }>(url);
  if (response.success && response.data) {
    return response.data.greenhouses;
  }
  throw new Error(response.error || 'Failed to fetch greenhouses');
}

export async function createGreenhouse(data: {
  project_key: string;
  gh_key: string;
  name_th: string;
  status: string;
  tb_device_id?: string;
}): Promise<{ id: number }> {
  const response = await api.post<{ greenhouse: { id: number } }>('/admin/greenhouses', data);
  if (response.success && response.data) {
    return response.data.greenhouse;
  }
  throw new Error(response.error || 'Failed to create greenhouse');
}

export async function updateGreenhouse(projectKey: string, ghKey: string, data: {
  name_th?: string;
  status?: string;
}): Promise<void> {
  const response = await api.put(`/admin/greenhouses/${projectKey}/${ghKey}`, data);
  if (!response.success) {
    throw new Error(response.error || 'Failed to update greenhouse');
  }
}

export async function linkDevice(projectKey: string, ghKey: string, deviceId: string): Promise<void> {
  const response = await api.post(`/admin/greenhouses/${projectKey}/${ghKey}/link-device`, {
    tb_device_id: deviceId,
  });
  if (!response.success) {
    throw new Error(response.error || 'Failed to link device');
  }
}

export async function unlinkDevice(projectKey: string, ghKey: string): Promise<void> {
  const response = await api.post(`/admin/greenhouses/${projectKey}/${ghKey}/unlink-device`, {});
  if (!response.success) {
    throw new Error(response.error || 'Failed to unlink device');
  }
}

export async function deleteGreenhouse(projectKey: string, ghKey: string): Promise<void> {
  const response = await api.delete(`/admin/greenhouses/${projectKey}/${ghKey}`);
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete greenhouse');
  }
}

// ============================================================
// Settings
// ============================================================

export async function getSettings(): Promise<Record<string, any>> {
  const response = await api.get<{ settings: Record<string, any> }>('/admin/settings');
  if (response.success && response.data) {
    return response.data.settings;
  }
  throw new Error(response.error || 'Failed to fetch settings');
}

export async function getLineNotifyConfig(): Promise<LineNotifyConfig> {
  const response = await api.get<{ config: LineNotifyConfig }>('/admin/settings/line-notify/config');
  if (response.success && response.data) {
    return response.data.config;
  }
  throw new Error(response.error || 'Failed to fetch Line Notify config');
}

export async function updateLineNotifyConfig(config: Partial<LineNotifyConfig>): Promise<void> {
  const response = await api.put('/admin/settings/line-notify/config', config);
  if (!response.success) {
    throw new Error(response.error || 'Failed to update Line Notify config');
  }
}

export async function testLineNotify(): Promise<void> {
  const response = await api.post('/admin/settings/line-notify/test', {});
  if (!response.success) {
    throw new Error(response.error || 'Failed to test Line Notify');
  }
}

// ============================================================
// Reports
// ============================================================

export function getReportDownloadUrl(project: string, gh: string, period: '1d' | '7d' | '30d'): string {
  return `/api/reports/download?project=${project}&gh=${gh}&period=${period}`;
}

export async function getReportPreview(project: string, gh: string, period: '1d' | '7d' | '30d'): Promise<any> {
  const response = await api.get(`/reports/preview?project=${project}&gh=${gh}&period=${period}`);
  if (response.success && response.data) {
    return response.data;
  }
  throw new Error(response.error || 'Failed to fetch report preview');
}

// Export as object
export const adminApi = {
  // Users
  getUsers,
  getUser,
  createUser,
  updateUser,
  updateUserProjectAccess,
  deleteUser,
  
  // Projects
  getAdminProjects,
  getAdminProject,
  createProject,
  updateProject,
  deleteProject,
  
  // Greenhouses
  getAdminGreenhouses,
  createGreenhouse,
  updateGreenhouse,
  linkDevice,
  unlinkDevice,
  deleteGreenhouse,
  
  // Settings
  getSettings,
  getLineNotifyConfig,
  updateLineNotifyConfig,
  testLineNotify,
  
  // Reports
  getReportDownloadUrl,
  getReportPreview,
};
