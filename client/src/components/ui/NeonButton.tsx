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

const variantStyles: Record<NeonButtonVariant, string> = {
  primary:
    'bg-cyan text-void font-semibold shadow-glow-cyan hover:bg-cyan-300 hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] border border-cyan-300/60',
  secondary:
    'bg-violet text-white font-semibold shadow-glow-violet hover:bg-violet-400 hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] border border-violet-400/50',
  danger:
    'bg-magenta text-white font-semibold shadow-glow-magenta hover:bg-magenta-400 hover:shadow-[0_0_32px_rgba(244,63,94,0.6)] border border-magenta-400/50',
  success:
    'bg-emerald text-void font-semibold shadow-glow-emerald hover:bg-emerald-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] border border-emerald-300/60',
  outline:
    'bg-panel/60 text-cyan border border-cyan/40 hover:bg-cyan/10 hover:border-cyan hover:shadow-glow-cyan font-medium',
  ghost:
    'bg-transparent text-slate-300 hover:text-white hover:bg-white/5 border border-transparent font-medium',
};

const sizeStyles: Record<NeonButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2.5',
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
        }, 600);
      }

      triggerHaptic('light');
      onClick?.(e);
    };

    return (
      <motion.button
        ref={ref}
        whileHover={isDisabled ? undefined : { scale: 1.02 }}
        whileTap={isDisabled ? undefined : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
        disabled={isDisabled}
        onClick={handleClick}
        className={`inline-flex items-center justify-center select-none transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none relative overflow-hidden focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-[#070810] focus-visible:outline-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...motionProps}
      >
        {/* Dynamic Click Ripple Effect */}
        <AnimatePresence>
          {ripples.map((ripple) => (
            <motion.span
              key={ripple.id}
              initial={{ scale: 0, opacity: 0.45 }}
              animate={{ scale: 3, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                top: ripple.y,
                left: ripple.x,
                width: 40,
                height: 40,
                marginLeft: -20,
                marginTop: -20,
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 255, 255, 0.4)',
                pointerEvents: 'none',
              }}
            />
          ))}
        </AnimatePresence>

        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon && <span className="flex-shrink-0 z-10">{leftIcon}</span>
        )}
        <span className="z-10">{children}</span>
        {!isLoading && rightIcon && (
          <span className="flex-shrink-0 z-10">{rightIcon}</span>
        )}
      </motion.button>
    );
  }
);

NeonButton.displayName = 'NeonButton';
