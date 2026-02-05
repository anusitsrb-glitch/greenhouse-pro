/**
 * Projects & Greenhouses API Client
 */

import { api } from './api';

// ============================================================
// Types
// ============================================================

export interface Project {
  id: number;
  key: string;
  nameTh: string;
  status: 'ready' | 'developing';
  statusText: string;
  greenhouseCount: number;
  readyGreenhouseCount: number;
  hasAccess: boolean;
}

export interface Greenhouse {
  id: number;
  ghKey: string;
  nameTh: string;
  status: 'ready' | 'developing';
  statusText: string;
  hasDevice: boolean;
  deviceId?: string;
  deviceStatus?: 'online' | 'offline';

}

export interface ProjectDetail {
  key: string;
  nameTh: string;
  status: string;
}

export interface GreenhouseDetail {
  id: number;
  ghKey: string;
  nameTh: string;
  status: 'ready' | 'developing';
  statusText: string;
  hasDevice: boolean;
  deviceId?: string;
}

// ============================================================
// API Functions
// ============================================================

/**
 * Get all accessible projects
 */
export async function getProjects(): Promise<Project[]> {
  const response = await api.get<{ projects: Project[] }>('/projects');
  
  if (response.success && response.data) {
    return response.data.projects;
  }
  
  throw new Error(response.error || 'Failed to fetch projects');
}

/**
 * Get project details
 */
export async function getProject(projectKey: string): Promise<ProjectDetail> {
  const response = await api.get<{ project: ProjectDetail }>(`/projects/${projectKey}`);
  
  if (response.success && response.data) {
    return response.data.project;
  }
  
  throw new Error(response.error || 'Failed to fetch project');
}

/**
 * Get greenhouses for a project
 */
export async function getGreenhouses(projectKey: string): Promise<{
  project: ProjectDetail;
  greenhouses: Greenhouse[];
}> {
  const response = await api.get<{
    project: ProjectDetail;
    greenhouses: Greenhouse[];
  }>(`/projects/${projectKey}/greenhouses`);
  
  if (response.success && response.data) {
    return response.data;
  }
  
  throw new Error(response.error || 'Failed to fetch greenhouses');
}

/**
 * Get single greenhouse details
 */
export async function getGreenhouse(
  projectKey: string,
  ghKey: string
): Promise<{
  greenhouse: GreenhouseDetail;
  project: ProjectDetail;
}> {
  const response = await api.get<{
    greenhouse: GreenhouseDetail;
    project: ProjectDetail;
  }>(`/projects/${projectKey}/greenhouses/${ghKey}`);
  
  if (response.success && response.data) {
    return response.data;
  }
  
  throw new Error(response.error || 'Failed to fetch greenhouse');
}

// Export as object (✅ return parsed data, not ApiResponse)
export const projectsApi = {
  getProjects,
  getProject,
  getGreenhouses,
  getGreenhouse,
};

