/**
 * API Key Authentication Middleware - FINAL VERSION
 * For external third-party access
 * รองรับทุกโรง (greenhouse1-9) พร้อมใช้งานทันที
 */

import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';

// ============================================================
// Types
// ============================================================

export interface ApiKeyData {
  permissions: ('read' | 'control')[];
  projectKeys: string[];
  greenhouseKeys?: string[]; // undefined = ทุกโรง, [] = ไม่มีโรง, ['gh1','gh2'] = เฉพาะโรง
  description?: string;
}

// ============================================================
// API Keys Storage
// ============================================================

const VALID_API_KEYS: Record<string, ApiKeyData> = {
  // ========================================
  // 🔑 Read-Only Key (ดูข้อมูลทุกโรง)
  // ========================================
  'ghp_readonly_all_9271d426f500cf5914e9a52f8c313bc0e46ccff79e18def8c2c2e9f01bed755a': {
    permissions: ['read'],
    projectKeys: ['maejard'],
    // ไม่ระบุ greenhouseKeys = เข้าถึงทุกโรง (1-9)
    description: 'Read-only access to ALL greenhouses (1-9)',
  },
  
  // ========================================
  // 🔑 Full Access Key (ดู + ควบคุมทุกโรง)
  // ========================================
  'ghp_fullaccess_all_291a3d1919e0bb99ac44b8a1b658365035787667f58546da59e7e1c15d14fcab': {
    permissions: ['read', 'control'],
    projectKeys: ['maejard'],
    // ไม่ระบุ greenhouseKeys = เข้าถึงทุกโรง (1-9)
    description: 'Full access (read + control) to ALL greenhouses (1-9)',
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
  (req as any).apiKeyPrefix = apiKey.substring(0, 20); // สำหรับ logging
  
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
 * ตรวจสอบว่า API Key มีสิทธิ์เข้าถึง project และ greenhouse หรือไม่
 */
export function requireProjectAccess(req: Request, res: Response, next: NextFunction): void {
  const keyData = (req as any).apiKeyData as ApiKeyData | undefined;
  
  if (!keyData) {
    sendError(res, 'API Key validation required', 401);
    return;
  }
  
  const projectKey = req.params.projectKey;
  const ghKey = req.params.ghKey;
  
  // ตรวจสอบ Project Access
  if (projectKey) {
    if (!keyData.projectKeys.includes(projectKey)) {
      sendError(res, `API Key does not have access to project '${projectKey}'`, 403);
      return;
    }
  }
  
  // ตรวจสอบ Greenhouse Access
  // ถ้า greenhouseKeys === undefined หรือ null = เข้าถึงทุกโรงได้
  // ถ้า greenhouseKeys = [] = ไม่มีสิทธิ์โรงไหนเลย
  // ถ้า greenhouseKeys = ['greenhouse1', 'greenhouse2'] = เฉพาะโรงที่ระบุ
  if (ghKey && keyData.greenhouseKeys !== undefined) {
    if (!keyData.greenhouseKeys.includes(ghKey)) {
      sendError(res, `API Key does not have access to greenhouse '${ghKey}'`, 403);
      return;
    }
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

export default { validateApiKey, requirePermission, requireProjectAccess, apiKeyAuth };