import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';

export type AccentColor = 'indigo' | 'cyan' | 'emerald' | 'amber' | 'rose';

export interface AccentOption {
  id: AccentColor;
  name: string;
  swatchClass: string;
  checkClass: string;
  gradientLabel: string;
}

export const ACCENT_COLORS: readonly AccentColor[] = ['indigo', 'cyan', 'emerald', 'amber', 'rose'] as const;

export const ACCENT_OPTIONS: readonly AccentOption[] = [
  {
    id: 'indigo',
    name: 'Indigo',
    swatchClass: 'accent-swatch-indigo',
    checkClass: 'text-white',
    gradientLabel: 'Indigo to Violet to Fuchsia',
  },
  {
    id: 'cyan',
    name: 'Cyan',
    swatchClass: 'accent-swatch-cyan',
    checkClass: 'text-white',
    gradientLabel: 'Cyan to Sky to Blue',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    swatchClass: 'accent-swatch-emerald',
    checkClass: 'text-white',
    gradientLabel: 'Emerald to Teal to Green',
  },
  {
    id: 'amber',
    name: 'Amber',
    swatchClass: 'accent-swatch-amber',
    checkClass: 'text-zinc-950',
    gradientLabel: 'Amber to Orange to Yellow',
  },
  {
    id: 'rose',
    name: 'Rose',
    swatchClass: 'accent-swatch-rose',
    checkClass: 'text-white',
    gradientLabel: 'Rose to Pink to Orange',
  },
] as const;

export interface AccentContextValue {
  accent: AccentColor;
  setAccent: (accent: AccentColor) => void;
  accents: readonly AccentOption[];
  ACCENT_COLORS: readonly AccentColor[];
}

const AccentContext = createContext<AccentContextValue | undefined>(undefined);

export interface AccentProviderProps {
  children: React.ReactNode;
  defaultAccent?: AccentColor;
  storageKey?: string;
}

export function AccentProvider({
  children,
  defaultAccent = 'indigo',
  storageKey = 'proctoriq-accent',
}: AccentProviderProps) {
  const [accent, setAccentState] = useState<AccentColor>(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(storageKey) as AccentColor | null;
        if (stored && ACCENT_COLORS.includes(stored)) {
          return stored;
        }
      }
    } catch {
      // Fallback if localStorage access is denied
    }
    return defaultAccent;
  });

  const transitionTimerRef = useRef<number | null>(null);

  const triggerSmoothTransition = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) return;

      const root = document.documentElement;
      root.classList.add('accent-transition');
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
      transitionTimerRef.current = window.setTimeout(() => {
        root.classList.remove('accent-transition');
        transitionTimerRef.current = null;
      }, 300);
    } catch {
      // Ignore transition errors in test environments
    }
  }, []);

  const setAccent = useCallback(
    (newAccent: AccentColor) => {
      if (!ACCENT_COLORS.includes(newAccent)) return;

      setAccentState(newAccent);
      triggerSmoothTransition();

      try {
        localStorage.setItem(storageKey, newAccent);
      } catch {
        // Fallback for storage write restrictions
      }

      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-accent', newAccent);
      }

      // Dispatch event for intra-tab synchronizations
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('proctoriq-accent-change', { detail: newAccent }));
      }
    },
    [storageKey, triggerSmoothTransition]
  );

  // Sync with cross-tab storage events and intra-tab custom events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        const val = e.newValue as AccentColor;
        if (ACCENT_COLORS.includes(val)) {
          setAccentState(val);
          triggerSmoothTransition();
          document.documentElement.setAttribute('data-accent', val);
        }
      }
    };

    const handleCustomChange = () => {
      try {
        const stored = localStorage.getItem(storageKey) as AccentColor | null;
        if (stored && ACCENT_COLORS.includes(stored) && stored !== accent) {
          setAccentState(stored);
          triggerSmoothTransition();
          document.documentElement.setAttribute('data-accent', stored);
        }
      } catch {
        // Ignore storage read errors
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('proctoriq-accent-change', handleCustomChange);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('proctoriq-accent-change', handleCustomChange);
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, [storageKey, accent, triggerSmoothTransition]);

  // Ensure DOM attribute is initialized on mount
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-accent', accent);
    }
  }, [accent]);

  return (
    <AccentContext.Provider
      value={{
        accent,
        setAccent,
        accents: ACCENT_OPTIONS,
        ACCENT_COLORS,
      }}
    >
      {children}
    </AccentContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAccent(): AccentContextValue {
  const context = useContext(AccentContext);
  if (!context) {
    throw new Error('useAccent must be used within an AccentProvider');
  }
  return context;
}
