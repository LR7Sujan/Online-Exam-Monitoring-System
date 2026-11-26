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
        className={`flex items-center space-x-1 border-b border-border ${className}`}
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              data-testid={`tab-${tab.id}`}
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors duration-200 flex items-center gap-2 select-none disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-t-lg ${
                isActive ? 'text-brand font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-muted text-muted-foreground">
                  {tab.badge}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="tabs-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
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
      className={`inline-flex items-center p-1 rounded-xl bg-surface-elevated border border-border ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            data-testid={`tab-${tab.id}`}
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={`relative px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors duration-200 flex items-center gap-2 select-none disabled:opacity-40 disabled:cursor-not-allowed z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              isActive ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="tabs-pill"
                className="absolute inset-0 rounded-lg bg-surface dark:bg-zinc-700 shadow-xs border border-border/80"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {tab.icon && <span className="w-3.5 h-3.5">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground'
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
