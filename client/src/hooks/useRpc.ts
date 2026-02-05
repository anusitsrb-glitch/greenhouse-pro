/**
 * useRpc Hook - FINAL LIGHT CONFIRM VERSION
 * - ลด request: confirm แบบ 2 ครั้งด้วย setTimeout (ไม่มี setInterval)
 * - timer แยกต่อ method / motorKey กันชนกัน
 * - compare ปลอดภัย (ไม่ normalize string เวลา)
 * - TTL แยก รีเลย์/มอเตอร์
 * - กัน setState หลัง unmount
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { tbApi } from '@/lib/tbApi';
import { RPC_CONFIRM_MAP } from '@/config/dataKeys';

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

const CONFIRM_DELAYS_MS = [1200, 2800]; // เช็ค 2 ครั้งพอ
const RELAY_TTL_MS = 8000;              // กันค้างสำหรับรีเลย์/auto/time
const MOTOR_TTL_MS = 12000;             // มอเตอร์เผื่อหน่วง

// ✅ เปลี่ยนค่าทั้งสองฝั่งให้ "เทียบกันได้" แบบปลอดภัย
function toComparable(v: any): string | boolean {
  if (v === true || v === false) return v;

  // รองรับ 1/0 และ "1"/"0"
  if (v === 1 || v === 0) return Boolean(v);
  if (v === '1' || v === '0') return v === '1';

  // ส่วนอื่น ๆ เทียบเป็น string (เช่น "07:00", "18:00", "Online")
  return String(v);
}

export function useRpc({ project, gh, onSuccess, onTimeout, onError }: UseRpcOptions): UseRpcResult {
  const [pendingCommands, setPendingCommands] = useState<Map<string, PendingCommand>>(new Map());

  // timers per method
  const timersRef = useRef<Map<string, number[]>>(new Map());

  // ✅ กัน setState หลัง unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearTimers = useCallback((method: string) => {
    const timers = timersRef.current.get(method);
    if (timers) {
      timers.forEach((id) => window.clearTimeout(id));
      timersRef.current.delete(method);
    }
  }, []);

  useEffect(() => {
    return () => {
      // cleanup all timers on unmount
      for (const [method, timers] of timersRef.current.entries()) {
        timers.forEach((id) => window.clearTimeout(id));
        timersRef.current.delete(method);
      }
    };
  }, []);

  const markDone = useCallback((method: string) => {
    clearTimers(method);
    if (!mountedRef.current) return;

    setPendingCommands((prev) => {
      if (!prev.has(method)) return prev;
      const next = new Map(prev);
      next.delete(method);
      return next;
    });
  }, [clearTimers]);

  const confirmOnce = useCallback(async (pending: PendingCommand) => {
    try {
      const attrs = await tbApi.getAttributes(project, gh, [pending.expectedAttribute]);
      const currentValue = attrs[pending.expectedAttribute];

      return toComparable(currentValue) === toComparable(pending.expectedValue);
    } catch {
      return false;
    }
  }, [project, gh]);

  const scheduleConfirm = useCallback((pending: PendingCommand) => {
    clearTimers(pending.method);

    const ids: number[] = [];

    for (const delay of CONFIRM_DELAYS_MS) {
      const id = window.setTimeout(async () => {
        const ok = await confirmOnce(pending);
        if (!ok) return;

        if (!mountedRef.current) return;

        // remove pending only if it still exists
        let removed = false;
        setPendingCommands((prev) => {
          if (!prev.has(pending.method)) return prev;
          const next = new Map(prev);
          next.delete(pending.method);
          removed = true;
          return next;
        });

        if (removed) {
          clearTimers(pending.method);
          onSuccess?.(pending.method);
        }
      }, delay);

      ids.push(id);
    }

    // TTL กันค้าง (รีเลย์)
    const ttlId = window.setTimeout(() => {
      if (!mountedRef.current) return;

      let timedOut = false;
      setPendingCommands((prev) => {
        if (!prev.has(pending.method)) return prev;
        const next = new Map(prev);
        next.delete(pending.method);
        timedOut = true;
        return next;
      });

      clearTimers(pending.method);
      if (timedOut) onTimeout?.(pending.method);
    }, RELAY_TTL_MS);

    ids.push(ttlId);
    timersRef.current.set(pending.method, ids);
  }, [clearTimers, confirmOnce, onSuccess, onTimeout]);

  const sendCommand = useCallback(async (
    method: string,
    params: unknown,
    expectedValue?: unknown
  ): Promise<boolean> => {
    const expectedAttribute = RPC_CONFIRM_MAP[method];

    // default expected: 1/true (แต่ถ้า caller ส่ง expectedValue มา ก็ใช้ตามนั้น)
    const finalExpectedValue =
      expectedValue ??
      (params === 1 || params === '1' || params === true);

    const pending: PendingCommand = {
      method,
      expectedAttribute: expectedAttribute || '',
      expectedValue: finalExpectedValue,
      startedAt: Date.now(),
    };

    // mark pending
    if (mountedRef.current) {
      setPendingCommands((prev) => {
        const next = new Map(prev);
        next.set(method, pending);
        return next;
      });
    }

    try {
      // ✅ ไม่ต้องส่ง timeout ตายตัว (backend เลือก one-way ให้ตาม method)
      await tbApi.sendRpc(project, gh, method, params);

      if (expectedAttribute) {
        scheduleConfirm({ ...pending, expectedAttribute });
      } else {
        // ไม่มี mapping: เคลียร์เองแบบเร็วๆ
        window.setTimeout(() => {
          markDone(method);
          if (mountedRef.current) onSuccess?.(method);
        }, 800);
      }

      return true;
    } catch (err) {
      markDone(method);
      const msg = err instanceof Error ? err.message : 'RPC failed';
      if (mountedRef.current) onError?.(method, msg);
      return false;
    }
  }, [project, gh, scheduleConfirm, markDone, onSuccess, onError]);

  const isPending = useCallback((method: string) => pendingCommands.has(method), [pendingCommands]);

  return {
    sendCommand,
    isPending,
    isAnyPending: pendingCommands.size > 0,
    pendingMethods: Array.from(pendingCommands.keys()),
  };
}

/**
 * useMotorRpc - FINAL LIGHT CONFIRM VERSION
 * - confirm 2 ครั้ง (ไม่มี interval)
 * - timer แยกต่อ motorKey
 * - TTL มอเตอร์นานกว่า
 * - กัน setState หลัง unmount
 */
