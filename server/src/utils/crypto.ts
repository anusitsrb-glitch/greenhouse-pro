import crypto from 'crypto';

/**
 * Generate a cryptographically secure random token
 */
export function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate CSRF token
 */
export function generateCsrfToken(): string {
  return generateToken(32);
}
