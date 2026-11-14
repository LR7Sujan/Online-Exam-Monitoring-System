import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export interface OverlayPanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  showBackdrop?: boolean;
}

/**
 * Shared Popover / Dropdown / Overlay Panel Primitive
 * Guarantees:
 * - 100% solid surface background (no bleed-through)
 * - 1px border & 16px radius (rounded-2xl)
 * - Strong layered shadow (shadow-2xl)
 * - Strict z-50 elevation per design system z-index scale
 * - Subtle click-outside backdrop
 * - Escape key to dismiss
 * - Accessible keyboard focus trap
 * - Enter/exit animations with prefers-reduced-motion bypass
 */
export function OverlayPanel({
  isOpen,
  onClose,
  children,
  className = '',
  ariaLabel = 'Overlay panel',
  showBackdrop = true,
}: OverlayPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Escape key handler and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Subtle click-outside backdrop */}
          {showBackdrop && (
            <div
              onClick={onClose}
              className="fixed inset-0 z-40 bg-black/5 dark:bg-black/20 select-none cursor-default"
              aria-hidden="true"
            />
          )}

          {/* Solid Popover Container */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: -6 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }}
            className={`absolute rounded-2xl border border-border bg-surface dark:bg-[#12131d] text-foreground shadow-2xl z-50 ${className}`}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
