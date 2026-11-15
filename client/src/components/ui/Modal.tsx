import React, { useEffect, useCallback, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnBackdropClick?: boolean;
  className?: string;
  bodyClassName?: string;
  showCloseButton?: boolean;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl sm:max-w-4xl',
  full: 'max-w-[95vw] h-[90vh]',
};

// Global reference counter for modal scroll lock across concurrent/nested overlays
let activeModalCount = 0;

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  header,
  children,
  footer,
  size = 'md',
  closeOnBackdropClick = true,
  className = '',
  bodyClassName = '',
  showCloseButton = true,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Scroll lock with reference counting
  useEffect(() => {
    if (!isOpen) return;

    activeModalCount++;
    if (activeModalCount === 1) {
      document.documentElement.style.scrollbarGutter = 'stable';
      document.body.style.overflow = 'hidden';
    }

    return () => {
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount === 0) {
        document.body.style.overflow = '';
      }
    };
  }, [isOpen]);

  // Focus capture and restoration
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;

      const timer = setTimeout(() => {
        if (!dialogRef.current) return;
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length > 0) {
          focusables[0].focus();
        } else {
          dialogRef.current.focus();
        }
      }, 50);

      return () => clearTimeout(timer);
    } else if (triggerRef.current) {
      try {
        triggerRef.current.focus();
      } catch {
        // Ignore detached element focus errors
      }
      triggerRef.current = null;
    }
  }, [isOpen]);

  // Keyboard navigation: Escape to dismiss, Tab key focus cycle
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-70 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 overflow-hidden"
        >
          {/* Sibling Glass Overlay Backdrop (Blur never wraps modal card) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeOnBackdropClick ? onClose : undefined}
            className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Modal Bento Container */}
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descId : undefined}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className={`relative w-full ${sizeClasses[size]} max-h-[92dvh] sm:max-h-[calc(100dvh-2rem)] rounded-t-3xl sm:rounded-2xl border border-border bg-surface dark:bg-[#111114] text-foreground shadow-2xl flex flex-col z-10 overflow-hidden outline-none ${className}`}
          >
            {/* Header */}
            {header ? (
              <div className="shrink-0">{header}</div>
            ) : (title || description) ? (
              <div className="flex items-start justify-between p-5 sm:p-6 border-b border-border bg-surface-elevated/40 shrink-0">
                <div className="space-y-1.5 pr-6">
                  {title && (
                    <div id={titleId} className="text-lg font-semibold text-foreground tracking-tight">
                      {title}
                    </div>
                  )}
                  {description && (
                    <p id={descId} className="text-xs text-muted-foreground leading-relaxed">
                      {description}
                    </p>
                  )}
                </div>
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer shrink-0"
                    aria-label="Close modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : null}

            {/* Body: Internal scrolling while header and footer stay pinned */}
            <div className={`p-5 sm:p-6 overflow-y-auto flex-1 min-h-0 ${bodyClassName}`}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="p-4 px-5 sm:px-6 border-t border-border bg-surface-elevated/40 flex items-center justify-end gap-3 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
