import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'dark') setTheme('light');
    else if (theme === 'light') setTheme('system');
    else setTheme('dark');
  };

  const getIcon = () => {
    if (theme === 'system') {
      return <Laptop className="w-4 h-4 text-accent" />;
    }
    if (resolvedTheme === 'dark') {
      return <Moon className="w-4 h-4 text-accent" />;
    }
    return <Sun className="w-4 h-4 text-amber-500" />;
  };

  const getLabel = () => {
    if (theme === 'system') return 'System';
    return resolvedTheme === 'dark' ? 'Dark' : 'Light';
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={`relative inline-flex items-center justify-center gap-2 h-[38px] px-2.5 rounded-xl border border-border bg-surface hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand shadow-xs cursor-pointer ${className}`}
      aria-label={`Current theme: ${theme}. Click to change theme.`}
      title={`Interface Theme: ${getLabel()} (click to cycle)`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={theme + resolvedTheme}
            initial={{ scale: 0.5, opacity: 0, rotate: -45 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.5, opacity: 0, rotate: 45 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex items-center justify-center"
          >
            {getIcon()}
          </motion.div>
        </AnimatePresence>
      </div>

      {showLabel && (
        <span className="text-xs font-mono font-medium tracking-wide text-foreground">
          {getLabel()}
        </span>
      )}
    </button>
  );
}
