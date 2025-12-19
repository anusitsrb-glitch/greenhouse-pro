/**
 * useRpc Hook
 * Sends RPC commands and handles confirmation via attribute polling
 */

import { useState, useCallback, useRef } from 'react';
import { tbApi, AttributesResponse } from '@/lib/tbApi';
import { RPC_CONFIRM_MAP, POLLING_INTERVALS } from '@/config/dataKeys';
import { normalizeBoolean } from '@/lib/utils';

interface PendingCommand {
  method: string;
  expectedAttribute: string;
  expectedValue: unknown;
  startedAt: number;
}

interface UseRpcOptions {
  project: string;
  gh: string;
  onSuccess?: (method: string) => void;
  onTimeout?: (method: string) => void;
  onError?: (method: string, error: string) => void;
}

interface UseRpcResult {
  sendCommand: (method: string, params: unknown, expectedValue?: unknown) => Promise<boolean>;
  isPending: (method: string) => boolean;
  isAnyPending: boolean;
  pendingMethods: string[];
}

export function useRpc({
  project,
  gh,
  onSuccess,
  onTimeout,
  onError,
}: UseRpcOptions): UseRpcResult {
  const [pendingCommands, setPendingCommands] = useState<Map<string, PendingCommand>>(new Map());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Start burst polling to confirm command
  const startConfirmPolling = useCallback((pending: PendingCommand) => {
    // Clear existing polling
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);

    const checkConfirmation = async () => {
      try {
        const attrs = await tbApi.getAttributes(project, gh, [pending.expectedAttribute]);
        const currentValue = attrs[pending.expectedAttribute];
        
        // Normalize for comparison
        const normalizedCurrent = typeof currentValue === 'boolean' 
          ? currentValue 
          : normalizeBoolean(currentValue);
        const normalizedExpected = typeof pending.expectedValue === 'boolean'
          ? pending.expectedValue
          : normalizeBoolean(pending.expectedValue);

        // Check if value matches expected
        const isConfirmed = normalizedCurrent === normalizedExpected ||
          currentValue === pending.expectedValue ||
          String(currentValue) === String(pending.expectedValue);

        if (isConfirmed) {
          // Success!
          setPendingCommands(prev => {
            const next = new Map(prev);
            next.delete(pending.method);
            return next;
          });
          
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
          
          onSuccess?.(pending.method);
          return true;
        }
      } catch (err) {
        console.error('Confirmation poll error:', err);
      }
      return false;
    };

    // Initial check
    checkConfirmation();

    // Burst polling
    pollIntervalRef.current = setInterval(checkConfirmation, POLLING_INTERVALS.BURST_CONFIRM);

    // Timeout
    pollTimeoutRef.current = setTimeout(() => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      
      // Remove from pending and notify timeout
      setPendingCommands(prev => {
        const next = new Map(prev);
        next.delete(pending.method);
        return next;
      });
      
      onTimeout?.(pending.method);
    }, POLLING_INTERVALS.BURST_DURATION);
  }, [project, gh, onSuccess, onTimeout]);

  const sendCommand = useCallback(async (
    method: string,
    params: unknown,
    expectedValue?: unknown
  ): Promise<boolean> => {
    // Determine expected attribute and value
    const expectedAttribute = RPC_CONFIRM_MAP[method];
    const finalExpectedValue = expectedValue ?? (params === 1 || params === '1' || params === true);

    if (!expectedAttribute) {
      console.warn(`No confirmation mapping for RPC method: ${method}`);
    }

    // Mark as pending
    const pending: PendingCommand = {
      method,
      expectedAttribute: expectedAttribute || method,
      expectedValue: finalExpectedValue,
      startedAt: Date.now(),
    };

    setPendingCommands(prev => {
      const next = new Map(prev);
      next.set(method, pending);
      return next;
    });

    try {
      // Send RPC
      await tbApi.sendRpc(project, gh, method, params);

      // Start confirmation polling if we have an attribute to check
      if (expectedAttribute) {
        startConfirmPolling(pending);
      } else {
        // No confirmation mapping - just remove from pending after a short delay
        setTimeout(() => {
          setPendingCommands(prev => {
            const next = new Map(prev);
            next.delete(method);
            return next;
          });
          onSuccess?.(method);
        }, 1000);
      }

      return true;
    } catch (err) {
      // Remove from pending
      setPendingCommands(prev => {
        const next = new Map(prev);
        next.delete(method);
        return next;
      });

      const errorMessage = err instanceof Error ? err.message : 'RPC failed';
      onError?.(method, errorMessage);
      return false;
    }
  }, [project, gh, startConfirmPolling, onSuccess, onError]);

  const isPending = useCallback((method: string): boolean => {
    return pendingCommands.has(method);
  }, [pendingCommands]);

  const isAnyPending = pendingCommands.size > 0;
  const pendingMethods = Array.from(pendingCommands.keys());

  return {
    sendCommand,
    isPending,
    isAnyPending,
    pendingMethods,
  };
}

