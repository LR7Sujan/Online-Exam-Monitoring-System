import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  closeOnBackdropClick?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-full',
};

export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className = '',
  closeOnBackdropClick = true,
}: DrawerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-60 overflow-hidden">
          {/* Glass Overlay Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeOnBackdropClick ? onClose : undefined}
            className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Right Slide Panel */}
          <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 350 }}
              role="dialog"
              aria-modal="true"
              className={`w-screen ${sizeClasses[size]} border-l border-border bg-surface dark:bg-[#0c0d14] text-foreground shadow-2xl flex flex-col ${className}`}
            >
              {/* Header */}
              {(title || description) && (
                <div className="flex items-start justify-between p-6 border-b border-border bg-surface-elevated/40">
                  <div className="space-y-1.5 pr-6">
                    {title && (
                      <h3 className="text-lg font-semibold text-foreground tracking-tight">
                        {title}
                      </h3>
                    )}
                    {description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    aria-label="Close drawer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Body */}
              <div className="p-6 overflow-y-auto flex-1">{children}</div>

              {/* Footer */}
              {footer && (
                <div className="p-4 px-6 border-t border-border bg-surface-elevated/40 flex items-center justify-end gap-3">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
