import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Palette, Check } from 'lucide-react';
import { useAccent } from '../../context/AccentContext';

export interface AccentPickerProps {
  variant?: 'inline' | 'popover';
  placement?: 'bottom-end' | 'bottom-start' | 'right';
  className?: string;
  showLabel?: boolean;
}

export function AccentPicker({
  variant = 'inline',
  placement = 'bottom-end',
  className = '',
  showLabel = false,
}: AccentPickerProps) {
  const { accent, setAccent, accents } = useAccent();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Close popover on click outside or escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Arrow key navigation within the swatches
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
      let nextIndex = currentIndex;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % accents.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + accents.length) % accents.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = accents.length - 1;
      } else {
        return;
      }

      const nextOption = accents[nextIndex];
      if (nextOption) {
        setAccent(nextOption.id);
        buttonRefs.current[nextIndex]?.focus();
      }
    },
    [accents, setAccent]
  );

  const renderSwatches = () => (
    <div
      role="radiogroup"
      aria-label="Theme accent color"
      className="flex items-center gap-2"
    >
      {accents.map((opt, index) => {
        const isSelected = accent === opt.id;
        return (
          <button
            key={opt.id}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${opt.name} accent (${opt.gradientLabel})`}
            title={`${opt.name}: ${opt.gradientLabel}`}
            tabIndex={isSelected ? 0 : -1}
            data-accent-swatch={opt.id}
            onClick={() => {
              setAccent(opt.id);
            }}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center transition-all duration-200 cursor-pointer ${
              opt.swatchClass
            } ${
              isSelected
                ? 'ring-2 ring-offset-2 ring-foreground dark:ring-white ring-offset-surface scale-105 shadow-md shadow-accent/25'
                : 'opacity-80 hover:opacity-100 hover:scale-105 ring-1 ring-border/50'
            }`}
          >
            {isSelected && (
              <Check
                className={`w-3.5 h-3.5 stroke-[2.75] ${opt.checkClass} drop-shadow-xs`}
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );

  if (variant === 'inline') {
    return (
      <div className={`space-y-1.5 ${className}`}>
        {showLabel && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 font-semibold select-none">
            ACCENT
          </span>
        )}
        {renderSwatches()}
      </div>
    );
  }

  // Popover variant
  const getPopoverPlacementClass = () => {
    switch (placement) {
      case 'right':
        return 'left-full ml-3 top-1/2 -translate-y-1/2';
      case 'bottom-start':
        return 'left-0 top-full mt-2';
      case 'bottom-end':
      default:
        return 'right-0 top-full mt-2';
    }
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative inline-flex items-center justify-center gap-2 h-[38px] px-2.5 rounded-xl border border-border bg-surface hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand shadow-xs cursor-pointer"
        aria-label={`Theme accent: ${accent}. Click to change accent.`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={`Interface Accent: ${accent.charAt(0).toUpperCase() + accent.slice(1)} (click to choose)`}
      >
        <div className="relative w-4 h-4 flex items-center justify-center">
          <Palette className="w-4 h-4 text-accent" />
        </div>

        {showLabel && (
          <span className="text-xs font-mono font-medium tracking-wide text-foreground capitalize">
            {accent}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Choose interface accent"
          className={`absolute ${getPopoverPlacementClass()} z-50 p-3 rounded-2xl border border-border bg-surface dark:bg-[#12131d] shadow-2xl backdrop-blur-xl whitespace-nowrap min-w-[190px] animate-in fade-in zoom-in-95 duration-150`}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold select-none">
              ACCENT
            </span>
            <span className="text-[10px] font-mono text-accent font-semibold capitalize">
              {accent}
            </span>
          </div>
          {renderSwatches()}
        </div>
      )}
    </div>
  );
}
