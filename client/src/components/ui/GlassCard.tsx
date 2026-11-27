import React, { forwardRef, useState } from 'react';

export type GlassGlow = 'none' | 'cyan' | 'violet' | 'magenta' | 'emerald' | 'amber';
export type GlassVariant = 'card' | 'panel' | 'elevated' | 'overlay';

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
  cyan: 'border-sky-500/30 dark:border-sky-500/40 shadow-[0_0_24px_rgba(14,165,233,0.12)]',
  violet: 'border-accent/30 dark:border-accent/40 shadow-[0_0_24px_var(--accent-glow)]',
  magenta: 'border-rose-500/35 dark:border-rose-500/45 shadow-[0_0_24px_rgba(244,63,94,0.15)]',
  emerald: 'border-emerald-500/30 dark:border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.12)]',
  amber: 'border-amber-500/30 dark:border-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.12)]',
};

const hoverGlowClasses: Record<GlassGlow, string> = {
  none: 'hover:border-border-strong',
  cyan: 'hover:border-sky-400 dark:hover:border-sky-400/60 hover:shadow-[0_0_28px_rgba(14,165,233,0.2)]',
  violet: 'hover:border-accent/60 dark:hover:border-accent/70 hover:shadow-[0_0_28px_var(--accent-glow)]',
  magenta: 'hover:border-rose-400 dark:hover:border-rose-400/60 hover:shadow-[0_0_28px_rgba(244,63,94,0.22)]',
  emerald: 'hover:border-emerald-400 dark:hover:border-emerald-400/60 hover:shadow-[0_0_28px_rgba(16,185,129,0.2)]',
  amber: 'hover:border-amber-400 dark:hover:border-amber-400/60 hover:shadow-[0_0_28px_rgba(245,158,11,0.2)]',
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

    // Bento base surfaces: solid hairline border, soft layered shadow, 20px radius
    const baseVariant =
      variant === 'overlay'
        ? 'rounded-[20px] border border-border bg-surface/80 backdrop-blur-xl text-foreground shadow-bento-xl'
        : variant === 'panel'
        ? 'rounded-[20px] border border-border bg-surface-elevated text-foreground shadow-bento-sm'
        : variant === 'elevated'
        ? 'rounded-[20px] border border-border bg-surface-elevated text-foreground shadow-bento'
        : 'rounded-[20px] border border-border bg-surface text-foreground shadow-bento';

    const glowClass = hoverEffect ? hoverGlowClasses[glow] : glowClasses[glow];
    const gradClass =
      gradientBorder === 'cyan'
        ? 'animated-gradient-border'
        : gradientBorder === 'magenta'
        ? 'border-rose-500/50 dark:border-rose-500/50 shadow-[0_0_24px_rgba(244,63,94,0.18)]'
        : '';
    const liftClass =
      hoverLift && hoverEffect
        ? 'transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-bento-xl'
        : 'transition-all duration-200';
    const animBorderClass = animatedBorder ? 'animated-gradient-border' : '';

    return (
      <div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`${baseVariant} ${liftClass} relative overflow-hidden ${glowClass} ${gradClass} ${animBorderClass} ${className}`}
        {...rest}
      >
        {/* Subtle Ambient Cursor Follow Spotlight */}
        {cursorGlow && mousePos && (
          <div
            className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-100"
            style={{
              background: `radial-gradient(350px circle at ${mousePos.x}px ${mousePos.y}px, rgba(99, 102, 241, 0.08), transparent 60%)`,
            }}
            aria-hidden="true"
          />
        )}

        <div className="relative z-10">{children}</div>
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';