/**
 * useMotorRpc Hook
 * Special hook for motor commands that need different confirmation logic
 */
export function useMotorRpc({
  project,
  gh,
  onSuccess,
  onTimeout,
  onError,
}: UseRpcOptions) {
  const [pendingMotors, setPendingMotors] = useState<Set<string>>(new Set());
  const pollRefs = useRef<Map<string, { interval: NodeJS.Timeout; timeout: NodeJS.Timeout }>>(new Map());

  const sendMotorCommand = useCallback(async (
    motorKey: string,
    method: string,
    params: number // 0=stop, 1=forward, 2=reverse
  ): Promise<boolean> => {
    // Clear existing polling for this motor
    const existing = pollRefs.current.get(motorKey);
    if (existing) {
      clearInterval(existing.interval);
      clearTimeout(existing.timeout);
    }

    // Mark as pending
    setPendingMotors(prev => new Set(prev).add(motorKey));

    // Determine expected state
    const fwKey = `${motorKey}_fw`;
    const reKey = `${motorKey}_re`;
    
    let expectedFw = false;
    let expectedRe = false;
    
    if (params === 1) { // Forward/Down
      expectedFw = true;
      expectedRe = false;
    } else if (params === 2) { // Reverse/Up
      expectedFw = false;
      expectedRe = true;
    }
    // params === 0: both false (stop)

    try {
      await tbApi.sendRpc(project, gh, method, params);

      // Start confirmation polling
      const checkConfirmation = async () => {
        try {
          const attrs = await tbApi.getAttributes(project, gh, [fwKey, reKey]);
          const currentFw = normalizeBoolean(attrs[fwKey]);
          const currentRe = normalizeBoolean(attrs[reKey]);

          if (currentFw === expectedFw && currentRe === expectedRe) {
            // Confirmed!
            const refs = pollRefs.current.get(motorKey);
            if (refs) {
              clearInterval(refs.interval);
              clearTimeout(refs.timeout);
              pollRefs.current.delete(motorKey);
            }
            
            setPendingMotors(prev => {
              const next = new Set(prev);
              next.delete(motorKey);
              return next;
            });
            
            onSuccess?.(method);
            return true;
          }
        } catch (err) {
          console.error('Motor confirmation poll error:', err);
        }
        return false;
      };

      // Initial check
      checkConfirmation();

      // Burst polling
      const interval = setInterval(checkConfirmation, POLLING_INTERVALS.BURST_CONFIRM);
      
      const timeout = setTimeout(() => {
        clearInterval(interval);
        pollRefs.current.delete(motorKey);
        
        setPendingMotors(prev => {
          const next = new Set(prev);
          next.delete(motorKey);
          return next;
        });
        
        onTimeout?.(method);
      }, POLLING_INTERVALS.BURST_DURATION);

      pollRefs.current.set(motorKey, { interval, timeout });

      return true;
    } catch (err) {
      setPendingMotors(prev => {
        const next = new Set(prev);
        next.delete(motorKey);
        return next;
      });

      const errorMessage = err instanceof Error ? err.message : 'Motor RPC failed';
      onError?.(method, errorMessage);
      return false;
    }
  }, [project, gh, onSuccess, onTimeout, onError]);

  const isMotorPending = useCallback((motorKey: string): boolean => {
    return pendingMotors.has(motorKey);
  }, [pendingMotors]);

  return {
    sendMotorCommand,
    isMotorPending,
    isAnyPending: pendingMotors.size > 0,
    pendingMotors: Array.from(pendingMotors),
  };
}
