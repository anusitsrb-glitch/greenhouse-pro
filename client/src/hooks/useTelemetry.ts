/**
 * useTelemetry Hook
 * Fetches and polls telemetry data from ThingsBoard
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { tbApi, TelemetryResponse } from '@/lib/tbApi';
import { normalizeNumber } from '@/lib/utils';
import { POLLING_INTERVALS } from '@/config/dataKeys';

interface UseTelemetryOptions {
  project: string;
  gh: string;
  keys: string[];
  enabled?: boolean;
  pollInterval?: number;
}

interface UseTelemetryResult {
  data: Record<string, number | null>;
  timestamps: Record<string, number>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: number | null;
}

export function useTelemetry({
  project,
  gh,
  keys,
  enabled = true,
  pollInterval = POLLING_INTERVALS.TELEMETRY,
}: UseTelemetryOptions): UseTelemetryResult {
  const [data, setData] = useState<Record<string, number | null>>({});
  const [timestamps, setTimestamps] = useState<Record<string, number>>({});
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
      const response = await tbApi.getLatestTelemetry(project, gh, keys);
      
      const newData: Record<string, number | null> = {};
      const newTimestamps: Record<string, number> = {};

      for (const key of keys) {
        const values = response[key];
        if (values && values.length > 0) {
          newData[key] = normalizeNumber(values[0].value);
          newTimestamps[key] = values[0].ts;
        } else {
          newData[key] = null;
          newTimestamps[key] = 0;
        }
      }

      setData(newData);
      setTimestamps(newTimestamps);
      setError(null);
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch telemetry');
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

  return {
    data,
    timestamps,
    isLoading,
    error,
    refetch: fetchData,
    lastUpdated,
  };
}
