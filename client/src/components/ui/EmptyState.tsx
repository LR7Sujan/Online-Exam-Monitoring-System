import React from 'react';
import { motion } from 'framer-motion';
import { Compass, AlertTriangle, RotateCcw } from 'lucide-react';
import { NeonButton } from './NeonButton';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'outline';
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`p-10 rounded-[20px] border border-border bg-surface text-foreground shadow-bento flex flex-col items-center justify-center text-center ${className}`}
    >
      <div className="relative mb-5 flex items-center justify-center">
        {/* Subtle decorative concentric rings */}
        <div className="absolute w-24 h-24 rounded-full border border-border animate-pulse-slow" />
        <div className="absolute w-16 h-16 rounded-full border border-dashed border-border" />

        {/* Center icon container */}
        <div className="relative z-10 p-4 rounded-2xl bg-surface-elevated border border-border text-brand shadow-sm">
          {icon ?? <Compass className="w-8 h-8" />}
        </div>
      </div>

      <motion.h3
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-base font-semibold text-foreground tracking-tight"
      >
        {title}
      </motion.h3>

      {description && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-1.5 text-xs text-muted-foreground max-w-sm leading-relaxed"
        >
          {description}
        </motion.p>
      )}

      {action && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-5"
        >
          <NeonButton
            variant={action.variant ?? 'primary'}
            size="sm"
            leftIcon={action.icon}
            onClick={action.onClick}
          >
            {action.label}
          </NeonButton>
        </motion.div>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Failed to Load Data',
  description = 'The server is not reachable. Check that the API and MySQL are running',
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      className={`p-10 rounded-[20px] border border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20 text-foreground shadow-bento flex flex-col items-center justify-center text-center ${className}`}
    >
      <div className="relative mb-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-sm">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h3 className="text-base font-semibold text-foreground tracking-tight">{title}</h3>
      <p className="mt-1.5 text-xs text-muted-foreground max-w-sm leading-relaxed">{description}</p>
      {onRetry && (
        <div className="mt-5">
          <NeonButton
            variant="primary"
            size="sm"
            onClick={onRetry}
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            Retry Request
          </NeonButton>
        </div>
      )}
    </div>
  );
}
