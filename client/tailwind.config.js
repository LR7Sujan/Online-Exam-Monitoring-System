function withColorMix(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `color-mix(in srgb, var(${variableName}) calc(${opacityValue} * 100%), transparent)`;
    }
    return `var(${variableName})`;
  };
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      borderColor: {
        DEFAULT: 'var(--border)',
        strong: 'var(--border-strong)',
        brand: withColorMix('--brand-border'),
      },
      textColor: {
        brand: withColorMix('--brand-text'),
        safe: withColorMix('--semantic-emerald'),
        caution: withColorMix('--semantic-amber'),
        danger: withColorMix('--semantic-rose'),
        info: withColorMix('--semantic-sky'),
        'emerald-400': 'var(--semantic-emerald, #34D399)',
        'emerald-500': 'var(--semantic-emerald, #10B981)',
        'emerald-600': 'var(--semantic-emerald, #059669)',
        'rose-400': 'var(--semantic-rose, #FB7185)',
        'rose-500': 'var(--semantic-rose, #F43F5E)',
        'rose-600': 'var(--semantic-rose, #E11D48)',
        'amber-400': 'var(--semantic-amber, #FBBF24)',
        'amber-500': 'var(--semantic-amber, #F59E0B)',
        'amber-600': 'var(--semantic-amber, #D97706)',
        'sky-400': 'var(--semantic-sky, #38BDF8)',
        'sky-500': 'var(--semantic-sky, #0EA5E9)',
        'sky-600': 'var(--semantic-sky, #0284C7)',
      },
      backgroundColor: {
        brand: withColorMix('--brand-bg'),
      },
      colors: {
        // Aurora Bento CSS-Variable Tokens (Dual-Theme)
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        text: 'var(--foreground)',
        surface: {
          DEFAULT: 'var(--surface)',
          elevated: 'var(--surface-elevated)',
          2: 'var(--surface-2)',
        },
        'surface-2': 'var(--surface-2)',
        border: {
          DEFAULT: withColorMix('--border'),
          strong: withColorMix('--border-strong'),
        },
        'border-strong': withColorMix('--border-strong'),
        'bento-border': withColorMix('--border'),
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        ring: 'var(--ring)',

        // Aurora Brand Palette
        brand: {
          DEFAULT: 'var(--brand, #6366F1)',
          indigo: '#6366F1',
          violet: '#8B5CF6',
          fuchsia: '#D946EF',
        },

        // Semantic Colors
        safe: {
          DEFAULT: 'var(--semantic-emerald, #10B981)',
          light: '#34D399',
          dark: '#059669',
        },
        caution: {
          DEFAULT: 'var(--semantic-amber, #F59E0B)',
          light: '#FBBF24',
          dark: '#D97706',
        },
        danger: {
          DEFAULT: 'var(--semantic-rose, #F43F5E)',
          light: '#FB7185',
          dark: '#E11D48',
        },
        info: {
          DEFAULT: 'var(--semantic-sky, #0EA5E9)',
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
        // Bento Layered Shadows (warm and soft)
        'bento-sm': '0 1px 2px 0 rgba(60, 45, 20, 0.05)',
        bento: '0 1px 3px 0 rgba(60, 45, 20, 0.05), 0 8px 24px -4px rgba(60, 45, 20, 0.08)',
        'bento-xl': '0 20px 40px -8px rgba(60, 45, 20, 0.16)',
        'bento-card': '0 0 0 1px var(--border), 0 2px 8px -2px rgba(60, 45, 20, 0.08)',
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
