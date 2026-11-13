import React, { forwardRef, useState } from 'react';
import { motion, type HTMLMotionProps, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { triggerHaptic } from '../../utils/audioAlert';

export type NeonButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'success'
  | 'outline'
  | 'ghost';

export type NeonButtonSize = 'sm' | 'md' | 'lg';

export interface NeonButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children?: React.ReactNode;
  variant?: NeonButtonVariant;
  size?: NeonButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  enableRipple?: boolean;
}

interface Ripple {
  x: number;
  y: number;
  id: number;
}

// Linear / Vercel high-trust design variants
const variantStyles: Record<NeonButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:opacity-95 text-white font-medium shadow-sm hover:shadow-bento border border-indigo-400/30',
  secondary:
    'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium border border-border shadow-sm',
  danger:
    'bg-rose-600 hover:bg-rose-500 text-white font-medium shadow-sm hover:shadow-bento border border-rose-500/30',
  success:
    'bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm hover:shadow-bento border border-emerald-500/30',
  outline:
    'bg-transparent hover:bg-muted text-foreground border border-border font-medium shadow-sm',
  ghost:
    'bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground font-medium border border-transparent',
};

const sizeStyles: Record<NeonButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'px-5 py-2.5 text-base rounded-xl gap-2.5',
};

export const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      enableRipple = true,
      onClick,
      ...motionProps
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;
    const [ripples, setRipples] = useState<Ripple[]>([]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isDisabled) return;

      if (enableRipple) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const newRipple: Ripple = { x, y, id: Date.now() };
        setRipples((prev) => [...prev, newRipple]);
        setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
        }, 500);
      }

      triggerHaptic('light');
      onClick?.(e);
    };

    return (
      <motion.button
        ref={ref}
        whileHover={isDisabled ? undefined : { y: -1 }}
        whileTap={isDisabled ? undefined : { scale: 0.98, y: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        disabled={isDisabled}
        onClick={handleClick}
        className={`relative inline-flex items-center justify-center select-none overflow-hidden transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...motionProps}
      >
        {/* Subtle button ripple effect */}
        <AnimatePresence>
          {ripples.map((r) => (
            <motion.span
              key={r.id}
              initial={{ scale: 0, opacity: 0.35 }}
              animate={{ scale: 3.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                left: r.x,
                top: r.y,
              }}
              className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20 pointer-events-none"
            />
          ))}
        </AnimatePresence>

        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}

        {children && <span>{children}</span>}

        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </motion.button>
    );
  }
);

NeonButton.displayName = 'NeonButton';
