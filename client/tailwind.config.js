/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Aurora Bento CSS-Variable Tokens (Dual-Theme)
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        text: 'var(--foreground)',
        surface: {
          DEFAULT: 'var(--surface)',
          elevated: 'var(--surface-elevated)',
        },
        border: 'var(--border)',
        'bento-border': 'var(--border)',
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        ring: 'var(--ring)',

        // Aurora Brand Palette
        brand: {
          DEFAULT: '#6366F1',
          indigo: '#6366F1',
          violet: '#8B5CF6',
          fuchsia: '#D946EF',
        },

        // Semantic Colors
        safe: {
          DEFAULT: '#10B981',
          light: '#34D399',
          dark: '#059669',
        },
        caution: {
          DEFAULT: '#F59E0B',
          light: '#FBBF24',
          dark: '#D97706',
        },
        danger: {
          DEFAULT: '#F43F5E',
          light: '#FB7185',
          dark: '#E11D48',
        },
        info: {
          DEFAULT: '#0EA5E9',
          light: '#38BDF8',
          dark: '#0284C7',
        },

        // Extended Palette
        cyan: {
          DEFAULT: '#0EA5E9',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
        },
        violet: {
          DEFAULT: '#8B5CF6',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
        },
        magenta: {
          DEFAULT: '#F43F5E',
          300: '#FDA4AF',
          400: '#FB7185',
          500: '#F43F5E',
          600: '#E11D48',
        },
        emerald: {
          DEFAULT: '#10B981',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
        },
        amber: {
          DEFAULT: '#F59E0B',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      zIndex: {
        '0': '0',
        '30': '30',
        '40': '40',
        '50': '50',
        '60': '60',
        '70': '70',
        '80': '80',
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '24px',
        bento: '20px',
        'bento-lg': '24px',
      },
      boxShadow: {
        // Bento Layered Shadows
        'bento-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        bento: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 8px 24px -4px rgba(0, 0, 0, 0.1)',
        'bento-xl': '0 20px 40px -8px rgba(0, 0, 0, 0.25)',
        'bento-card': '0 0 0 1px var(--border), 0 2px 8px -2px rgba(0, 0, 0, 0.08)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'border-flow': 'border-flow 6s ease infinite',
        'radar-sweep': 'radar-sweep 4s linear infinite',
        'scanline': 'scanline 8s linear infinite',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'border-flow': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'radar-sweep': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'scanline': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        },
      },
    },
  },
  plugins: [],
};
