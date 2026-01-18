/**
 * API Key Authentication Middleware
 * For external third-party access
 */

import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';

// ============================================================
// Types
// ============================================================

export interface ApiKeyData {
  permissions: ('read' | 'control')[];
  projectKeys: string[];
  description?: string;
}

// ============================================================
// API Keys Storage (Hard-coded for now)
// TODO: Move to database in the future
// ============================================================

const VALID_API_KEYS: Record<string, ApiKeyData> = {
  // Read-Only API Key
  'ghp_readonly_abc123xyz789': {
    permissions: ['read'],
    projectKeys: ['maejard'], // จำกัดเฉพาะ project maejard
    description: 'Read-only access for Company ABC',
  },
  
  // Full Access API Key
  'ghp_fullaccess_xyz789abc123': {
    permissions: ['read', 'control'],
    projectKeys: ['maejard'],
    description: 'Full access for Company ABC',
  },
};

// ============================================================
// Middleware Functions
// ============================================================

/**
 * Validate API Key
 * Checks if the API key exists and is valid
 */
export function validateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  
  if (!apiKey) {
    sendError(res, 'API Key is required. Please provide X-API-Key header.', 401);
    return;
  }
  
  const keyData = VALID_API_KEYS[apiKey];
  
  if (!keyData) {
    sendError(res, 'Invalid API Key', 401);
    return;
  }
  
  // Store API key data in request for later use
  (req as any).apiKeyData = keyData;
  (req as any).apiKey = apiKey;
  
  next();
}

/**
 * Require specific permission
 */
export function requirePermission(permission: 'read' | 'control') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const keyData = (req as any).apiKeyData as ApiKeyData | undefined;
    
    if (!keyData) {
      sendError(res, 'API Key validation required', 401);
      return;
    }
    
    if (!keyData.permissions.includes(permission)) {
      sendError(res, `This API Key does not have '${permission}' permission`, 403);
      return;
    }
    
    next();
  };
}

/**
 * Require project access
 */
export function requireProjectAccess(req: Request, res: Response, next: NextFunction): void {
  const keyData = (req as any).apiKeyData as ApiKeyData | undefined;
  const projectKey = req.params.projectKey;
  
  if (!keyData) {
    sendError(res, 'API Key validation required', 401);
    return;
  }
  
  if (!projectKey) {
    sendError(res, 'Project key is required', 400);
    return;
  }
  
  // Check if API key has access to this project
  if (!keyData.projectKeys.includes(projectKey)) {
    sendError(res, `API Key does not have access to project '${projectKey}'`, 403);
    return;
  }
  
  next();
}

/**
 * Combined middleware: Validate API Key + Require Permission + Require Project Access
 */
export function apiKeyAuth(permission: 'read' | 'control') {
  return [
    validateApiKey,
    requirePermission(permission),
    requireProjectAccess,
  ];
}