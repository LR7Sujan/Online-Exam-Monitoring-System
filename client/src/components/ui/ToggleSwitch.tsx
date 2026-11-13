import React from 'react';
import { motion } from 'framer-motion';
import { triggerHaptic } from '../../utils/audioAlert';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  size = 'md',
  className = '',
}: ToggleSwitchProps) {
  const isSm = size === 'sm';
  const trackWidth = isSm ? 'w-8 h-4.5' : 'w-11 h-6';
  const knobSize = isSm ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5';
  const knobOffset = isSm ? 14 : 20;

  const handleToggle = () => {
    if (disabled) return;
    triggerHaptic('light');
    onChange(!checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <label
      className={`inline-flex items-center gap-2.5 cursor-pointer select-none ${
        disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
      } ${className}`}
    >
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onClick={handleToggle}
        className={`relative inline-flex items-center rounded-full p-0.5 transition-colors duration-200 border focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-[#070810] focus-visible:outline-none ${trackWidth} ${
          checked
            ? 'bg-cyan/25 border-cyan/60 shadow-glow-cyan-sm'
            : 'bg-white/10 border-white/15 hover:bg-white/15'
        }`}
      >
        <motion.div
          layout
          initial={false}
          animate={{ x: checked ? knobOffset : 2 }}
          transition={{ type: 'spring', stiffness: 550, damping: 32 }}
          className={`rounded-full shadow-md ${knobSize} ${
            checked ? 'bg-cyan' : 'bg-slate-300'
          }`}
        />
      </div>

      {label && (
        <span className="text-xs font-mono text-slate-300 select-none">
          {label}
        </span>
      )}
    </label>
  );
}

