import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../apps/web/src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../apps/web/app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../apps/mobile/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1440px' },
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(var(--hisab-primary))',
          fg: 'hsl(var(--hisab-primary-fg))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--hisab-secondary))',
          fg: 'hsl(var(--hisab-secondary-fg))',
        },
        accent: {
          DEFAULT: 'hsl(var(--hisab-accent))',
          fg: 'hsl(var(--hisab-accent-fg))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--hisab-destructive))',
          fg: 'hsl(var(--hisab-destructive-fg))',
        },
        success: {
          DEFAULT: 'hsl(var(--hisab-success))',
          fg: 'hsl(var(--hisab-success-fg))',
        },
        warning: {
          DEFAULT: 'hsl(var(--hisab-warning))',
          fg: 'hsl(var(--hisab-warning-fg))',
        },
        info: {
          DEFAULT: 'hsl(var(--hisab-info))',
          fg: 'hsl(var(--hisab-info-fg))',
        },
        background: 'hsl(var(--hisab-background))',
        foreground: 'hsl(var(--hisab-foreground))',
        card: {
          DEFAULT: 'hsl(var(--hisab-card))',
          fg: 'hsl(var(--hisab-card-fg))',
        },
        popover: {
          DEFAULT: 'hsl(var(--hisab-popover))',
          fg: 'hsl(var(--hisab-popover-fg))',
        },
        muted: {
          DEFAULT: 'hsl(var(--hisab-muted))',
          fg: 'hsl(var(--hisab-muted-fg))',
        },
        border: 'hsl(var(--hisab-border))',
        input: 'hsl(var(--hisab-input))',
        ring: 'hsl(var(--hisab-ring))',
      },
      borderRadius: {
        DEFAULT: 'var(--hisab-radius)',
        sm: 'var(--hisab-radius-sm)',
        md: 'var(--hisab-radius-md)',
        lg: 'var(--hisab-radius-lg)',
        xl: 'var(--hisab-radius-xl)',
        '2xl': 'var(--hisab-radius-2xl)',
      },
      fontFamily: {
        sans: ['var(--hisab-font-sans)'],
        mono: ['var(--hisab-font-mono)'],
      },
      boxShadow: {
        sm: 'var(--hisab-shadow-sm)',
        md: 'var(--hisab-shadow-md)',
        lg: 'var(--hisab-shadow-lg)',
      },
      backdropBlur: {
        xs: '2px',
      },
      spacing: {
        18: '4.5rem',
        88: '22rem',
        128: '32rem',
      },
      // Animation classes removed — use CSS classes instead (single source of truth)
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config