import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rect' | 'circle' | 'text';
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({
  variant = 'rect',
  width,
  height,
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const baseClasses =
    'relative overflow-hidden bg-zinc-300/90 dark:bg-zinc-700/90 border border-border motion-safe:before:animate-shimmer motion-reduce:before:hidden before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/60 dark:before:via-white/25 before:to-transparent';

  const variantClasses = {
    rect: 'rounded-xl',
    circle: 'rounded-full',
    text: 'rounded-md h-4',
  }[variant];

  return (
    <div
      className={`${baseClasses} ${variantClasses} ${className}`}
      style={{
        width,
        height,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`p-5 rounded-[20px] border border-border bg-surface shadow-bento space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-1/3 h-4" />
        <Skeleton variant="circle" className="w-8 h-8" />
      </div>
      <Skeleton variant="rect" className="w-1/2 h-8" />
      <div className="pt-2 border-t border-border flex justify-between items-center">
        <Skeleton variant="text" className="w-1/4 h-3" />
        <Skeleton variant="rect" className="w-16 h-4" />
      </div>
    </div>
  );
}

export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={`h-3.5 ${
            i === lines - 1 ? 'w-2/3' : i % 2 === 0 ? 'w-full' : 'w-4/5'
          }`}
        />
      ))}
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  cols = 4,
  className = '',
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={`rounded-[20px] border border-border bg-surface overflow-hidden shadow-bento ${className}`}>
      <div className="p-4 bg-surface-elevated border-b border-border flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} variant="text" className="h-3 flex-1" />
        ))}
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 items-center">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} variant="text" className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl w-full mx-auto p-4 sm:p-6" aria-hidden="true">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="space-y-2">
          <Skeleton variant="text" className="w-48 h-6" />
          <Skeleton variant="text" className="w-72 h-3" />
        </div>
        <Skeleton variant="rect" className="w-28 h-9" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <SkeletonCard className="h-72" />
    </div>
  );
}
