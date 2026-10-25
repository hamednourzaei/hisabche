// ============================================
// packages/validation/src/schemas/currency-catalogue.ts
//
// The currency reference list the pickers offer.
//
// ⚠️ ONLY WHAT THE PRODUCT CAN FORMAT. The server's `currencies` table holds 162
// codes; the product can format the ones in `CURRENCY_CODES`. A picker showing
// all of them would let someone select a code with no precision contract, which
// produces a WRONG AMOUNT rather than a missing option. This list is the
// code's own — the same one the server falls back to when its table is absent —
// and the device, which carries no reference table, serves exactly it.
// ============================================

import { CURRENCY_CODES } from './common.schema'

export interface CurrencyRecord {
  code: string
  name: string
  nameFa: string | null
  symbol: string | null
  /** ISO 4217 minor units. */
  decimalPlaces: number
  isActive: boolean
}

/**
 * Code only, with the precision left to the client's own `FRACTION_DIGITS`.
 * Inventing names and symbols here would be a second copy of reference data to
 * keep in step; the `2` is never used for formatting, only to satisfy the shape.
 */
export function fallbackCurrencyList(): CurrencyRecord[] {
  return CURRENCY_CODES.map((code) => ({
    code,
    name: code,
    nameFa: null,
    symbol: null,
    decimalPlaces: 2,
    isActive: true,
  }))
}
