import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { sendError, ThaiErrors } from '../utils/response.js';
import { env, isDev } from '../config/env.js';

/**
 * Global error handler middleware
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('❌ Error:', err);
  
  // Log stack trace in development
  if (isDev) {
    console.error(err.stack);
  }
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    sendError(res, ThaiErrors.INVALID_INPUT, 400);
    return;
  }
  
  // Default server error
  sendError(res, isDev ? err.message : ThaiErrors.SERVER_ERROR, 500);
};

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, ThaiErrors.NOT_FOUND, 404);
}
