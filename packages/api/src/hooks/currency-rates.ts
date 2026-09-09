// ============================================
// packages/api/src/hooks/currency-rates.ts
//
// Exchange rates — TanStack Query.
//
// ---------------------------------------------------------------------------
// T10 — THE READER THE RATE TABLE NEVER HAD
//
// `exchange_rates` exists, is workspace-scoped, is keyed by `rate_date` (the
// rate FOR a day, not the day the row was touched), and is served by
// `GET /currency/rates` with `PUT` to set one. `CurrencyService` reads it for
// revaluation. All of it works.
//
// The CLIENT had none of it. `useCurrencyStore` carried four hardcoded rates
// and a `fetchRates` marked `// TODO: Replace with actual exchange rate API`
// that no component ever called. So the product had a real rate table and a
// disconnected stub in front of it — the same shape as the currency list in T1
// and the units table in T2.
//
// ---------------------------------------------------------------------------
// ⚠️ A MISSING RATE IS A RESULT, NOT AN ERROR TO PAPER OVER
//
// Nothing here invents a rate. There is no fallback, no «approximately», no
// last-known value quietly reused past its date. A pair with no rate returns
// null and the UI says so.
//
// The reason is specific to money: a converted amount looks exactly like a
// real one. A missing conversion is visible and someone fixes it; a guessed
// conversion is a confidently wrong number on a dashboard, and it is wrong by
// however far the guess was off.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'

export interface RateQuote {
  /** ISO 4217 code this quote is for. */
  currency: string
  /**
   * Units of the workspace's BASE currency per one unit of `currency`.
   *
   * So for a shop keeping books in AFN, `XAU` at 8_500 means one gram of gold
   * is 8,500 AFN — and 15,000,000 AFN is 15_000_000 / 8_500 grams.
   */
  rate: number
  /** The day this rate is FOR. `YYYY-MM-DD`. */
  onDate: string
}

export const rateKeys = {
  all: ['currency-rates'] as const,
  list: (currency?: string) => [...rateKeys.all, currency ?? 'all'] as const,
}

export function useExchangeRates(currency?: string) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: rateKeys.list(currency),
    queryFn: async (): Promise<RateQuote[]> => {
      // ⚠️ `/finance/currency/rates`, NOT `/currency/rates`.
      //
      // These handlers live in `finance-ops.routes.ts`, which
      // `backend/src/index.ts` registers with `{ prefix: '/api/finance' }`.
      // Both calls here were missing that segment, so every one of them 404ed
      // in production — silently, because the query returns `[]` on failure
      // and «no rates yet» looks exactly like «the endpoint does not exist».
      //
      // Every other finance hook in this directory already writes the prefix;
      // see `assets.ts` and `bank.ts`.
      const { data } = await apiClient.get('/finance/currency/rates', {
        params: currency ? { currency } : {},
      })
      // ═══════════════════════════════════════════════════════════════════
      // ⚠️ `as RateQuote[]` WAS A LIE, AND IT CRASHED THE DESKTOP APP.
      //
      //     TypeError: (quotes ?? []) is not iterable
      //
      // `??` only substitutes for `null`/`undefined`. Anything else the
      // endpoint returns — an error envelope, a wrapped payload, an HTML page
      // from a misrouted request — passes straight through with the shape of
      // an array asserted over it, and the first `for (const quote of quotes)`
      // in `use-display-basis.ts` throws. On desktop that took the whole
      // dashboard down through the router's error boundary.
      //
      // ⚠️ MY OWN PREFIX FIX ABOVE IS WHAT EXPOSED IT. While the path 404ed,
      // the query always errored, `data` was `undefined`, and `?? []` covered
      // it. Correcting the path let a real response through for the first
      // time — which is exactly when a wrong assumption about its shape
      // becomes a crash.
      //
      // A cast is not a check. This is the check.
      // ═══════════════════════════════════════════════════════════════════
      return Array.isArray(data) ? (data as RateQuote[]) : []
    },
    enabled: ready,
    // Rates change during a trading day, but not every thirty seconds, and a
    // stale-by-minutes rate on a DISPLAY toggle is not a correctness problem —
    // the books are never valued from this cache.
    staleTime: 5 * 60 * 1000,
  })
}

export function useSetExchangeRate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { currency: string; rate: number; onDate: string }) => {
      // Same missing prefix as the read above — saving a rate 404ed too.
      const { data } = await apiClient.put('/finance/currency/rates', input)
      return data as RateQuote
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rateKeys.all })
    },
  })
}

/**
 * The rate for a currency ON OR BEFORE a date — never a later one.
 *
 * Mirrors `rateFor` in the backend's revaluation domain deliberately: valuing
 * a past event with information nobody had at the time is what makes a figure
 * impossible to defend, and the client must not do it either just because it
 * happens to have tomorrow's quote cached.
 */
export function rateOn(
  quotes: readonly RateQuote[],
  currency: string,
  onDate: string,
): number | null {
  const usable = quotes
    .filter((quote) => quote.currency === currency && quote.onDate <= onDate)
    .sort((a, b) => b.onDate.localeCompare(a.onDate))

  const best = usable[0]
  return best && best.rate > 0 ? best.rate : null
}

/**
 * Convert between two currencies through the workspace's base currency.
 *
 * ⚠️ Returns `null` whenever either leg is unknown. It never falls back to the
 * unconverted amount: returning `amount` unchanged means «100 USD» is rendered
 * as «100 AFN», which is a wrong figure wearing the shape of a right one.
 */
export function convertVia(
  amount: number,
  from: string,
  to: string,
  base: string,
  quotes: readonly RateQuote[],
  onDate: string,
): number | null {
  if (from === to) return amount

  // `rate` is base-per-unit, so the base currency itself is 1 by definition and
  // needs no row in the table.
  const fromRate = from === base ? 1 : rateOn(quotes, from, onDate)
  const toRate = to === base ? 1 : rateOn(quotes, to, onDate)

  if (fromRate === null || toRate === null) return null

  const inBase = amount * fromRate
  return inBase / toRate
}
