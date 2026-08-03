// ============================================
// Device preferences — currency + theme mode.
// Persisted through the same SecureStore backend as the session.
// ============================================

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ThemeMode } from '@hisabche/mobile-ui'
import type { CurrencyCode } from '@hisabche/store'

import { secureBackend } from '../../shared/lib/storage'

export interface PreferencesState {
  currency: CurrencyCode
  themeMode: ThemeMode
  biometricEnabled: boolean
  setCurrency: (currency: CurrencyCode) => void
  setThemeMode: (mode: ThemeMode) => void
  setBiometricEnabled: (enabled: boolean) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      currency: 'AFN',
      themeMode: 'system',
      biometricEnabled: false,
      setCurrency: (currency) => set({ currency }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setBiometricEnabled: (biometricEnabled) => set({ biometricEnabled }),
    }),
    {
      name: 'hisabche.preferences',
      storage: createJSONStorage(() => ({
        getItem: (key) => secureBackend.get(key),
        setItem: (key, value) => secureBackend.set(key, value),
        removeItem: (key) => secureBackend.remove(key),
      })),
    }
  )
)

export const useCurrency = (): CurrencyCode => usePreferencesStore((s) => s.currency)
