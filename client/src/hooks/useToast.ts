import { useState, useCallback } from 'react';
import type { Toast, ToastType } from '@/types';
import { generateId } from '@/lib/utils';

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const addToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const toast: Toast = {
      id: generateId(),
      type,
      message,
      duration,
    };
    setToasts(prev => [...prev, toast]);
    return toast.id;
  }, []);
  
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  
  const success = useCallback((message: string, duration?: number) => {
    return addToast('success', message, duration);
  }, [addToast]);
  
  const error = useCallback((message: string, duration?: number) => {
    return addToast('error', message, duration ?? 6000);
  }, [addToast]);
  
  const warning = useCallback((message: string, duration?: number) => {
    return addToast('warning', message, duration);
  }, [addToast]);
  
  const info = useCallback((message: string, duration?: number) => {
    return addToast('info', message, duration);
  }, [addToast]);
  
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
