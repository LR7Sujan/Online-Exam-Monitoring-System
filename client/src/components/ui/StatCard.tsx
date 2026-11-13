import React, { useEffect, useState } from 'react';
import { useSpring, useTransform } from 'framer-motion';
import { GlassCard } from './GlassCard';
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

const accentColors: Record<
  'cyan' | 'violet' | 'magenta' | 'emerald' | 'amber',
  { text: string; bg: string; stroke: string; fill: string; border: string; glow: 'cyan' | 'violet' | 'magenta' | 'emerald' | 'amber' }
> = {
  cyan: {
    text: 'text-cyan',
    bg: 'bg-cyan/10',
    stroke: '#22D3EE',
    fill: 'rgba(34, 211, 238, 0.15)',
    border: 'border-cyan/30',
    glow: 'cyan',
  },
  violet: {
    text: 'text-violet',
    bg: 'bg-violet/10',
    stroke: '#8B5CF6',
    fill: 'rgba(139, 92, 246, 0.15)',
    border: 'border-violet/30',
    glow: 'violet',
  },
  magenta: {
    text: 'text-magenta',
    bg: 'bg-magenta/10',
    stroke: '#F43F5E',
    fill: 'rgba(244, 63, 94, 0.15)',
    border: 'border-magenta/30',
    glow: 'magenta',
  },
  emerald: {
    text: 'text-emerald',
    bg: 'bg-emerald/10',
    stroke: '#10B981',
    fill: 'rgba(16, 185, 129, 0.15)',
    border: 'border-emerald/30',
    glow: 'emerald',
  },
  amber: {
    text: 'text-amber',
    bg: 'bg-amber/10',
    stroke: '#F59E0B',
    fill: 'rgba(245, 158, 11, 0.15)',
    border: 'border-amber/30',
    glow: 'amber',
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
      className="w-28 h-9 overflow-visible"
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

  return <span className="telemetry-num">{renderedText}</span>;
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
  const palette = accentColors[accent];

  return (
    <GlassCard
      glow={palette.glow}
      hoverEffect
      className={`p-5 flex flex-col justify-between ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase font-medium tracking-wider text-slate-400">
            {label}
          </p>
          <div className={`text-3xl font-bold tracking-tight text-white ${palette.text}`}>
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
            className={`p-2.5 rounded-xl border ${palette.border} ${palette.bg} ${palette.text} shadow-sm`}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          {change !== undefined && (
            <span
              className={`inline-flex items-center gap-0.5 font-medium px-1.5 py-0.5 rounded ${
                change > 0
                  ? 'bg-emerald/15 text-emerald'
                  : change < 0
                  ? 'bg-magenta/15 text-magenta'
                  : 'bg-slate-800 text-slate-400'
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
          <span className="text-slate-400 text-[11px] truncate">{changeLabel}</span>
        </div>

        {sparklineData && sparklineData.length > 1 && (
          <Sparkline
            data={sparklineData}
            stroke={palette.stroke}
            fill={palette.fill}
          />
        )}
      </div>
    </GlassCard>
  );
}
