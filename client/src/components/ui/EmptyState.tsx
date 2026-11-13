import React from 'react';
import { motion } from 'framer-motion';
import { Compass } from 'lucide-react';
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
      className={`p-10 rounded-2xl border border-white/10 bg-[#101222]/60 backdrop-blur-md flex flex-col items-center justify-center text-center ${className}`}
    >
      <div className="relative mb-5 flex items-center justify-center">
        {/* Radar concentric sweep */}
        <div className="absolute w-28 h-28 rounded-full border border-cyan/20 animate-pulse-slow" />
        <div className="absolute w-20 h-20 rounded-full border border-dashed border-violet/30 animate-spin [animation-duration:18s]" />

        {/* Center glowing icon */}
        <div className="relative z-10 p-4 rounded-2xl bg-[#16192E] border border-cyan/40 text-cyan shadow-glow-cyan">
          {icon ?? <Compass className="w-8 h-8" />}
        </div>
      </div>

      <motion.h3
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-lg font-semibold text-white tracking-wide"
      >
        {title}
      </motion.h3>

      {description && (
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-2 text-xs text-slate-400 max-w-sm leading-relaxed"
        >
          {description}
        </motion.p>
      )}

      {action && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6"
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
