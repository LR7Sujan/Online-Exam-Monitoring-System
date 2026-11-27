import { useState, forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export interface FloatingInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: ReactNode;
  rightElement?: ReactNode;
}

export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ label, id, value, onChange, icon, rightElement, className = '', ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const hasValue = Boolean(value !== undefined && value !== null && String(value).length > 0);
    const isFloated = isFocused || hasValue;

    return (
      <div className="relative group w-full">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-brand transition-colors pointer-events-none z-10">
            {icon}
          </div>
        )}

        <input
          ref={ref}
          id={id}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder=" "
          className={`peer w-full rounded-xl border border-border bg-surface-elevated/80 text-foreground text-sm font-sans px-3.5 pt-5 pb-2 outline-none transition-all duration-200 focus:border-brand/60 focus:ring-2 focus:ring-brand/20 ${
            icon ? 'pl-10' : ''
          } ${rightElement ? 'pr-10' : ''} ${className}`}
          {...props}
        />

        <label
          htmlFor={id}
          className={`absolute transition-all duration-200 pointer-events-none select-none font-medium ${
            icon ? 'left-10' : 'left-3.5'
          } ${
            isFloated
              ? 'top-1.5 text-[10px] uppercase tracking-wider text-accent font-semibold dark:text-foreground'
              : 'top-3.5 text-xs text-muted-foreground'
          }`}
        >
          {label}
        </label>

        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
    );
  }
);

FloatingInput.displayName = 'FloatingInput';

