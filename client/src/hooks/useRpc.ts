/**
 * useRpc Hook - SIMPLE VERSION
 * - sendCommand return ทันทีหลัง HTTP สำเร็จ ไม่รอ confirm polling
 * - ไม่มี confirm polling → ไม่มี UI เด้ง
 * - polling 5 วินาทีใน useAttributes จัดการ sync สถานะจริงเอง
 * - กัน setState หลัง unmount
 */

import { useCallback, useRef, useEffect } from 'react';
import { tbApi } from '@/lib/tbApi';

interface UseRpcOptions {
  project: string;
  gh: string;
  onSuccess?: (method: string) => void;
  onError?: (method: string, error: string) => void;
}

interface UseRpcResult {
  sendCommand: (method: string, params: unknown, expectedValue?: unknown) => Promise<boolean>;
  isPending: (method: string) => boolean;
  isAnyPending: boolean;
  pendingMethods: string[];
}

export function useRpc({ project, gh, onSuccess, onError }: UseRpcOptions): UseRpcResult {
  const mountedRef = useRef(true);
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const sendCommand = useCallback(async (
    method: string,
    params: unknown,
    _expectedValue?: unknown  // ไม่ใช้แล้ว แต่คง interface เดิมไว้ไม่ให้ TypeScript error
  ): Promise<boolean> => {
    pendingRef.current.add(method);
    try {
      await tbApi.sendRpc(project, gh, method, params);
      if (mountedRef.current) onSuccess?.(method);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'RPC failed';
      if (mountedRef.current) onError?.(method, msg);
      return false;
    } finally {
      pendingRef.current.delete(method);
    }
  }, [project, gh, onSuccess, onError]);

  const isPending = useCallback((method: string) => pendingRef.current.has(method), []);

  return {
    sendCommand,
    isPending,
    isAnyPending: pendingRef.current.size > 0,
    pendingMethods: Array.from(pendingRef.current),
  };
}

/**
 * useMotorRpc - SIMPLE VERSION
 * - sendMotorCommand return ทันทีหลัง HTTP สำเร็จ
 * - ไม่มี confirm polling
 * - กัน setState หลัง unmount
 */
export function useMotorRpc({ project, gh, onSuccess, onError }: UseRpcOptions) {
  const mountedRef = useRef(true);
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const sendMotorCommand = useCallback(async (
    motorKey: string,
    method: string,
    params: number
  ): Promise<boolean> => {
    pendingRef.current.add(motorKey);
    try {
      await tbApi.sendRpc(project, gh, method, params);
      if (mountedRef.current) onSuccess?.(method);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Motor RPC failed';
      if (mountedRef.current) onError?.(method, msg);
      return false;
    } finally {
      pendingRef.current.delete(motorKey);
    }
  }, [project, gh, onSuccess, onError]);

  const isMotorPending = useCallback((motorKey: string) => pendingRef.current.has(motorKey), []);

  return {
    sendMotorCommand,
    isMotorPending,
    isAnyPending: pendingRef.current.size > 0,
    pendingMotors: Array.from(pendingRef.current),
  };
}