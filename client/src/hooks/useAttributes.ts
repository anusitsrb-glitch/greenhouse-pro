/**
 * useAttributes Hook - OPTIMIZED with Adaptive Polling
 * Fetches and polls device attributes from ThingsBoard
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { tbApi, AttributesResponse } from '@/lib/tbApi';
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
  const [lastChangeTime, setLastChangeTime] = useState(Date.now());
  const [isTabActive, setIsTabActive] = useState(true);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevDataRef = useRef<string>('');

  const fetchData = useCallback(async () => {
    if (!project || !gh || keys.length === 0) {
      setIsLoading(false);
      return;
    }

    // Cancel previous request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      const response = await tbApi.getAttributes(project, gh, keys);

      // Check if data changed
      const newDataStr = JSON.stringify(response);
      if (newDataStr !== prevDataRef.current) {
        setLastChangeTime(Date.now());
        prevDataRef.current = newDataStr;
      }

      setData(response);
      setError(null);
      setLastUpdated(Date.now());
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch attributes');
    } finally {
      setIsLoading(false);
    }
  }, [project, gh, keys]);

  // Monitor tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isActive = !document.hidden;
      setIsTabActive(isActive);

      // Resume polling immediately when tab becomes active
      if (isActive && enabled) {
        fetchData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, fetchData]);

  // Adaptive polling interval
  const adaptiveInterval = useCallback(() => {
    if (!isTabActive) {
      return 30000; // Poll slowly when tab inactive (30s)
    }

    const timeSinceLastChange = Date.now() - lastChangeTime;

    if (timeSinceLastChange < 30000) {
      // Recent change (< 30s ago) → poll frequently
      return Math.max(pollInterval, 2000);
    } else {
      // No recent changes → poll slowly
      return Math.max(pollInterval * 2, 10000);
    }
  }, [isTabActive, lastChangeTime, pollInterval]);

  // Initial fetch and polling
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchData();

    // Set up adaptive polling
    const startPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      const interval = adaptiveInterval();
      intervalRef.current = setInterval(() => {
        fetchData();
        startPolling(); // Restart with new adaptive interval
      }, interval);
    };

    startPolling();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, fetchData, adaptiveInterval]);

  // Determine online status
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