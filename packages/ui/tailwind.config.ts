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
      backdropBlur: {
        xs: '2px',
      },
      spacing: {
        18: '4.5rem',
        88: '22rem',
        128: '32rem',
      },
      transitionDuration: {
        DEFAULT: 'var(--hisab-duration)',
  hisab: 'var(--hisab-duration)',
      },
      transitionTimingFunction: {
  hisab: 'var(--hisab-ease-default)',
},
      animation: {
        'fade-in': 'fadeIn 200ms ease-in-out',
        'fade-in-slow': 'fadeIn 700ms ease-out',
        'slide-up': 'slideUp 200ms ease-out',
        'slide-up-cinematic': 'slideUpCinematic 700ms cubic-bezier(.2,.8,.2,1)',
        'slide-down': 'slideDown 200ms ease-out',
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 8s ease-in-out 2s infinite',
        'float-slow': 'float 10s ease-in-out 4s infinite',
        'pulse-glow': 'pulseGlow 4s ease-in-out infinite',
        'shimmer': 'shimmer 1.6s linear infinite',
        'mesh-shift': 'meshShift 18s ease infinite',
        'border-flow': 'borderFlow 8s linear infinite',
        'gradient-float': 'meshShift 12s ease infinite',
        'gradient-float-delayed': 'meshShift 15s ease 3s infinite',
        'gradient-float-slow': 'meshShift 20s ease 6s infinite',
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
        slideUpCinematic: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseGlow: {
          '0%,100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        meshShift: {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        borderFlow: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config