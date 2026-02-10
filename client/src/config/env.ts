/**
 * Environment Configuration
 * Detects platform (web/Android/iOS) and provides correct API URLs
 */

// ============================================================
// Platform Detection
// ============================================================

/**
 * Check if running in Capacitor
 */
export const isCapacitor = (): boolean => {
  return !!(window as any).Capacitor;
};

/**
 * Get current platform
 */
export const getPlatform = (): 'web' | 'android' | 'ios' => {
  if (!isCapacitor()) return 'web';
  return (window as any).Capacitor?.getPlatform() || 'web';
};

/**
 * Check if running on Android
 */
export const isAndroid = (): boolean => {
  return getPlatform() === 'android';
};

/**
 * Check if running on iOS
 */
export const isIOS = (): boolean => {
  return getPlatform() === 'ios';
};

/**
 * Check if running on mobile (Android or iOS)
 */
export const isMobile = (): boolean => {
  return isAndroid() || isIOS();
};

// ============================================================
// Environment Variables
// ============================================================

/**
 * Environment configuration object
 */
export const ENV = {
  // Platform detection
  IS_CAPACITOR: isCapacitor(),
  IS_MOBILE: isMobile(),
  IS_ANDROID: isAndroid(),
  IS_IOS: isIOS(),
  PLATFORM: getPlatform(),

  // API Configuration
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '',
  
  // App Configuration
  APP_NAME: 'GreenHouse Pro',
  APP_VERSION: '5.0.0',
  
  // Development mode
  IS_DEV: import.meta.env.DEV,
  IS_PROD: import.meta.env.PROD,
} as const;

// ============================================================
// API URL Helper
// ============================================================

/**
 * Get full API URL based on platform and environment
 * 
 * @param endpoint - API endpoint (e.g., '/api/auth/login')
 * @returns Full URL for the API call
 * 
 * @example
 * // Web Development (with Vite proxy)
 * getApiUrl('/api/users') → '/api/users'
 * 
 * // Web Production (same origin)
 * getApiUrl('/api/users') → '/api/users'
 * 
 * // Capacitor (Android/iOS)
 * getApiUrl('/api/users') → 'https://greenhouse-pro-server-production.up.railway.app/api/users'
 */
export function getApiUrl(endpoint: string): string {
  // Capacitor apps need full URL
  if (ENV.IS_CAPACITOR && ENV.API_BASE_URL) {
    // Remove leading slash if present to avoid double slashes
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${ENV.API_BASE_URL}/${cleanEndpoint}`;
  }
  
  // Web apps use relative URLs (works with Vite proxy in dev, same-origin in prod)
  return endpoint;
}

/**
 * Log environment info (useful for debugging)
 */
export function logEnvironmentInfo(): void {
  if (!ENV.IS_DEV) return;
  
  console.group('🌿 GreenHouse Pro - Environment Info');
  console.log('Platform:', ENV.PLATFORM);
  console.log('Is Capacitor:', ENV.IS_CAPACITOR);
  console.log('Is Mobile:', ENV.IS_MOBILE);
  console.log('API Base URL:', ENV.API_BASE_URL || 'Using relative URLs');
  console.log('Environment:', ENV.IS_DEV ? 'Development' : 'Production');
  console.groupEnd();
}

// ============================================================
// Platform-Specific Helpers
// ============================================================

/**
 * Get user-agent string
 */
export function getUserAgent(): string {
  return navigator.userAgent || '';
}

/**
 * Check if running in standalone mode (PWA)
 */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * Get app identifier for analytics/logging
 */
export function getAppIdentifier(): string {
  if (ENV.IS_CAPACITOR) {
    return `capacitor-${ENV.PLATFORM}`;
  }
  if (isStandalone()) {
    return 'pwa';
  }
  return 'web';
}

// Export all functions
export default ENV;
