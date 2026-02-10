/**
 * usePlatform Hook
 * Provides platform detection and utilities
 */

import { useEffect, useState } from 'react';
import { ENV, getPlatform, isCapacitor, isMobile } from '@/config/env';

export interface PlatformInfo {
  platform: 'web' | 'android' | 'ios';
  isCapacitor: boolean;
  isMobile: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isWeb: boolean;
  userAgent: string;
}

/**
 * Hook to get current platform information
 */
export function usePlatform(): PlatformInfo {
  const [platformInfo] = useState<PlatformInfo>(() => {
    const platform = getPlatform();
    return {
      platform,
      isCapacitor: isCapacitor(),
      isMobile: isMobile(),
      isAndroid: platform === 'android',
      isIOS: platform === 'ios',
      isWeb: platform === 'web',
      userAgent: navigator.userAgent,
    };
  });

  useEffect(() => {
    // Log platform info on mount (development only)
    if (ENV.IS_DEV) {
      console.log('📱 Platform Info:', platformInfo);
    }
  }, [platformInfo]);

  return platformInfo;
}

/**
 * Hook to check if app is running in standalone mode (PWA)
 */
export function useIsStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
      );
    };

    setIsStandalone(checkStandalone());

    // Listen for changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isStandalone;
}

/**
 * Hook to get safe area insets (for notched devices)
 */
export function useSafeAreaInsets() {
  const [insets, setInsets] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    const updateInsets = () => {
      const style = getComputedStyle(document.documentElement);
      setInsets({
        top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0'),
        right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0'),
        bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0'),
        left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0'),
      });
    };

    updateInsets();

    // Update on resize
    window.addEventListener('resize', updateInsets);
    return () => window.removeEventListener('resize', updateInsets);
  }, []);

  return insets;
}

export default usePlatform;
