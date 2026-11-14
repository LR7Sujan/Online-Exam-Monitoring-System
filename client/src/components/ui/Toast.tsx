import React, { useCallback, useMemo } from 'react';
import { Toaster, toast as sonnerToast } from 'sonner';
import {
  ToastContext,
  type ToastItem,
  type ToastOptions,
  type ToastVariant,
  type ToastContextValue,
} from './ToastContext';
import { useTheme } from '../../context/ThemeContext';

export type { ToastOptions, ToastVariant, ToastItem };
// eslint-disable-next-line react-refresh/only-export-components
export { sonnerToast as toast };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();

  const toast = useCallback(
    ({ title, description, variant = 'info', duration = 4000 }: ToastOptions): string => {
      let id: string | number;
      switch (variant) {
        case 'success':
          id = sonnerToast.success(title, { description, duration });
          break;
        case 'error':
          id = sonnerToast.error(title, { description, duration });
          break;
        case 'warning':
          id = sonnerToast.warning(title, { description, duration });
          break;
        case 'info':
        default:
          id = sonnerToast.info(title, { description, duration });
          break;
      }
      return String(id);
    },
    []
  );

  const success = useCallback(
    (title: string, description?: string) =>
      toast({ title, description, variant: 'success' }),
    [toast]
  );

  const error = useCallback(
    (title: string, description?: string) =>
      toast({ title, description, variant: 'error' }),
    [toast]
  );

  const warning = useCallback(
    (title: string, description?: string) =>
      toast({ title, description, variant: 'warning' }),
    [toast]
  );

  const info = useCallback(
    (title: string, description?: string) =>
      toast({ title, description, variant: 'info' }),
    [toast]
  );

  const dismiss = useCallback((id: string) => {
    sonnerToast.dismiss(id);
  }, []);

  const value: ToastContextValue = useMemo(
    () => ({
      toast,
      success,
      error,
      warning,
      info,
      dismiss,
    }),
    [toast, success, error, warning, info, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster
        theme={resolvedTheme}
        position="bottom-right"
        closeButton
        richColors
        toastOptions={{
          style: {
            borderRadius: '16px',
            fontFamily: 'inherit',
            border: '1px solid var(--border)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            zIndex: 80,
          },
        }}
      />
    </ToastContext.Provider>
  );
}