export function useMotorRpc({ project, gh, onSuccess, onTimeout, onError }: UseRpcOptions) {
  const [pendingMotors, setPendingMotors] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, number[]>>(new Map());

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearTimers = useCallback((motorKey: string) => {
    const timers = timersRef.current.get(motorKey);
    if (timers) {
      timers.forEach((id) => window.clearTimeout(id));
      timersRef.current.delete(motorKey);
    }
  }, []);

  useEffect(() => {
    return () => {
      for (const [k, timers] of timersRef.current.entries()) {
        timers.forEach((id) => window.clearTimeout(id));
        timersRef.current.delete(k);
      }
    };
  }, []);

  const sendMotorCommand = useCallback(async (
    motorKey: string,
    method: string,
    params: number // 0=stop, 1=forward, 2=reverse
  ): Promise<boolean> => {
    clearTimers(motorKey);

    if (mountedRef.current) {
      setPendingMotors((prev) => new Set(prev).add(motorKey));
    }

    const fwKey = `${motorKey}_fw`;
    const reKey = `${motorKey}_re`;

    const expectedFw = params === 1;
    const expectedRe = params === 2;

    try {
      await tbApi.sendRpc(project, gh, method, params);

      const ids: number[] = [];

      const confirm = async () => {
        try {
          const attrs = await tbApi.getAttributes(project, gh, [fwKey, reKey]);
          const currentFw = toComparable(attrs[fwKey]) === true;
          const currentRe = toComparable(attrs[reKey]) === true;

          return currentFw === expectedFw && currentRe === expectedRe;
        } catch {
          return false;
        }
      };

      for (const delay of CONFIRM_DELAYS_MS) {
        const id = window.setTimeout(async () => {
          const ok = await confirm();
          if (!ok) return;

          clearTimers(motorKey);

          if (!mountedRef.current) return;

          setPendingMotors((prev) => {
            const next = new Set(prev);
            next.delete(motorKey);
            return next;
          });

          onSuccess?.(method);
        }, delay);

        ids.push(id);
      }

      const ttlId = window.setTimeout(() => {
        clearTimers(motorKey);

        if (!mountedRef.current) return;

        setPendingMotors((prev) => {
          const next = new Set(prev);
          next.delete(motorKey);
          return next;
        });

        onTimeout?.(method);
      }, MOTOR_TTL_MS);

      ids.push(ttlId);
      timersRef.current.set(motorKey, ids);

      return true;
    } catch (err) {
      clearTimers(motorKey);

      if (mountedRef.current) {
        setPendingMotors((prev) => {
          const next = new Set(prev);
          next.delete(motorKey);
          return next;
        });
      }

      const msg = err instanceof Error ? err.message : 'Motor RPC failed';
      if (mountedRef.current) onError?.(method, msg);
      return false;
    }
  }, [project, gh, clearTimers, onSuccess, onTimeout, onError]);

  const isMotorPending = useCallback((motorKey: string): boolean => pendingMotors.has(motorKey), [pendingMotors]);

  return {
    sendMotorCommand,
    isMotorPending,
    isAnyPending: pendingMotors.size > 0,
    pendingMotors: Array.from(pendingMotors),
  };
}
