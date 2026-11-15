import React, { useEffect, useCallback, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  bodyClassName?: string;
  closeOnBackdropClick?: boolean;
  showCloseButton?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-full',
};

let activeDrawerCount = 0;

export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  header,
  children,
  footer,
  size = 'md',
  className = '',
  bodyClassName = '',
  closeOnBackdropClick = true,
  showCloseButton = true,
}: DrawerProps) {
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Scroll lock
  useEffect(() => {
    if (!isOpen) return;

    activeDrawerCount++;
    if (activeDrawerCount === 1) {
      document.documentElement.style.scrollbarGutter = 'stable';
      document.body.style.overflow = 'hidden';
    }

    return () => {
      activeDrawerCount = Math.max(0, activeDrawerCount - 1);
      if (activeDrawerCount === 0) {
        document.body.style.overflow = '';
      }
    };
  }, [isOpen]);

  // Focus trap and return
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;

      const timer = setTimeout(() => {
        if (!drawerRef.current) return;
        const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length > 0) {
          focusables[0].focus();
        } else {
          drawerRef.current.focus();
        }
      }, 50);

      return () => clearTimeout(timer);
    } else if (triggerRef.current) {
      try {
        triggerRef.current.focus();
      } catch {
        // Ignore detached element errors
      }
      triggerRef.current = null;
    }
  }, [isOpen]);

  // Escape key & Tab trap
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = Array.from(
          drawerRef.current.querySelectorAll<HTMLElement>(
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
          if (document.activeElement === first || !drawerRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !drawerRef.current.contains(document.activeElement)) {
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
        <div role="presentation" className="fixed inset-0 z-60 overflow-hidden">
          {/* Glass Overlay Sibling Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeOnBackdropClick ? onClose : undefined}
            className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Right Slide Panel Container */}
          <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10">
            <motion.div
              ref={drawerRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              aria-describedby={description ? descId : undefined}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 350 }}
              className={`w-screen ${sizeClasses[size]} border-l border-border bg-surface dark:bg-[#0c0d14] text-foreground shadow-2xl flex flex-col outline-none z-10 ${className}`}
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
                      aria-label="Close drawer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : null}

              {/* Body */}
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
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
