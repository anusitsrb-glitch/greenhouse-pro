import { useState, useCallback } from 'react';
import type { Toast, ToastType } from '@/types';
import { generateId } from '@/lib/utils';

type ToastInput =
  | { type: ToastType; message: string; duration?: number }
  | ToastType;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ตัวจริงสำหรับสร้าง toast
  const _addToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const toast: Toast = {
      id: generateId(),
      type,
      message,
      duration,
    };
    setToasts((prev) => [...prev, toast]);
    return toast.id;
  }, []);

  // ✅ รองรับทั้ง addToast('success','msg') และ addToast({type:'success', message:'msg'})
  const addToast = useCallback(
    (typeOrObj: ToastInput, message?: string, duration?: number) => {
      if (typeof typeOrObj === 'object') {
        return _addToast(typeOrObj.type, typeOrObj.message, typeOrObj.duration);
      }
      // แบบเดิม
      return _addToast(typeOrObj, message ?? '', duration);
    },
    [_addToast]
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (message: string, duration?: number) => addToast('success', message, duration),
    [addToast]
  );

  const error = useCallback(
    (message: string, duration?: number) => addToast('error', message, duration ?? 6000),
    [addToast]
  );

  const warning = useCallback(
    (message: string, duration?: number) => addToast('warning', message, duration),
    [addToast]
  );

  const info = useCallback(
    (message: string, duration?: number) => addToast('info', message, duration),
    [addToast]
  );

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
}
