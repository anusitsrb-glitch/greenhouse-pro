/**
 * useNetworkStatus Hook
 * Monitors network connectivity status
 * Works on both Web and Capacitor (Android/iOS)
 */

import { useEffect, useState } from 'react';
import { ENV } from '@/config/env';

export interface NetworkStatus {
  isOnline: boolean;
  isOffline: boolean;
  connectionType: 'wifi' | 'cellular' | '4g' | '3g' | '2g' | 'none' | 'unknown';
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
  downlink?: number; // Mbps
  rtt?: number; // Round-trip time in ms
}

/**
 * Hook to monitor network status
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => ({
    isOnline: navigator.onLine,
    isOffline: !navigator.onLine,
    connectionType: 'unknown',
  }));

  useEffect(() => {
    // Check if running in Capacitor
    if (ENV.IS_CAPACITOR) {
      let cleanup: (() => void) | undefined;
      
      setupCapacitorNetworkListener(setStatus).then((cleanupFn) => {
        cleanup = cleanupFn;
      });
      
      return () => {
        if (cleanup) cleanup();
      };
    } else {
      return setupWebNetworkListener(setStatus);
    }
  }, []);

  return status;
}

/**
 * Setup network listener for Capacitor (Mobile)
 */
async function setupCapacitorNetworkListener(
  setStatus: React.Dispatch<React.SetStateAction<NetworkStatus>>
): Promise<() => void> {
  try {
    // Dynamically import Capacitor Network plugin
    const { Network } = await import('@capacitor/network');
    
    // Get initial status
    const networkStatus = await Network.getStatus();
    setStatus({
      isOnline: networkStatus.connected,
      isOffline: !networkStatus.connected,
      connectionType: networkStatus.connectionType as any,
    });

    // Listen for changes (with await!)
    const listener = await Network.addListener('networkStatusChange', (networkStatus) => {
      setStatus({
        isOnline: networkStatus.connected,
        isOffline: !networkStatus.connected,
        connectionType: networkStatus.connectionType as any,
      });
    });

    // Return cleanup function
    return () => {
      listener.remove();
    };
  } catch (error) {
    console.error('Failed to load Capacitor Network plugin:', error);
    // Fallback to web listener
    return setupWebNetworkListener(setStatus);
  }
}

/**
 * Setup network listener for Web
 */
function setupWebNetworkListener(
  setStatus: React.Dispatch<React.SetStateAction<NetworkStatus>>
): () => void {
  const updateNetworkStatus = () => {
    const connection = getNetworkConnection();
    
    setStatus({
      isOnline: navigator.onLine,
      isOffline: !navigator.onLine,
      connectionType: connection.type,
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
    });
  };

  // Initial update
  updateNetworkStatus();

  // Listen for online/offline events
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);

  // Listen for connection changes (if supported)
  const connection = (navigator as any).connection;
  if (connection) {
    connection.addEventListener('change', updateNetworkStatus);
  }

  // Cleanup
  return () => {
    window.removeEventListener('online', updateNetworkStatus);
    window.removeEventListener('offline', updateNetworkStatus);
    if (connection) {
      connection.removeEventListener('change', updateNetworkStatus);
    }
  };
}

/**
 * Get network connection info (Web API)
 */
function getNetworkConnection(): {
  type: NetworkStatus['connectionType'];
  effectiveType?: NetworkStatus['effectiveType'];
  downlink?: number;
  rtt?: number;
} {
  const connection =
    (navigator as any).connection ||
    (navigator as any).mozConnection ||
    (navigator as any).webkitConnection;

  if (!connection) {
    return {
      type: navigator.onLine ? 'unknown' : 'none',
    };
  }

  return {
    type: connection.type || 'unknown',
    effectiveType: connection.effectiveType,
    downlink: connection.downlink,
    rtt: connection.rtt,
  };
}

/**
 * Hook to show offline banner
 */
export function useOfflineBanner(): {
  showBanner: boolean;
  isOnline: boolean;
} {
  const { isOnline } = useNetworkStatus();

  return {
    showBanner: !isOnline,
    isOnline,
  };
}

export default useNetworkStatus;