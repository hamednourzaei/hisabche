// ============================================
// backend/src/utils/money-units.ts
//
// Authoritative dimensional conversion between major decimal amounts and
// integer minor units across all supported currencies & precious metals.
// Zero floating-point multiplication on the money path.
// ============================================

import { FRACTION_DIGITS } from '@hisabche/formatting'

export function currencyDigits(currency: string): 0 | 2 | 3 {
  const code = currency.trim().toUpperCase()
  const digits = (FRACTION_DIGITS as Record<string, 0 | 2 | 3 | undefined>)[code]
  if (digits === undefined) {
    throw new Error(`UNSUPPORTED_CURRENCY_SCALE:${code}`)
  }
  return digits
}

export function currencyScale(currency: string): 1 | 100 | 1000 {
  const digits = currencyDigits(currency)
  return digits === 0 ? 1 : digits === 2 ? 100 : 1000
}

export function isKnownCurrencyCode(currency: string): boolean {
  const code = currency.trim().toUpperCase()
  return Object.prototype.hasOwnProperty.call(FRACTION_DIGITS, code)
}

/**
 * Convert a major-unit decimal value (number or numeric string) into exact
 * integer minor units for `currency`, rounding half-up only beyond `digits`.
 */
export function majorToMinor(value: number | string, currency: string): number {
  const digits = currencyDigits(currency)
  const raw =
    typeof value === 'number' ? (Number.isFinite(value) ? value.toString() : '') : value.trim()
  if (!raw) {
    throw new Error(`INVALID_MONEY_VALUE:${String(value)}`)
  }

  // Handle scientific notation safely if JS number stringified with e/E
  const normalized = /^[+-]?\d+(?:\.\d+)?$/.test(raw)
    ? raw
    : typeof value === 'number'
      ? value.toFixed(digits + 2)
      : ''

  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(normalized)
  if (!match) {
    throw new Error(`INVALID_MONEY_VALUE:${String(value)}`)
  }

  const sign = match[1] === '-' ? -1 : 1
  const intPart = match[2]!
  const fracPart = match[3] ?? ''

  const paddedFrac = fracPart.padEnd(digits + 1, '0')
  const keptFrac = digits === 0 ? '' : paddedFrac.slice(0, digits)
  const roundDigit = Number(paddedFrac[digits] ?? '0')

  let minor = Number(`${intPart}${keptFrac}`)
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`UNSAFE_INTEGER_MONEY:${raw}`)
  }
  if (roundDigit >= 5) {
    minor += 1
    if (!Number.isSafeInteger(minor)) {
      throw new Error(`UNSAFE_INTEGER_MONEY:${raw}`)
    }
  }
  return minor === 0 ? 0 : sign * minor
}

export function minorToMajor(minor: number, currency: string): number {
  if (!Number.isFinite(minor) || !Number.isInteger(minor)) {
    throw new Error(`INVALID_MINOR_UNIT:${String(minor)}`)
  }
  const scale = currencyScale(currency)
  return Number((minor / scale).toFixed(currencyDigits(currency)))
}

export function safeCurrencyDigits(currency: string): 0 | 2 | 3 {
  const code = currency.trim().toUpperCase()
  return (FRACTION_DIGITS as Record<string, 0 | 2 | 3 | undefined>)[code] ?? 2
}
