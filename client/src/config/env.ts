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
  // ✨ FIXED: Always use Railway URL for Capacitor, try .env first
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 
                'https://greenhouse-pro-server-production.up.railway.app',
  
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
 */
export function getApiUrl(endpoint: string): string {
  // Capacitor apps ALWAYS need full URL
  if (ENV.IS_CAPACITOR) {
    // Remove leading slash if present
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${ENV.API_BASE_URL}/${cleanEndpoint}`;
  }
  
  // Web apps use relative URLs
  return endpoint;
}

/**
 * Log environment info (useful for debugging)
 */
export function logEnvironmentInfo(): void {
  console.group('🌿 GreenHouse Pro - Environment Info');
  console.log('Platform:', ENV.PLATFORM);
  console.log('Is Capacitor:', ENV.IS_CAPACITOR);
  console.log('Is Mobile:', ENV.IS_MOBILE);
  console.log('API Base URL:', ENV.API_BASE_URL);
  console.log('Environment:', ENV.IS_DEV ? 'Development' : 'Production');
  console.groupEnd();
}

// ============================================================
// Platform-Specific Helpers
// ============================================================

export function getUserAgent(): string {
  return navigator.userAgent || '';
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export function getAppIdentifier(): string {
  if (ENV.IS_CAPACITOR) {
    return `capacitor-${ENV.PLATFORM}`;
  }
  if (isStandalone()) {
    return 'pwa';
  }
  return 'web';
}

export default ENV;