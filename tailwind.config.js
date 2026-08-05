/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    // §2 Spacing: 8-point system — 4/8/12/16/24/32/40/48/64/80/96 only, no
    // arbitrary values. Replacing Tailwind's default scale entirely so only
    // these keys exist (p-4 = 4px, p-8 = 8px, ... not the default rem scale).
    spacing: {
      0: '0px',
      px: '1px',
      4: '4px',
      8: '8px',
      12: '12px',
      16: '16px',
      24: '24px',
      32: '32px',
      40: '40px',
      48: '48px',
      64: '64px',
      80: '80px',
      96: '96px',
    },
    borderRadius: {
      none: '0px',
      sm: '8px',
      md: '12px',
      lg: '16px',
      xl: '24px',
      full: '9999px',
    },
    extend: {
      colors: {
        // Semantic tokens, wired to CSS variables so light/dark themes swap
        // automatically (see src/theme/tokens.css). Never reference raw hex
        // in components — always these semantic names.
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          card: 'rgb(var(--surface-card) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--text-tertiary) / <alpha-value>)',
        },
        // §2 Color system — accent colors carry meaning, never decoration.
        income: {
          DEFAULT: '#10B981', // Emerald 500 — Primary/Income
          subtle: 'rgb(16 185 129 / 0.12)',
        },
        expense: {
          DEFAULT: '#F97360', // Coral 500 — Expense
          subtle: 'rgb(249 115 96 / 0.12)',
        },
        warning: {
          DEFAULT: '#F59E0B', // Amber 500
          subtle: 'rgb(245 158 11 / 0.12)',
        },
        info: {
          DEFAULT: '#3B82F6', // Blue 500 — Information
          subtle: 'rgb(59 130 246 / 0.12)',
        },
        liability: {
          DEFAULT: '#8B5CF6', // Purple 500 — Loans/EMI
          subtle: 'rgb(139 92 246 / 0.12)',
        },
      },
      fontFamily: {
        // §4 stack: Inter → Geist → system UI fallback
        sans: [
          'Inter Variable',
          'InterVariable',
          'Geist',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        // §2 type scale
        display: ['2.5rem', { lineHeight: '1.1', fontWeight: '600', letterSpacing: '-0.02em' }],
        h1: ['2rem', { lineHeight: '1.2', fontWeight: '600', letterSpacing: '-0.01em' }],
        h2: ['1.5rem', { lineHeight: '1.25', fontWeight: '600' }],
        h3: ['1.25rem', { lineHeight: '1.3', fontWeight: '600' }],
        'body-lg': ['1.0625rem', { lineHeight: '1.5' }],
        body: ['0.9375rem', { lineHeight: '1.5' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.45' }],
        caption: ['0.75rem', { lineHeight: '1.4' }],
        overline: ['0.6875rem', { lineHeight: '1.3', letterSpacing: '0.06em', fontWeight: '600' }],
      },
      boxShadow: {
        // §2 Elevation — 3 levels only
        flat: 'none',
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 1px rgb(0 0 0 / 0.03)',
        floating: '0 8px 24px rgb(0 0 0 / 0.12), 0 2px 8px rgb(0 0 0 / 0.06)',
      },
      transitionDuration: {
        fast: '150ms',
        standard: '200ms',
        slow: '300ms',
      },
      minHeight: {
        touch: '48px',
      },
      minWidth: {
        touch: '48px',
      },
    },
  },
  plugins: [],
}
