import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import {
  ToastContext,
  type ToastItem,
  type ToastOptions,
  type ToastVariant,
} from './ToastContext';

export type { ToastOptions, ToastVariant, ToastItem };

const variantStyles: Record<
  ToastVariant,
  {
    border: string;
    glow: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    progressBar: string;
  }
> = {
  info: {
    border: 'border-cyan/40 bg-[#101222]/95',
    glow: 'shadow-glow-cyan-sm',
    icon: Info,
    iconColor: 'text-cyan',
    progressBar: 'bg-cyan',
  },
  success: {
    border: 'border-emerald/40 bg-[#101222]/95',
    glow: 'shadow-glow-emerald-sm',
    icon: CheckCircle2,
    iconColor: 'text-emerald',
    progressBar: 'bg-emerald',
  },
  warning: {
    border: 'border-amber/40 bg-[#101222]/95',
    glow: 'shadow-glow-amber-sm',
    icon: AlertTriangle,
    iconColor: 'text-amber',
    progressBar: 'bg-amber',
  },
  error: {
    border: 'border-magenta/50 bg-[#101222]/95',
    glow: 'shadow-glow-magenta-sm',
    icon: AlertCircle,
    iconColor: 'text-magenta',
    progressBar: 'bg-magenta',
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = 'info', duration = 4500 }: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newToast: ToastItem = { id, title, description, variant, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }

      return id;
    },
    [dismiss]
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

  const contextValue = useMemo(
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
    <ToastContext.Provider value={contextValue}>
      {children}
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
        aria-live="polite"
      >
        <AnimatePresence mode="sync">
          {toasts.map((t) => {
            const config = variantStyles[t.variant ?? 'info'];
            const Icon = config.icon;
            const durationSec = (t.duration ?? 4500) / 1000;

            return (
              <motion.div
                key={t.id}
                layout
                role="status"
                aria-live="polite"
                initial={{ opacity: 0, x: 50, y: 12, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 480, damping: 24, mass: 0.85 }}
                className={`pointer-events-auto relative overflow-hidden rounded-xl border p-4 backdrop-blur-xl shadow-2xl ${config.border} ${config.glow}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />
                  <div className="flex-1 pr-2">
                    <h4 className="text-sm font-semibold text-white tracking-wide">
                      {t.title}
                    </h4>
                    {t.description && (
                      <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                        {t.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => dismiss(t.id)}
                    className="text-slate-400 hover:text-white p-1 rounded transition-colors"
                    aria-label="Close notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {t.duration && t.duration > 0 && (
                  <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: durationSec, ease: 'linear' }}
                    className={`absolute bottom-0 left-0 h-0.5 ${config.progressBar} opacity-70`}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
