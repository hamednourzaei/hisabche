// ============================================
// UI shell state — sidebar, command palette, global search focus.
// Persisted through the same secure storage as the session.
// ============================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CurrencyCode } from '@/shared/lib/currency'

import { bridge } from '@/shared/lib/bridge'

export interface UiState {
  sidebarCollapsed: boolean
  paletteOpen: boolean
  currency: CurrencyCode
  searchRequestId: number

  toggleSidebar: () => void
  /** Set it outright — the collapsed rail expands itself when a group is clicked. */
  setSidebarCollapsed: (collapsed: boolean) => void
  setPaletteOpen: (open: boolean) => void
  setCurrency: (currency: CurrencyCode) => void
  /** Bumped by Ctrl+F so the active page focuses its search field. */
  requestSearchFocus: () => void
}

const backend = {
  getItem: (key: string) => bridge()?.secure.get(key) ?? Promise.resolve(null),
  setItem: async (key: string, value: string) => {
    await bridge()?.secure.set(key, value)
  },
  removeItem: async (key: string) => {
    await bridge()?.secure.delete(key)
  },
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      paletteOpen: false,
      currency: 'AFN',
      searchRequestId: 0,

      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      setCurrency: (currency) => set({ currency }),
      requestSearchFocus: () => set((state) => ({ searchRequestId: state.searchRequestId + 1 })),
    }),
    {
      name: 'hisabche.desktop.ui',
      storage: createJSONStorage(() => backend),
      // Transient flags must not survive a restart.
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        currency: state.currency,
      }),
    },
  ),
)

export const useCurrency = (): CurrencyCode => useUiStore((s) => s.currency)
