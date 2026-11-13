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
      return <Laptop className="w-4 h-4 text-brand-indigo" />;
    }
    if (resolvedTheme === 'dark') {
      return <Moon className="w-4 h-4 text-brand-violet" />;
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
      className={`relative inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-white/10 dark:border-white/10 border-zinc-200 bg-white/5 dark:bg-white/5 bg-zinc-100 hover:bg-white/10 dark:hover:bg-white/10 hover:bg-zinc-200 text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand shadow-sm ${className}`}
      aria-label={`Current theme: ${theme}. Click to change theme.`}
      title={`Theme: ${getLabel()} (click to cycle)`}
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
        <span className="text-xs font-mono font-medium tracking-wide">
          {getLabel()}
        </span>
      )}
    </button>
  );
}
