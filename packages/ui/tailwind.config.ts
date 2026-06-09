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
        // ── Brand ──────────────────────────────────────────────
        primary: {
          DEFAULT: 'hsl(var(--hisab-primary))',
          fg:      'hsl(var(--hisab-primary-fg))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--hisab-destructive))',
          fg:      'hsl(var(--hisab-destructive-fg))',
        },
        success: {
          DEFAULT: 'hsl(var(--hisab-success))',
          fg:      'hsl(var(--hisab-success-fg))',
        },
        warning: {
          DEFAULT: 'hsl(var(--hisab-warning))',
          fg:      'hsl(var(--hisab-warning-fg))',
        },
        // ── Palette ────────────────────────────────────────────
        purple:  'hsl(var(--color-purple))',
        cyan:    'hsl(var(--color-cyan))',
        emerald: 'hsl(var(--color-emerald))',
        // ── Surfaces ───────────────────────────────────────────
        background: 'hsl(var(--hisab-background))',
        foreground: 'hsl(var(--hisab-foreground))',
        card: {
          DEFAULT: 'hsl(var(--hisab-card))',
          fg:      'hsl(var(--hisab-foreground))',  // card text = foreground
        },
        muted: {
          DEFAULT: 'hsl(var(--hisab-muted))',
          fg:      'hsl(var(--hisab-muted-fg))',
        },
        border: 'hsl(var(--hisab-border))',
        ring:   'hsl(var(--hisab-ring))',
        // ── Surface base (dark bg) ──────────────────────────────
        surface: {
          base:     'hsl(var(--surface-base))',
          muted:    'hsl(var(--surface-muted))',
          elevated: 'hsl(var(--surface-elevated))',
        },
      },

      borderRadius: {
        // map به --radius-* که در globals.css هست
        none:    'var(--radius-none)',
        xxs:     'var(--radius-xxs)',
        sm:      'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md:      'var(--radius-md)',
        lg:      'var(--radius-lg)',
        xl:      'var(--radius-xl)',
        '2xl':   'var(--radius-2xl)',
        '3xl':   'var(--radius-3xl)',
        full:    'var(--radius-full)',
        // Semantic aliases
        card:    'var(--radius-card)',
        button:  'var(--radius-button)',
        modal:   'var(--radius-modal)',
        input:   'var(--radius-input)',
      },

      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },

      boxShadow: {
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
        xs:   'var(--space-xs)',
        sm:   'var(--space-sm)',
        md:   'var(--space-md)',
        lg:   'var(--space-lg)',
        xl:   'var(--space-xl)',
        '2xl':'var(--space-2xl)',
        '3xl':'var(--space-3xl)',
        18:   '4.5rem',
        88:   '22rem',
        128:  '32rem',
      },

      backdropBlur: {
        xs:    '2px',
        glass: 'var(--glass-blur)',
      },

      transitionTimingFunction: {
        'ease-out':      'var(--ease-out)',
        'ease-soft':     'var(--ease-soft)',
        'ease-identity': 'var(--ease-identity)',
        'hisab':         'var(--hisab-ease)',
      },

      transitionDuration: {
        micro:  'var(--duration-micro)',
        short:  'var(--duration-short)',
        medium: 'var(--duration-medium)',
        long:   'var(--duration-long)',
      },

      zIndex: {
        dropdown:       'var(--z-dropdown)',
        sticky:         'var(--z-sticky)',
        fixed:          'var(--z-fixed)',
        'modal-backdrop':'var(--z-modal-backdrop)',
        modal:          'var(--z-modal)',
        popover:        'var(--z-popover)',
        tooltip:        'var(--z-tooltip)',
        toast:          'var(--z-toast)',
        fab:            'var(--z-fab)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config