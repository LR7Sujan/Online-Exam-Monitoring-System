import React from 'react';
import { motion } from 'framer-motion';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: 'pills' | 'underline';
  className?: string;
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = 'pills',
  className = '',
}: TabsProps) {
  if (variant === 'underline') {
    return (
      <div
        className={`flex items-center space-x-1 border-b border-white/10 ${className}`}
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors duration-200 flex items-center gap-2 select-none disabled:opacity-40 disabled:cursor-not-allowed ${
                isActive ? 'text-cyan font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/10 text-slate-300">
                  {tab.badge}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="tabs-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Pill variant
  return (
    <div
      className={`inline-flex items-center p-1 rounded-xl bg-[#101222]/90 border border-white/10 backdrop-blur-md ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={`relative px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors duration-200 flex items-center gap-2 select-none disabled:opacity-40 disabled:cursor-not-allowed z-10 ${
              isActive ? 'text-void font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="tabs-pill"
                className="absolute inset-0 rounded-lg bg-cyan shadow-glow-cyan"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {tab.icon && <span className="w-3.5 h-3.5">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive ? 'bg-void/25 text-void' : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

