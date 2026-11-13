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
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  LOW: {
    border: 'border-sky-200 dark:border-sky-800/80',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    icon: Info,
  },
  MEDIUM: {
    border: 'border-amber-200 dark:border-amber-800/80',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    icon: AlertTriangle,
  },
  HIGH: {
    border: 'border-orange-200 dark:border-orange-800/80',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-300',
    icon: AlertCircle,
  },
  CRITICAL: {
    border: 'border-rose-200 dark:border-rose-800/80',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    icon: ShieldAlert,
  },
};

export function SeverityBadge({
  severity,
  size = 'md',
  showIcon = true,
  className = '',
}: SeverityBadgeProps) {
  const norm = (severity || 'LOW').toUpperCase();
  const config = severityConfig[norm] ?? severityConfig.LOW;
  const IconComponent = config.icon;

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[10px] gap-1'
      : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-mono font-medium uppercase tracking-wider rounded-md border ${config.border} ${config.bg} ${config.text} ${sizeClasses} ${className}`}
    >
      {showIcon && <IconComponent className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      {norm === 'CRITICAL' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-600" />
        </span>
      )}
      <span>{norm}</span>
    </span>
  );
}
