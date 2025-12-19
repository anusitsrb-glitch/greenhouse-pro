/**
 * useAttributes Hook
 * Fetches and polls device attributes from ThingsBoard
 * Used for control states (relays, motors, auto modes, timers)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { tbApi, AttributesResponse } from '@/lib/tbApi';
import { normalizeBoolean } from '@/lib/utils';
import { POLLING_INTERVALS } from '@/config/dataKeys';

interface UseAttributesOptions {
  project: string;
  gh: string;
  keys: string[];
  enabled?: boolean;
  pollInterval?: number;
}

interface UseAttributesResult {
  data: AttributesResponse;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: number | null;
  isOnline: boolean;
}

export function useAttributes({
  project,
  gh,
  keys,
  enabled = true,
  pollInterval = POLLING_INTERVALS.ATTRIBUTES,
}: UseAttributesOptions): UseAttributesResult {
  const [data, setData] = useState<AttributesResponse>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    if (!project || !gh || keys.length === 0) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await tbApi.getAttributes(project, gh, keys);
      setData(response);
      setError(null);
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch attributes');
    } finally {
      setIsLoading(false);
    }
  }, [project, gh, keys]);

  // Initial fetch and polling
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchData();

    // Set up polling
    if (pollInterval > 0) {
      intervalRef.current = setInterval(fetchData, pollInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, fetchData, pollInterval]);

  // Determine online status from attributes
  const isOnline = (() => {
    const status = data.status;
    if (typeof status === 'string') {
      return status.toLowerCase() === 'online';
    }
    return false;
  })();

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
    lastUpdated,
    isOnline,
  };
}

/**
 * useBurstPoll Hook
 * For burst polling after RPC to confirm attribute changes
 */
export function useBurstPoll(
  project: string,
  gh: string,
  keys: string[],
  onData: (data: AttributesResponse) => void
) {
  const burstIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const burstTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startBurst = useCallback(() => {
    // Clear any existing burst
    if (burstIntervalRef.current) clearInterval(burstIntervalRef.current);
    if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);

    // Start burst polling
    burstIntervalRef.current = setInterval(async () => {
      try {
        const response = await tbApi.getAttributes(project, gh, keys);
        onData(response);
      } catch (err) {
        console.error('Burst poll error:', err);
      }
    }, POLLING_INTERVALS.BURST_CONFIRM);

    // Stop burst after duration
    burstTimeoutRef.current = setTimeout(() => {
      if (burstIntervalRef.current) {
        clearInterval(burstIntervalRef.current);
        burstIntervalRef.current = null;
      }
    }, POLLING_INTERVALS.BURST_DURATION);
  }, [project, gh, keys, onData]);

  const stopBurst = useCallback(() => {
    if (burstIntervalRef.current) {
      clearInterval(burstIntervalRef.current);
      burstIntervalRef.current = null;
    }
    if (burstTimeoutRef.current) {
      clearTimeout(burstTimeoutRef.current);
      burstTimeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBurst();
    };
  }, [stopBurst]);

  return { startBurst, stopBurst };
}
