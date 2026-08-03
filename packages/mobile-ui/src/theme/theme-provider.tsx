// ============================================
// ThemeProvider — colour scheme + writing direction.
// Dark is the base theme, matching the web design system.
// ============================================

import React, { createContext, useContext, useMemo } from 'react'
import { I18nManager, useColorScheme } from 'react-native'

import { darkColors, lightColors, type ColorScheme } from '../tokens/colors'
import { duration, elevation, radius, spacing } from '../tokens/layout'
import { fontFamily, fontSize, typography } from '../tokens/typography'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface Theme {
  colors: ColorScheme
  spacing: typeof spacing
  radius: typeof radius
  elevation: typeof elevation
  duration: typeof duration
  typography: typeof typography
  fontFamily: typeof fontFamily
  fontSize: typeof fontSize
  isDark: boolean
  isRTL: boolean
}

const ThemeContext = createContext<Theme | null>(null)

function resolveIsDark(mode: ThemeMode, system: 'light' | 'dark'): boolean {
  if (mode === 'system') return system === 'dark'
  return mode === 'dark'
}

export interface ThemeProviderProps {
  mode?: ThemeMode | undefined
  children: React.ReactNode
}

export function ThemeProvider({ mode = 'system', children }: ThemeProviderProps) {
  // Dark-first: an unknown system preference resolves to dark, not light.
  const systemScheme = useColorScheme() === 'light' ? 'light' : 'dark'
  const isDark = resolveIsDark(mode, systemScheme)

  const value = useMemo<Theme>(
    () => ({
      colors: isDark ? darkColors : lightColors,
      spacing,
      radius,
      elevation,
      duration,
      typography,
      fontFamily,
      fontSize,
      isDark,
      isRTL: I18nManager.isRTL,
    }),
    [isDark]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext)
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>')
  return theme
}
