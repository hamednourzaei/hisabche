// ============================================
// packages/api/src/hooks/currencies.ts
//
// PATCH 1 / L0.1 — the currency reference list.
//
// ⚠️ THE SERVER ALREADY FILTERED THIS TO WHAT THE PRODUCT SUPPORTS.
//
// `GET /api/currencies` returns active rows only. The table holds 162; the
// product can format 25. A picker showing all of them would let someone select
// a code with no precision contract in `FRACTION_DIGITS`, which produces a
// WRONG AMOUNT rather than a missing option (rule 9).
//
// So this hook does no filtering of its own — adding a second filter here
// would be a second place for the policy to drift.
// ============================================

import { useQuery } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'

export interface CurrencyRecord {
  code: string
  name: string
  nameFa: string | null
  symbol: string | null
  /** ISO 4217 minor units. */
  decimalPlaces: number
  isActive: boolean
}

export interface CurrenciesResponse {
  currencies: CurrencyRecord[]
  /**
   * 'fallback' means the server served the code's own list because the
   * `currencies` table is absent on that environment. Surfaced rather than
   * hidden — the same reasoning as `/api/units`.
   */
  source: 'table' | 'fallback'
}

export const currencyRefKeys = {
  all: ['currencies'] as const,
  list: () => [...currencyRefKeys.all, 'list'] as const,
}

export function useCurrencies() {
  const ready = useAuthReady()

  return useQuery({
    queryKey: currencyRefKeys.list(),
    queryFn: async (): Promise<CurrenciesResponse> => {
      const { data } = await apiClient.get('/currencies')
      return data as CurrenciesResponse
    },
    enabled: ready,
    // Reference data. It cannot change during a session.
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })
}
