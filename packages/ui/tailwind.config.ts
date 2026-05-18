import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../apps/web/src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../apps/mobile/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
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
      fontSize: {
        xs: 'var(--hisab-font-size-xs)',
        sm: 'var(--hisab-font-size-sm)',
        base: 'var(--hisab-font-size-base)',
        lg: 'var(--hisab-font-size-lg)',
        xl: 'var(--hisab-font-size-xl)',
      },
      boxShadow: {
        sm: 'var(--hisab-shadow-sm)',
        md: 'var(--hisab-shadow-md)',
        lg: 'var(--hisab-shadow-lg)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-in-out',
        'slide-up': 'slideUp 200ms ease-out',
        'slide-down': 'slideDown 200ms ease-out',
      },
      keyframes: {
        fadeIn: {
  '0%': { opacity: '0', transform: 'translateY(8px)' },
  '100%': { opacity: '1', transform: 'translateY(0)' },
},
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config