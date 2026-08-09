// ============================================
// Canonical money FORMATTING.
//
// ┌────────────────────────────────────────────────────────────────────────┐
// │ THIS FILE FORMATS. IT NEVER CALCULATES.                                │
// │                                                                        │
// │ Every function here takes a number and returns a STRING. None returns  │
// │ a number. That is the structural guarantee that a display formatter    │
// │ can never feed a rounded value back into an invoice total.             │
// │                                                                        │
// │ Financial arithmetic lives elsewhere and is untouched:                 │
// │   apps/desktop/src/features/sales/invoice-draft.ts  (lineTotal, …)     │
// │   packages/store/src/slices/currency.slice.ts       (convert)          │
// └────────────────────────────────────────────────────────────────────────┘
//
// Decimal policy (product decision, see
// documents/PHASE_2_STAGE_0_MONEY_FREEZE.md §9):
//   AFN, PKR, IRR -> 0 decimals
//   USD           -> 2 decimals
//   EUR           -> 2 decimals, FUTURE-COMPATIBILITY ONLY
//
// EUR IS NOT AN ACTIVE CURRENCY. `currencyCodeSchema` is
// z.enum(['AFN','USD','PKR','IRR']). The EUR entry below exists so the rule is
// already correct if EUR is ever introduced; it is unreachable through the
// active type and nothing in the product can select it.
// ============================================

/** The currencies the product actually supports today. */
export type ActiveCurrency = 'AFN' | 'USD' | 'PKR' | 'IRR'

/** Active currencies plus reserved future codes. Not selectable in the UI. */
export type KnownCurrency = ActiveCurrency | 'EUR'

export const FRACTION_DIGITS = {
  AFN: 0,
  PKR: 0,
  IRR: 0,
  USD: 2,
  EUR: 2,
} as const satisfies Record<KnownCurrency, 0 | 2>

export const CURRENCY_SIGN = {
  AFN: '؋',
  IRR: '﷼',
  USD: '$',
  PKR: '₨',
  EUR: '€',
} as const satisfies Record<KnownCurrency, string>

export function fractionDigits(currency: KnownCurrency): 0 | 2 {
  return FRACTION_DIGITS[currency]
}

export function currencySign(currency: KnownCurrency): string {
  return CURRENCY_SIGN[currency] ?? currency
}

/**
 * Grouped digits with the currency's decimal precision — no sign.
 * Falls back to a plain rounded string when Intl is unavailable (Hermes on
 * some Android builds ships a partial Intl).
 */
export function formatAmount(value: number, currency: KnownCurrency, locale: string): string {
  const digits = fractionDigits(currency)
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value)
  } catch {
    return value.toFixed(digits)
  }
}

/**
 * Amount followed by the currency sign, separated by a single ASCII space.
 *
 * Sign placement is AFTER the digits so the eye lands on the number first —
 * the treatment desktop and mobile already shipped. Intl's own
 * `style: 'currency'` is deliberately not used: it places the sign before the
 * digits, separates with U+00A0, and renders PKR/IRR as "PKR"/"ریال" rather
 * than ₨/﷼.
 */
export function formatMoney(value: number, currency: KnownCurrency, locale: string): string {
  return `${formatAmount(value, currency, locale)} ${currencySign(currency)}`
}

/** Grouped digits with no currency semantics — counts, quantities, percentages. */
export function formatNumber(value: number, locale: string, maximumFractionDigits = 0): string {
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value)
  } catch {
    return value.toFixed(maximumFractionDigits)
  }
}
