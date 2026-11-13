import React, { forwardRef, useState } from 'react';

export type GlassGlow = 'none' | 'cyan' | 'violet' | 'magenta' | 'emerald' | 'amber';
export type GlassVariant = 'card' | 'panel' | 'elevated';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  glow?: GlassGlow;
  variant?: GlassVariant;
  hoverEffect?: boolean;
  hoverLift?: boolean;
  cursorGlow?: boolean;
  gradientBorder?: 'cyan' | 'magenta' | 'none';
  animatedBorder?: boolean;
}

const glowClasses: Record<GlassGlow, string> = {
  none: '',
  cyan: 'border-cyan-500/30 shadow-glow-cyan',
  violet: 'border-violet-500/30 shadow-glow-violet',
  magenta: 'border-magenta-500/40 shadow-glow-magenta',
  emerald: 'border-emerald-500/30 shadow-glow-emerald',
  amber: 'border-amber-500/30 shadow-glow-amber',
};

const hoverGlowClasses: Record<GlassGlow, string> = {
  none: 'hover:border-white/20',
  cyan: 'hover:border-cyan-400/40 hover:shadow-glow-cyan',
  violet: 'hover:border-violet-400/40 hover:shadow-glow-violet',
  magenta: 'hover:border-magenta-400/50 hover:shadow-glow-magenta',
  emerald: 'hover:border-emerald-400/40 hover:shadow-glow-emerald',
  amber: 'hover:border-amber-400/40 hover:shadow-glow-amber',
};

const variantClasses: Record<GlassVariant, string> = {
  card: 'glass-card',
  panel: 'glass-panel',
  elevated: 'glass-elevated',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      className = '',
      glow = 'none',
      variant = 'card',
      hoverEffect = false,
      hoverLift = true,
      cursorGlow = true,
      gradientBorder = 'none',
      animatedBorder = false,
      onMouseMove,
      onMouseLeave,
      ...rest
    },
    ref
  ) => {
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (cursorGlow) {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
      onMouseMove?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      if (cursorGlow) {
        setMousePos(null);
      }
      onMouseLeave?.(e);
    };

    const baseVariant = variantClasses[variant];
    const glowClass = hoverEffect ? hoverGlowClasses[glow] : glowClasses[glow];
    const gradClass =
      gradientBorder === 'cyan'
        ? 'gradient-border-cyan'
        : gradientBorder === 'magenta'
        ? 'gradient-border-magenta'
        : '';
    const liftClass = hoverLift ? 'transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl' : 'transition-all duration-300';
    const animBorderClass = animatedBorder ? 'animated-gradient-border' : '';

    return (
      <div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`${baseVariant} ${liftClass} relative overflow-hidden ${glowClass} ${gradClass} ${animBorderClass} ${className}`}
        {...rest}
      >
        {/* Interactive Cursor-Follow Glow Spotlight */}
        {cursorGlow && mousePos && (
          <div
            className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-0"
            style={{
              background: `radial-gradient(380px circle at ${mousePos.x}px ${mousePos.y}px, rgba(34, 211, 238, 0.12), transparent 75%)`,
            }}
            aria-hidden="true"
          />
        )}

        <div className="relative z-10 w-full h-full">
          {children}
        </div>
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';
