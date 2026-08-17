// apps/admin/tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    // Without this, every Tailwind class used inside @hisabche/ui is purged
    // from the admin bundle — shared components render unstyled.
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
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
        purple: {
          DEFAULT: 'hsl(var(--color-purple))',
          50: 'hsl(168 70% 95%)',
          100: 'hsl(167 68% 87%)',
          200: 'hsl(166 70% 75%)',
          300: 'hsl(165 74% 63%)',
          400: 'hsl(165 75% 57%)',
          500: 'hsl(var(--color-purple))',
          600: 'hsl(164 74% 47%)',
          700: 'hsl(174 79% 28%)',
          800: 'hsl(179 82% 22%)',
          900: 'hsl(178 76% 14%)',
        },
        cyan: {
          DEFAULT: 'hsl(var(--color-cyan))',
          500: 'hsl(var(--color-cyan))',
        },
        emerald: {
          DEFAULT: 'hsl(var(--color-emerald))',
          500: 'hsl(var(--color-emerald))',
        },
        amber: {
          DEFAULT: 'hsl(38 92% 55%)',
          500: 'hsl(38 92% 55%)',
        },
        rose: {
          DEFAULT: 'hsl(0 84% 60%)',
          500: 'hsl(0 84% 60%)',
        },
        blue: {
          DEFAULT: 'hsl(210 90% 55%)',
          500: 'hsl(210 90% 55%)',
        },
        teal: {
          DEFAULT: 'hsl(var(--color-secondary))',
          500: 'hsl(var(--color-secondary))',
        },
        background: 'hsl(var(--hisab-background))',
        foreground: 'hsl(var(--hisab-foreground))',
        card: {
          DEFAULT: 'hsl(var(--hisab-card))',
          fg: 'hsl(var(--hisab-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--hisab-muted))',
          fg: 'hsl(var(--hisab-muted-fg))',
        },
        border: 'hsl(var(--hisab-border))',
        ring: 'hsl(var(--hisab-ring))',
        surface: {
          base: 'hsl(var(--surface-base))',
          muted: 'hsl(var(--surface-muted))',
          elevated: 'hsl(var(--surface-elevated))',
        },
        narrative: {
          frustration: 'rgba(14, 110, 105, 0.10)',
          confusion: 'rgba(239, 68, 68, 0.10)',
          clarity: 'rgba(18, 200, 160, 0.10)',
          confidence: 'rgba(99, 231, 200, 0.10)',
          trust: 'rgba(14, 110, 105, 0.12)',
          action: 'rgba(245, 158, 11, 0.15)',
        },
      },

      borderRadius: {
        none: 'var(--radius-none)',
        xxs: 'var(--radius-xxs)',
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        full: 'var(--radius-full)',
        card: 'var(--radius-card)',
        'card-sm': 'var(--radius-card-sm)',
        'card-md': 'var(--radius-card-md)',
        'card-lg': 'var(--radius-card-lg)',
        button: 'var(--radius-button)',
        modal: 'var(--radius-modal)',
        input: 'var(--radius-input)',
        badge: 'var(--radius-badge)',
        pill: 'var(--radius-full)',
        avatar: 'var(--radius-full)',
      },

      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },

      fontSize: {
        'heading-1': 'var(--font-heading-1)',
        'heading-2': 'var(--font-heading-2)',
        'heading-3': 'var(--font-heading-3)',
        body: 'var(--font-body)',
        'body-large': 'var(--font-body-large)',
      },

      lineHeight: {
        tight: 'var(--leading-tight)',
        normal: 'var(--leading-normal)',
        relaxed: 'var(--leading-relaxed)',
      },

      boxShadow: {
        '0': 'var(--elevation-0)',
        '1': 'var(--elevation-1)',
        '2': 'var(--elevation-2)',
        '3': 'var(--elevation-3)',
        '4': 'var(--elevation-4)',
        '5': 'var(--elevation-5)',
        '6': 'var(--elevation-6)',
        'card-sm': 'var(--card-elevation-sm)',
        'card-md': 'var(--card-elevation-md)',
        'card-lg': 'var(--card-elevation-lg)',
      },

      spacing: {
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
        '3xl': 'var(--space-3xl)',
        18: '4.5rem',
        88: '22rem',
        128: '32rem',
      },

      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        glass: '18px',
      },

      transitionTimingFunction: {
        'ease-out': 'var(--ease-out)',
        'ease-soft': 'var(--ease-soft)',
        'ease-identity': 'var(--ease-identity)',
        hisab: 'var(--hisab-ease)',
      },

      transitionDuration: {
        micro: 'var(--duration-micro)',
        short: 'var(--duration-short)',
        medium: 'var(--duration-medium)',
        long: 'var(--duration-long)',
        hisab: '200ms',
      },

      zIndex: {
        base: 'var(--z-base)',
        dropdown: 'var(--z-dropdown)',
        sticky: 'var(--z-sticky)',
        fixed: 'var(--z-fixed)',
        'modal-backdrop': 'var(--z-modal-backdrop)',
        modal: 'var(--z-modal)',
        popover: 'var(--z-popover)',
        tooltip: 'var(--z-tooltip)',
        toast: 'var(--z-toast)',
        cmdk: 'var(--z-cmdk)',
        fab: 'var(--z-fab)',
      },

      keyframes: {
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-slide-up': {
          from: { opacity: '0', transform: 'translateY(15px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        drift: {
          '0%': { transform: 'translate(0, 0)' },
          '100%': { transform: 'translate(-40px, -40px)' },
        },
        'ambient-pulse': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1) translate(0, 0)' },
          '50%': { opacity: '0.6', transform: 'scale(1.08) translate(20px, 10px)' },
        },
        'fab-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(36, 224, 176, 0.4)' },
          '50%': { boxShadow: '0 0 0 12px rgba(36, 224, 176, 0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },

      animation: {
        'fade-in-up': 'fade-in-up 200ms var(--ease-out) both',
        'fade-slide-up': 'fade-slide-up 300ms var(--ease-out) both',
        drift: 'drift 20s ease-in-out infinite alternate',
        'ambient-pulse': 'ambient-pulse 8s ease-in-out infinite',
        'fab-pulse': 'fab-pulse 2s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
