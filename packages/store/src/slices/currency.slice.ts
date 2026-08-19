// ============================================
// Currency Slice — Zustand
// ============================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ============================================
// Types
// ============================================
export type CurrencyCode = 'AFN' | 'USD' | 'PKR' | 'IRR'

/**
 * The codes the product can actually honour end-to-end — they match
 * `currencyCodeSchema` in `packages/validation`, which the backend enforces on
 * every invoice and transaction.
 *
 * The onboarding step offers a much wider catalogue (`CURRENCIES` in
 * `packages/ui-contract`: IRT, TRY, INR, XAU …). Those extra codes cannot be
 * stored on an invoice today. Selecting one used to be written straight into
 * this store through an unchecked `as CurrencyCode` cast, and every formatter
 * then fell through `CONFIG[code] || CONFIG.AFN` — so a shopkeeper who chose
 * تومان was shown افغانی. Narrowing through this guard makes the mismatch
 * explicit instead of silent.
 */
export const SUPPORTED_CURRENCIES = ['AFN', 'USD', 'PKR', 'IRR'] as const

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code)
}

export interface ExchangeRate {
  code: CurrencyCode
  rate: number // Rate relative to AFN (base currency)
  lastUpdated: string
}

export interface CurrencyState {
  // State
  primaryCurrency: CurrencyCode
  secondaryCurrency: CurrencyCode | null
  rates: Record<CurrencyCode, ExchangeRate>
  isLoadingRates: boolean
  ratesError: string | null

  // Actions
  setPrimaryCurrency: (code: CurrencyCode) => void
  setSecondaryCurrency: (code: CurrencyCode | null) => void
  fetchRates: () => Promise<void>
  convertAmount: (amount: number, from: CurrencyCode, to: CurrencyCode) => number
}

// ============================================
// Default rates (offline fallback)
// ============================================
const defaultRates: Record<CurrencyCode, ExchangeRate> = {
  AFN: { code: 'AFN', rate: 1, lastUpdated: new Date().toISOString() },
  USD: { code: 'USD', rate: 0.014, lastUpdated: new Date().toISOString() },
  PKR: { code: 'PKR', rate: 3.9, lastUpdated: new Date().toISOString() },
  IRR: { code: 'IRR', rate: 600, lastUpdated: new Date().toISOString() },
}

// ============================================
// Store
// ============================================
export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      // Initial state
      primaryCurrency: 'AFN',
      secondaryCurrency: 'USD',
      rates: defaultRates,
      isLoadingRates: false,
      ratesError: null,

      // Set primary currency
      setPrimaryCurrency: (code: CurrencyCode) => {
        set({ primaryCurrency: code })
      },

      // Set secondary currency
      setSecondaryCurrency: (code: CurrencyCode | null) => {
        set({ secondaryCurrency: code })
      },

      // Fetch live rates
      fetchRates: async () => {
        set({ isLoadingRates: true, ratesError: null })
        try {
          // TODO: Replace with actual exchange rate API
          // const response = await fetch('https://api.exchangerate-api.com/v4/latest/AFN')
          // const data = await response.json()

          await new Promise((resolve) => setTimeout(resolve, 500))

          // For now, keep default rates
          set({
            rates: {
              ...defaultRates,
            },
            isLoadingRates: false,
            ratesError: null,
          })
        } catch (err) {
          set({
            isLoadingRates: false,
            ratesError: err instanceof Error ? err.message : 'Failed to fetch rates',
          })
        }
      },

      // Convert amount between currencies
      convertAmount: (amount: number, from: CurrencyCode, to: CurrencyCode): number => {
        const rates = get().rates
        const fromRate = rates[from]?.rate
        const toRate = rates[to]?.rate

        if (!fromRate || !toRate) {
          console.warn(`Missing exchange rate for ${from} or ${to}`)
          return amount
        }

        // Convert to AFN first (base), then to target
        const amountInAFN = amount / fromRate
        return amountInAFN * toRate
      },
    }),
    {
      name: 'hisabche-currency',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        primaryCurrency: state.primaryCurrency,
        secondaryCurrency: state.secondaryCurrency,
        rates: state.rates,
      }),
    },
  ),
)
