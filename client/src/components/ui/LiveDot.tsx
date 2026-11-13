export type LiveDotColor = 'emerald' | 'rose' | 'cyan' | 'amber' | 'gray' | 'violet';
export type LiveDotSize = 'sm' | 'md' | 'lg';

export interface LiveDotProps {
  color?: LiveDotColor;
  size?: LiveDotSize;
  pulse?: boolean;
  className?: string;
}

const colorMap: Record<LiveDotColor, { dot: string; ping: string; glow: string }> = {
  emerald: {
    dot: 'bg-emerald-400',
    ping: 'bg-emerald-400',
    glow: 'shadow-[0_0_8px_rgba(16,185,129,0.8)]',
  },
  rose: {
    dot: 'bg-magenta',
    ping: 'bg-magenta',
    glow: 'shadow-[0_0_8px_rgba(244,63,94,0.8)]',
  },
  cyan: {
    dot: 'bg-cyan',
    ping: 'bg-cyan',
    glow: 'shadow-[0_0_8px_rgba(34,211,238,0.8)]',
  },
  amber: {
    dot: 'bg-amber-400',
    ping: 'bg-amber-400',
    glow: 'shadow-[0_0_8px_rgba(245,158,11,0.8)]',
  },
  violet: {
    dot: 'bg-violet',
    ping: 'bg-violet',
    glow: 'shadow-[0_0_8px_rgba(139,92,246,0.8)]',
  },
  gray: {
    dot: 'bg-slate-400',
    ping: 'bg-slate-400',
    glow: 'shadow-[0_0_8px_rgba(148,163,184,0.4)]',
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
  const c = colorMap[color];
  const s = sizeMap[size];

  return (
    <span className={`relative inline-flex items-center justify-center ${s.container} ${className}`}>
      {pulse && (
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${c.ping}`}
        />
      )}
      <span className={`relative inline-flex rounded-full ${s.dot} ${c.dot} ${c.glow}`} />
    </span>
  );
}

