/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        void: '#0A0B14',
        panel: '#101222',
        elevated: '#16192E',
        surface: '#1A1D36',
        cyan: {
          DEFAULT: '#22D3EE',
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
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
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 24px rgba(34, 211, 238, 0.28)',
        'glow-cyan-sm': '0 0 12px rgba(34, 211, 238, 0.22)',
        'glow-violet': '0 0 24px rgba(139, 92, 246, 0.28)',
        'glow-violet-sm': '0 0 12px rgba(139, 92, 246, 0.22)',
        'glow-magenta': '0 0 28px rgba(244, 63, 94, 0.35)',
        'glow-magenta-sm': '0 0 12px rgba(244, 63, 94, 0.25)',
        'glow-emerald': '0 0 24px rgba(16, 185, 129, 0.28)',
        'glow-emerald-sm': '0 0 12px rgba(16, 185, 129, 0.22)',
        'glow-amber': '0 0 24px rgba(245, 158, 11, 0.28)',
        'glow-amber-sm': '0 0 12px rgba(245, 158, 11, 0.22)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'border-flow': 'border-flow 6s ease infinite',
        'radar-sweep': 'radar-sweep 4s linear infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
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
