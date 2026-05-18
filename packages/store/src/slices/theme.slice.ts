// ============================================
// Theme Slice — Zustand
// ============================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ============================================
// Types
// ============================================
export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeState {
  // State
  mode: ThemeMode
  isDark: boolean

  // Actions
  setMode: (mode: ThemeMode) => void
  toggle: () => void
}

// ============================================
// Helpers
// ============================================
function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'system') return getSystemPreference() === 'dark'
  return mode === 'dark'
}

function applyTheme(isDark: boolean): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', isDark)
  root.style.colorScheme = isDark ? 'dark' : 'light'
}

// ============================================
// Store
// ============================================
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      // Initial state
      mode: 'system',
      isDark: false,

      // Set mode
      setMode: (mode: ThemeMode) => {
        const isDark = resolveIsDark(mode)
        applyTheme(isDark)
        set({ mode, isDark })

        // Listen for system changes if mode is 'system'
        if (mode === 'system' && typeof window !== 'undefined') {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
          const handler = (e: MediaQueryListEvent) => {
            applyTheme(e.matches)
            set({ isDark: e.matches })
          }
          mediaQuery.addEventListener('change', handler)
        }
      },

      // Toggle
      toggle: () => {
        const current = get()
        const newIsDark = !current.isDark
        const newMode: ThemeMode = newIsDark ? 'dark' : 'light'
        applyTheme(newIsDark)
        set({ mode: newMode, isDark: newIsDark })
      },
    }),
    {
      name: 'hisabche-theme',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const isDark = resolveIsDark(state.mode)
          applyTheme(isDark)
          state.isDark = isDark
        }
      },
    },
  ),
)