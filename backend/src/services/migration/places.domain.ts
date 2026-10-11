// ============================================
// backend/src/services/migration/places.domain.ts
//
// Where, and in what money: the warehouse, the branch and the currency a file
// names — matched to the ones this business really has.
//
// A spreadsheet says «انبار مرکزی» or «Kabul branch» or «تومان»; the product
// needs an id and a currency code. The rule is the one the rest of the
// importer keeps: exactly one match is a match, and anything else is said out
// loud. A warehouse is never created because a file mentioned it, and a
// currency is never assumed because a number had no label.
//
// Pure: names and lists in, ids or reasons out.
// ============================================

import { comparisonKey } from './migration.domain'

export interface NamedPlace {
  id: string
  name: string
}

export type PlaceMatch = { id: string } | { reason: 'UNKNOWN' | 'AMBIGUOUS' }

export function matchPlace(name: string, places: readonly NamedPlace[]): PlaceMatch {
  const key = comparisonKey(name)
  const hits = places.filter((place) => comparisonKey(place.name) === key)
  if (hits.length === 1) return { id: (hits[0] as NamedPlace).id }
  return { reason: hits.length === 0 ? 'UNKNOWN' : 'AMBIGUOUS' }
}

/**
 * Which warehouse a quantity of stock goes into.
 *
 *   • the file names one → it must be one of this business's;
 *   • it names none and there is exactly one warehouse → that one;
 *   • it names none and there are SEVERAL → refused. Stock that belongs to no
 *     warehouse shows on the product and in no building, and a later sale
 *     takes it from a building it was never put in.
 *   • the business has no warehouses at all → none (it does not use them).
 */
export function stockWarehouseFor(
  named: string,
  warehouses: readonly NamedPlace[],
): { warehouseId: string | null } | { code: string } {
  if (named.trim() !== '') {
    const match = matchPlace(named, warehouses)
    if ('id' in match) return { warehouseId: match.id }
    return { code: match.reason === 'UNKNOWN' ? 'WAREHOUSE_UNKNOWN' : 'WAREHOUSE_AMBIGUOUS' }
  }
  if (warehouses.length === 0) return { warehouseId: null }
  if (warehouses.length === 1) return { warehouseId: (warehouses[0] as NamedPlace).id }
  return { code: 'WAREHOUSE_REQUIRED' }
}

/* ─── Currency ────────────────────────────────────────────────────────────── */

// What people write in a «currency» cell, and the code it means. Only words
// that can mean ONE thing are here: «دلار» alone is not (US, Canadian,
// Australian), so it is not guessed.
const CURRENCY_WORDS: Record<string, string> = {
  afn: 'AFN',
  afs: 'AFN',
  af: 'AFN',
  افغانی: 'AFN',
  '؋': 'AFN',
  irt: 'IRT',
  toman: 'IRT',
  تومان: 'IRT',
  تومن: 'IRT',
  irr: 'IRR',
  rial: 'IRR',
  ریال: 'IRR',
  '﷼': 'IRR',
  usd: 'USD',
  'us dollar': 'USD',
  'دلار آمریکا': 'USD',
  'دلار امریکا': 'USD',
  eur: 'EUR',
  euro: 'EUR',
  یورو: 'EUR',
  '€': 'EUR',
  pkr: 'PKR',
  کلدار: 'PKR',
  aed: 'AED',
  درهم: 'AED',
  try: 'TRY',
  لیر: 'TRY',
  inr: 'INR',
  gbp: 'GBP',
  پوند: 'GBP',
  '£': 'GBP',
}

/**
 * A currency cell as a code this product supports, or null.
 *
 * `supported` is the product's own list — passed in rather than imported, so
 * this file decides nothing about which currencies exist.
 */
export function currencyCodeOf(raw: string, supported: readonly string[]): string | null {
  const text = raw.trim()
  if (text === '') return null
  const upper = text.toUpperCase()
  if (supported.includes(upper)) return upper
  const word = CURRENCY_WORDS[comparisonKey(text)] ?? CURRENCY_WORDS[text]
  return word && supported.includes(word) ? word : null
}
