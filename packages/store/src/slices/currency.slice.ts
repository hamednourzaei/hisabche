// ============================================
// Currency Slice — Zustand
// ============================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { CURRENCY_CODES } from '@hisabche/validation'

// ============================================
// Types
// ============================================
/**
 * ⚠️ IMPORTED, NOT RESTATED.
 *
 * This was its own union — `'AFN' | 'USD' | 'PKR' | 'IRR'` — kept in step with
 * `currencyCodeSchema` by hand. `@hisabche/store` already depends on
 * `@hisabche/validation`, so there was never a reason for a second copy, and a
 * second copy of a list is a list that will disagree.
 *
 * The schema is the single source. Everything here derives from it.
 */
export type CurrencyCode = (typeof CURRENCY_CODES)[number]

/**
 * The codes the product can honour end-to-end.
 *
 * Onboarding filters `CURRENCIES` (the 25-entry catalogue in
 * `packages/ui-contract`) through `isSupportedCurrency`. Until task T1 that
 * filter reduced 25 to 4, which is why currencies added to the DATABASE never
 * appeared: the filter was a hardcoded array, not a query.
 */
export const SUPPORTED_CURRENCIES = CURRENCY_CODES

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(code)
}

export interface ExchangeRate {
  code: CurrencyCode
  rate: number // Rate relative to AFN (base currency)
  lastUpdated: string
  /** Entered by the user (request #92). Only these are shown as real conversions. */
  manual?: boolean
}

export interface CurrencyState {
  // State
  primaryCurrency: CurrencyCode
  secondaryCurrency: CurrencyCode | null
  /**
   * ⚠️ PARTIAL, AND THAT IS THE TRUTH.
   *
   * The product has rates for four currencies and knows nothing about the
   * other twenty-one. Typing this as a full Record claimed otherwise and only
   * held while the currency list was four long.
   */
  rates: Partial<Record<CurrencyCode, ExchangeRate>>
  isLoadingRates: boolean
  ratesError: string | null

  // Actions
  /**
   * What amounts are DISPLAYED in — null means «the workspace's own currency».
   *
   * ⚠️ Distinct from `primaryCurrency`, and conflating them would be a data
   * bug rather than a display one. `primaryCurrency` is what the books are
   * kept in: it decides what a new invoice is denominated in and what a stored
   * amount MEANS. This decides only what the screen renders, and changing it
   * must never change a stored figure.
   *
   * A jeweller reads today's takings in grams and still invoices in afghanis.
   * See `useDisplayBasis` (T10).
   */
  displayBasis: CurrencyCode | null
  setDisplayBasis: (code: CurrencyCode | null) => void
  setPrimaryCurrency: (code: CurrencyCode) => void
  setSecondaryCurrency: (code: CurrencyCode | null) => void
  fetchRates: () => Promise<void>
  /**
   * The user's own rate: how many AFN one unit of `code` is worth. `null`
   * removes it. Stored as the slice's AFN-relative rate (1 / afnPerUnit).
   */
  setManualRate: (code: CurrencyCode, afnPerUnit: number | null) => void
  /** `null` when either rate is unknown. Never a guess. */
  convertAmount: (amount: number, from: CurrencyCode, to: CurrencyCode) => number | null
}

// ============================================
// Default rates (offline fallback)
// ============================================
/**
 * ⚠️ THESE ARE THE ONLY RATES THAT EXIST, AND THEY ARE A STUB.
 *
 * `fetchRates` below is still a TODO with a hardcoded delay — no rate API is
 * called. So these four are offline placeholders, and the other twenty-one
 * currencies have no rate at all.
 *
 * Nothing is invented for the rest. A made-up rate turns a visibly missing
 * conversion into a confidently wrong amount, which is far harder to notice.
 */
const defaultRates: Partial<Record<CurrencyCode, ExchangeRate>> = {
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
      // Null, not a copy of `primaryCurrency`: «not chosen» must stay
      // distinguishable from «chose their own currency», or a later change to
      // the workspace currency would leave the display pinned to the old one.
      displayBasis: null,
      rates: defaultRates,
      isLoadingRates: false,
      ratesError: null,

      // Set primary currency
      setPrimaryCurrency: (code: CurrencyCode) => {
        set({ primaryCurrency: code })
      },

      setDisplayBasis: (code: CurrencyCode | null) => {
        set({ displayBasis: code })
      },

      // Set secondary currency
      setSecondaryCurrency: (code: CurrencyCode | null) => {
        set({ secondaryCurrency: code })
      },

      setManualRate: (code, afnPerUnit) => {
        set((state) => {
          const rates = { ...state.rates }
          if (afnPerUnit === null || !Number.isFinite(afnPerUnit) || afnPerUnit <= 0) {
            delete rates[code]
          } else {
            rates[code] = {
              code,
              rate: code === 'AFN' ? 1 : 1 / afnPerUnit,
              lastUpdated: new Date().toISOString(),
              manual: true,
            }
          }
          return { rates }
        })
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
          // A rate the user typed is never replaced by a placeholder.
          const manual = Object.fromEntries(
            Object.entries(get().rates).filter(([, rate]) => rate?.manual),
          )
          set({
            rates: {
              ...defaultRates,
              ...manual,
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
      convertAmount: (amount: number, from: CurrencyCode, to: CurrencyCode): number | null => {
        const rates = get().rates
        const fromRate = rates[from]?.rate
        const toRate = rates[to]?.rate

        // ⚠️ REFUSES, rather than returning the amount unconverted.
        //
        // This used to `return amount` with a console warning — so 100 USD
        // came back as 100 and was then displayed as 100 AFN. A wrong figure
        // that looks like a right one.
        //
        // It never fired while the product had four currencies and rates for
        // all four. Opening the list to twenty-five made it reachable for
        // twenty-one of them, which is why it is fixed here rather than left.
        if (!fromRate || !toRate) return null

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
        displayBasis: state.displayBasis,
      }),
    },
  ),
)
