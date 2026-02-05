import { useState } from 'react';
import { tbApi } from '@/lib/tbApi';

function isSoftFail(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return /timeout|timed out|ETIMEDOUT|504|502|Bad Gateway/i.test(msg);
}

export function useThingsBoardRPC(deviceId: string, method: string, opts?: { timeoutMs?: number }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCommand = async (params: any) => {
    if (!method) return;

    setIsPending(true);
    setError(null);

    try {
      // ✅ opts.timeoutMs ถ้าส่งมา = two-way
      // ✅ ถ้าไม่ส่ง = one-way
      await tbApi.sendRPCCommand(deviceId, method, params, opts?.timeoutMs);
    } catch (err) {
      if (isSoftFail(err)) return;
      const m = err instanceof Error ? err.message : 'Failed to send command';
      setError(m);
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  return { sendCommand, isPending, error };
}
