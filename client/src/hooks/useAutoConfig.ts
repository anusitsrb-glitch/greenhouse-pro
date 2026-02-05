/**
 * useAutoConfig Hook
 * Manages Advanced Auto Configuration (WebApp-based)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { tbApi } from '@/lib/tbApi';
import { useToast } from '@/hooks/useToast';
import type { AutoConfig } from '@/types/autoConfig';
import { DEFAULT_AUTO_CONFIG } from '@/types/autoConfig';

interface UseAutoConfigOptions {
  project: string;
  gh: string;
  enabled?: boolean;
  pollInterval?: number; // Poll attributes every N ms (default: 10000)
}

interface UseAutoConfigResult {
  config: AutoConfig;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  lastUpdated: number | null;
  updateConfig: (updates: Partial<AutoConfig>) => Promise<void>;
  refetch: () => Promise<void>;
}

const AUTO_CONFIG_KEY = 'auto_config';
const DEFAULT_POLL_INTERVAL = 10000; // 10 seconds

export function useAutoConfig({
  project,
  gh,
  enabled = true,
  pollInterval = DEFAULT_POLL_INTERVAL,
}: UseAutoConfigOptions): UseAutoConfigResult {
  const { addToast } = useToast();
  
  const [config, setConfig] = useState<AutoConfig>(DEFAULT_AUTO_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch config from ThingsBoard
  const fetchConfig = useCallback(async () => {
    if (!project || !gh) {
      setIsLoading(false);
      return;
    }

    try {
      const attributes = await tbApi.getAttributes(project, gh, [AUTO_CONFIG_KEY]);
      
      if (attributes[AUTO_CONFIG_KEY]) {
        // Parse nested JSON if needed
        let parsedConfig = attributes[AUTO_CONFIG_KEY];
        
        if (typeof parsedConfig === 'string') {
          parsedConfig = JSON.parse(parsedConfig);
        }
        
        // Merge with defaults to handle missing fields
        setConfig({
          ...DEFAULT_AUTO_CONFIG,
          ...parsedConfig,
        });
      } else {
        // No config found, use defaults
        setConfig(DEFAULT_AUTO_CONFIG);
      }
      
      setError(null);
      setLastUpdated(Date.now());
    } catch (err) {
      console.error('[useAutoConfig] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch config');
    } finally {
      setIsLoading(false);
    }
  }, [project, gh]);

  // Update config to ThingsBoard
  const updateConfig = useCallback(async (updates: Partial<AutoConfig>) => {
    if (!project || !gh) return;

    setIsSaving(true);
    
    try {
      // Merge updates with current config
      const newConfig: AutoConfig = {
        ...config,
        ...updates,
      };
      
      // Write to ThingsBoard attributes
      await tbApi.setAttributes(project, gh, {
        [AUTO_CONFIG_KEY]: newConfig,
      });
      
      // Update local state
      setConfig(newConfig);
      setLastUpdated(Date.now());
      
      addToast({
        type: 'success',
        message: 'บันทึกการตั้งค่าสำเร็จ',
      });
    } catch (err) {
      console.error('[useAutoConfig] Update error:', err);
      const message = err instanceof Error ? err.message : 'Failed to update config';
      
      addToast({
        type: 'error',
        message: `บันทึกไม่สำเร็จ: ${message}`,
      });
      
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [project, gh, config, addToast]);

  // Polling effect
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchConfig();

    // Set up polling
    if (pollInterval > 0) {
      intervalRef.current = setInterval(fetchConfig, pollInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, fetchConfig, pollInterval]);

  return {
    config,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    updateConfig,
    refetch: fetchConfig,
  };
}