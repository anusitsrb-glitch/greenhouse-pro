import { useCallback, useEffect, useRef, useState } from 'react';
import { tbApi } from '@/lib/tbApi';

type UseThingsBoardAttributesOptions = {
  /** Polling interval in ms. Set to 0 to disable polling. Default: 30000 */
  pollingMs?: number;
};

export function useThingsBoardAttributes(deviceId: string, options: UseThingsBoardAttributesOptions = {}) {
  const pollingMs = options.pollingMs ?? 30000;

  const [attributes, setAttributes] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true); // ใช้เฉพาะโหลดครั้งแรก
  const [error, setError] = useState<string | null>(null);

  const didLoadOnceRef = useRef(false);
  const reqIdRef = useRef(0);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!deviceId) return;

      const silent = opts?.silent ?? false;

      // ✅ โหลดครั้งแรกเท่านั้นที่โชว์ loading
      if (!silent && !didLoadOnceRef.current) setIsLoading(true);
      if (!silent) setError(null);

      const myReqId = ++reqIdRef.current;

      try {
        const data = await tbApi.getDeviceAttributes(deviceId);

        // ✅ กัน response เก่าทับใหม่
        if (myReqId !== reqIdRef.current) return;

        setAttributes(data);
        didLoadOnceRef.current = true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch attributes';
        console.error('[Attributes] Fetch failed:', errorMessage);

        // โหลดครั้งแรก fail ค่อยโชว์ error เด่น ๆ
        if (!silent) setError(errorMessage);
      } finally {
        // ✅ ปิด loading เฉพาะตอนโหลดครั้งแรก
        if (!silent && !didLoadOnceRef.current) setIsLoading(false);
        if (!silent && didLoadOnceRef.current) setIsLoading(false);
      }
    },
    [deviceId]
  );

  useEffect(() => {
    if (!deviceId) return;

    // โหลดครั้งแรก
    didLoadOnceRef.current = false;
    setIsLoading(true);
    refresh({ silent: false });

    if (pollingMs <= 0) return;
    const interval = setInterval(() => refresh({ silent: true }), pollingMs);
    return () => clearInterval(interval);
  }, [deviceId, pollingMs, refresh]);

  return {
    attributes,
    isLoading,
    error,
    // ✅ manual refresh หลัง save ให้ใช้แบบไม่ silent เพื่ออัปเดตไว
    refresh: () => refresh({ silent: false }),
    // ✅ เผื่ออยากเรียกแบบเงียบจากบางหน้า
    refreshSilent: () => refresh({ silent: true }),
  };
}
