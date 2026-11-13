export type LiveDotColor = 'emerald' | 'rose' | 'cyan' | 'amber' | 'gray' | 'violet';
export type LiveDotSize = 'sm' | 'md' | 'lg';

export interface LiveDotProps {
  color?: LiveDotColor;
  size?: LiveDotSize;
  pulse?: boolean;
  className?: string;
}

const colorMap: Record<LiveDotColor, { dot: string; ping: string; ring: string }> = {
  emerald: {
    dot: 'bg-emerald-500',
    ping: 'bg-emerald-400',
    ring: 'ring-2 ring-emerald-500/20',
  },
  rose: {
    dot: 'bg-rose-500',
    ping: 'bg-rose-400',
    ring: 'ring-2 ring-rose-500/20',
  },
  cyan: {
    dot: 'bg-sky-500',
    ping: 'bg-sky-400',
    ring: 'ring-2 ring-sky-500/20',
  },
  amber: {
    dot: 'bg-amber-500',
    ping: 'bg-amber-400',
    ring: 'ring-2 ring-amber-500/20',
  },
  violet: {
    dot: 'bg-violet-500',
    ping: 'bg-violet-400',
    ring: 'ring-2 ring-violet-500/20',
  },
  gray: {
    dot: 'bg-zinc-400',
    ping: 'bg-zinc-400',
    ring: 'ring-2 ring-zinc-400/20',
  },
};

const sizeMap: Record<LiveDotSize, { container: string; dot: string }> = {
  sm: {
    container: 'h-2 w-2',
    dot: 'h-2 w-2',
  },
  md: {
    container: 'h-2.5 w-2.5',
    dot: 'h-2.5 w-2.5',
  },
  lg: {
    container: 'h-3.5 w-3.5',
    dot: 'h-3.5 w-3.5',
  },
};

export function LiveDot({
  color = 'emerald',
  size = 'md',
  pulse = true,
  className = '',
}: LiveDotProps) {
  const c = colorMap[color] ?? colorMap.emerald;
  const s = sizeMap[size] ?? sizeMap.md;

  return (
    <span className={`relative inline-flex items-center justify-center shrink-0 ${s.container} ${className}`}>
      {pulse && (
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${c.ping}`}
        />
      )}
      <span className={`relative inline-flex rounded-full ${s.dot} ${c.dot} ${c.ring}`} />
    </span>
  );
}
