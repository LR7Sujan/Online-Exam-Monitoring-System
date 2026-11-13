import React, { useEffect, useState } from 'react';
import { useSpring, useTransform } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  change?: number; // e.g. +12.5 or -4.2
  changeLabel?: string;
  icon?: React.ReactNode;
  sparklineData?: number[];
  accent?: 'cyan' | 'violet' | 'magenta' | 'emerald' | 'amber';
  className?: string;
}

const accentConfig: Record<
  'cyan' | 'violet' | 'magenta' | 'emerald' | 'amber',
  { stroke: string; fill: string; text: string; bg: string; border: string }
> = {
  cyan: {
    stroke: '#0EA5E9',
    fill: 'rgba(14, 165, 233, 0.15)',
    text: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    border: 'border-sky-200 dark:border-sky-800/80',
  },
  violet: {
    stroke: '#8B5CF6',
    fill: 'rgba(139, 92, 246, 0.15)',
    text: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    border: 'border-violet-200 dark:border-violet-800/80',
  },
  magenta: {
    stroke: '#F43F5E',
    fill: 'rgba(244, 63, 94, 0.15)',
    text: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-rose-200 dark:border-rose-800/80',
  },
  emerald: {
    stroke: '#10B981',
    fill: 'rgba(16, 185, 129, 0.15)',
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800/80',
  },
  amber: {
    stroke: '#F59E0B',
    fill: 'rgba(245, 158, 11, 0.15)',
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800/80',
  },
};

function Sparkline({
  data,
  stroke,
  fill,
}: {
  data: number[];
  stroke: string;
  fill: string;
}) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const width = 120;
  const height = 36;
  const padding = 4;

  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${width - padding},${height} L ${padding},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-28 h-9 overflow-visible shrink-0"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`grad-${stroke.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity="0.8" />
          <stop offset="100%" stopColor={fill} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad-${stroke.replace('#', '')})`} />
      <path
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AnimatedNumber({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const spring = useSpring(0, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) => {
    return `${prefix}${current.toFixed(decimals)}${suffix}`;
  });

  const [renderedText, setRenderedText] = useState(
    `${prefix}${value.toFixed(decimals)}${suffix}`
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    const unsubscribe = display.on('change', (latest) => {
      setRenderedText(latest);
    });
    return () => unsubscribe();
  }, [display]);

  return <span className="tabular-nums font-mono">{renderedText}</span>;
}

export function StatCard({
  label,
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  change,
  changeLabel = 'vs baseline',
  icon,
  sparklineData = [12, 18, 14, 26, 22, 34, 40],
  accent = 'cyan',
  className = '',
}: StatCardProps) {
  const cfg = accentConfig[accent] ?? accentConfig.cyan;

  return (
    <div
      className={`rounded-[20px] border border-border bg-surface text-foreground shadow-bento hover:shadow-bento-xl transition-all duration-300 p-5 flex flex-col justify-between ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase font-medium tracking-wider text-muted-foreground">
            {label}
          </p>
          <div className="text-3xl font-bold tracking-tight text-foreground">
            <AnimatedNumber
              value={value}
              decimals={decimals}
              prefix={prefix}
              suffix={suffix}
            />
          </div>
        </div>

        {icon && (
          <div
            className={`p-2.5 rounded-xl border ${cfg.border} ${cfg.bg} ${cfg.text} shadow-sm shrink-0`}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          {change !== undefined && (
            <span
              className={`inline-flex items-center gap-1 font-mono font-medium text-[11px] px-2 py-0.5 rounded-full border ${
                change > 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/80'
                  : change < 0
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/80'
                  : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              {change > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : change < 0 ? (
                <TrendingDown className="w-3 h-3" />
              ) : (
                <Minus className="w-3 h-3" />
              )}
              {change > 0 ? `+${change}%` : `${change}%`}
            </span>
          )}
          <span className="text-muted-foreground text-[11px] truncate">{changeLabel}</span>
        </div>

        {sparklineData && sparklineData.length > 1 && (
          <Sparkline
            data={sparklineData}
            stroke={cfg.stroke}
            fill={cfg.fill}
          />
        )}
      </div>
    </div>
  );
}
