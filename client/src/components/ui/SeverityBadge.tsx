import React from 'react';
import type { ViolationSeverity } from '../../types/domain';
import { AlertCircle, AlertTriangle, Info, ShieldAlert } from 'lucide-react';

export interface SeverityBadgeProps {
  severity: ViolationSeverity | string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

const severityConfig: Record<
  string,
  {
    border: string;
    bg: string;
    text: string;
    glow: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  LOW: {
    border: 'border-cyan-400/40',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-300',
    glow: 'shadow-glow-cyan-sm',
    icon: Info,
  },
  MEDIUM: {
    border: 'border-amber-400/40',
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
    glow: 'shadow-glow-amber-sm',
    icon: AlertTriangle,
  },
  HIGH: {
    border: 'border-orange-500/50',
    bg: 'bg-orange-500/15',
    text: 'text-orange-300',
    glow: 'shadow-glow-amber-sm',
    icon: AlertCircle,
  },
  CRITICAL: {
    border: 'border-magenta-500/60',
    bg: 'bg-magenta-500/20',
    text: 'text-magenta-300',
    glow: 'shadow-glow-magenta-sm',
    icon: ShieldAlert,
  },
};

export function SeverityBadge({
  severity,
  size = 'md',
  showIcon = true,
  className = '',
}: SeverityBadgeProps) {
  const norm = severity.toUpperCase();
  const config = severityConfig[norm] ?? severityConfig.LOW;
  const IconComponent = config.icon;

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[10px] gap-1'
      : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-mono font-medium uppercase tracking-wider rounded-md border ${config.border} ${config.bg} ${config.text} ${config.glow} ${sizeClasses} ${className}`}
    >
      {showIcon && <IconComponent className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      {norm === 'CRITICAL' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-magenta opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-magenta"></span>
        </span>
      )}
      <span>{norm}</span>
    </span>
  );
}

