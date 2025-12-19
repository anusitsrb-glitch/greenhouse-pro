import { Request, Response, NextFunction } from 'express';
import { sendError, ThaiErrors } from '../utils/response.js';
import type { UserRole } from '../types/index.js';

/**
 * Require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    sendError(res, ThaiErrors.UNAUTHORIZED, 401);
    return;
  }
  next();
}

/**
 * Require specific role(s) - Super Admin always has access
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session.userId) {
      sendError(res, ThaiErrors.UNAUTHORIZED, 401);
      return;
    }
    
    // Super Admin has access to everything
    if (req.session.role === 'superadmin') {
      next();
      return;
    }
    
    if (!req.session.role || !allowedRoles.includes(req.session.role)) {
      sendError(res, ThaiErrors.FORBIDDEN, 403);
      return;
    }
    
    next();
  };
}

/**
 * Require Super Admin role only
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    sendError(res, ThaiErrors.UNAUTHORIZED, 401);
    return;
  }
  if (req.session.role !== 'superadmin') {
    sendError(res, 'ต้องเป็น Super Admin เท่านั้น', 403);
    return;
  }
  next();
}

/**
 * Require admin role (includes superadmin)
 */
export const requireAdmin = requireRole('superadmin', 'admin');

/**
 * Require operator or admin role (includes superadmin)
 */
export const requireOperator = requireRole('superadmin', 'admin', 'operator');

/**
 * CSRF validation middleware
 */
export function validateCsrf(req: Request, res: Response, next: NextFunction): void {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }
  
  const headerToken = req.headers['x-csrf-token'] as string | undefined;
  const sessionToken = req.session.csrfToken;
  
  if (!headerToken || !sessionToken || headerToken !== sessionToken) {
    sendError(res, ThaiErrors.INVALID_CSRF, 403);
    return;
  }
  
  next();
}
