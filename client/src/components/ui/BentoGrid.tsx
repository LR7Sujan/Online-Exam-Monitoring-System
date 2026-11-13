import React, { forwardRef, useState } from 'react';

export interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function BentoGrid({ children, className = '', ...props }: BentoGridProps) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | string;
  className?: string;
  hoverSpotlight?: boolean;
  hoverLift?: boolean;
}

const colSpanClasses: Record<number, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  5: 'md:col-span-5',
  6: 'md:col-span-6',
  7: 'md:col-span-7',
  8: 'md:col-span-8',
  9: 'md:col-span-9',
  10: 'md:col-span-10',
  11: 'md:col-span-11',
  12: 'md:col-span-12',
};

export const BentoCard = forwardRef<HTMLDivElement, BentoCardProps>(
  (
    {
      children,
      colSpan = 12,
      className = '',
      hoverSpotlight = true,
      hoverLift = true,
      onMouseMove,
      onMouseLeave,
      ...props
    },
    ref
  ) => {
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (hoverSpotlight) {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
      onMouseMove?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      if (hoverSpotlight) {
        setMousePos(null);
      }
      onMouseLeave?.(e);
    };

    const spanClass =
      typeof colSpan === 'number'
        ? `col-span-12 ${colSpanClasses[colSpan] ?? 'md:col-span-12'}`
        : colSpan;

    const liftClass = hoverLift
      ? 'hover:-translate-y-0.5 hover:shadow-bento-xl transition-all duration-300'
      : 'transition-all duration-200';

    return (
      <div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`relative overflow-hidden rounded-[20px] border border-border bg-surface text-foreground shadow-bento ${spanClass} ${liftClass} ${className}`}
        {...props}
      >
        {/* Cursor-follow spotlight */}
        {hoverSpotlight && mousePos && (
          <div
            className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-100"
            style={{
              background: `radial-gradient(350px circle at ${mousePos.x}px ${mousePos.y}px, rgba(99, 102, 241, 0.08), transparent 60%)`,
            }}
            aria-hidden="true"
          />
        )}

        <div className="relative z-10 h-full">{children}</div>
      </div>
    );
  }
);

BentoCard.displayName = 'BentoCard';
