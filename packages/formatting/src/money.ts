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
// ---------------------------------------------------------------------------
// DECIMAL POLICY
//
// ⚠️ THIS LIST WAS FOUR CODES UNTIL THE OWNER OPENED IT (task T1).
//
// It was a deliberate, tested policy — `currency-policy.test.ts` pinned the
// enum and asserted EUR stayed absent from seven files. The four-code list was
// NOT leftover hardcoding, and the reason it held so long is in lesson 81.
//
// It was opened on an explicit product decision: the business trades metals,
// the catalogue in `packages/ui-contract` already listed 25 codes including
// the ISO 4217 metal codes, and onboarding was filtering all but four of them
// out. Adding rows in the database changed nothing, because the filter was
// this list.
//
// ⚠️ THE PRECISION TABLE IS WHY THIS COULD NOT BE A ONE-LINE CHANGE.
//
// §9 requires that an unknown code resolve to `undefined` rather than borrow
// another currency's precision. So widening the selectable set WITHOUT
// extending this table would produce money formatted with no precision
// contract at all — a wrong amount, not merely a missing option.
//
// Every code below therefore carries its real ISO 4217 minor-unit count:
//
//   0  AFN IRR IRT PKR JPY     written without minor units in practice
//   2  the ordinary case
//   3  IQD and the four metals
//
// ⚠️ METALS ARE PRICED BY WEIGHT. `XAU` here means «one gram of gold» as the
// unit of account, and three decimals is one milligram. Treating a metal as a
// two-decimal currency would round every gold invoice to the centigram.
// ---------------------------------------------------------------------------

/** The currencies the product actually supports today. */
export type ActiveCurrency =
  // ─── Region ───
  | 'AFN'
  | 'IRT'
  | 'IRR'
  | 'PKR'
  | 'INR'
  | 'TRY'
  | 'AED'
  | 'SAR'
  | 'IQD'
  | 'TJS'
  | 'UZS'
  | 'TMT'
  | 'CNY'
  | 'RUB'
  // ─── Major ───
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'CHF'
  | 'JPY'
  | 'CAD'
  | 'AUD'
  // ─── Precious metals (ISO 4217 X-codes), priced by weight ───
  | 'XAU'
  | 'XAG'
  | 'XPT'
  | 'XPD'

/**
 * Active currencies plus any reserved future codes.
 *
 * Nothing is reserved right now — every known code is selectable. The alias
 * stays so the many call sites that use it do not all have to change, and so
 * a future reserved code has somewhere to go.
 */
export type KnownCurrency = ActiveCurrency

/** ISO 4217 minor-unit digits. See the policy note above. */
export const FRACTION_DIGITS = {
  // Written without minor units.
  AFN: 0,
  IRT: 0,
  IRR: 0,
  PKR: 0,
  JPY: 0,

  // The ordinary case.
  INR: 2,
  TRY: 2,
  AED: 2,
  SAR: 2,
  TJS: 2,
  UZS: 2,
  TMT: 2,
  CNY: 2,
  RUB: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  CHF: 2,
  CAD: 2,
  AUD: 2,

  // Three minor units. IQD is ISO; the metals are grams to the milligram.
  IQD: 3,
  XAU: 3,
  XAG: 3,
  XPT: 3,
  XPD: 3,
} as const satisfies Record<KnownCurrency, 0 | 2 | 3>

export const CURRENCY_SIGN = {
  AFN: '؋',
  IRT: 'ت',
  IRR: '﷼',
  PKR: '₨',
  INR: '₹',
  TRY: '₺',
  AED: 'د.إ',
  SAR: '﷼',
  IQD: 'ع.د',
  TJS: 'ЅМ',
  UZS: "so'm",
  TMT: 'm',
  CNY: '¥',
  RUB: '₽',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CHF: 'CHF',
  JPY: '¥',
  CAD: '$',
  AUD: '$',
  // Metals have no currency symbol. The unit is a gram, and saying so is
  // clearer than borrowing a glyph that means something else.
  XAU: 'g',
  XAG: 'g',
  XPT: 'g',
  XPD: 'g',
} as const satisfies Record<KnownCurrency, string>

export function fractionDigits(currency: KnownCurrency): 0 | 2 | 3 {
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
