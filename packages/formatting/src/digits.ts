// ============================================
// Digit shaping and numeric-input parsing.
//
// `parseNumericInput` fixes a real data-loss bug found during the Stage 0
// freeze: web's `unformatThousands` DISCARDS Persian/Arabic digits instead of
// converting them, so pasting "۱۲۳۴" into a money field submitted "" and
// "1۲3۴" submitted "13".
//
// This module is the correct implementation. It is NOT yet wired into the web
// inputs — swapping it in changes submitted values, so it is a deliberate,
// separately reviewable change. See the Stage 4 document.
// ============================================

const PERSIAN_ZERO = 0x06f0
const ARABIC_ZERO = 0x0660
const LATIN_DIGITS = '0123456789'

/** Latin digits -> Persian (Extended Arabic-Indic). Display only. */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => String.fromCharCode(PERSIAN_ZERO + Number(d)))
}

/** Latin digits -> Arabic-Indic. Display only. */
export function toArabicDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => String.fromCharCode(ARABIC_ZERO + Number(d)))
}

/** Persian and Arabic-Indic digits -> Latin. The inverse of the two above. */
export function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (ch) => {
    const code = ch.charCodeAt(0)
    const base = code >= PERSIAN_ZERO ? PERSIAN_ZERO : ARABIC_ZERO
    return LATIN_DIGITS[code - base]!
  })
}

/**
 * Normalise arbitrary user input to a clean numeric string safe for `Number()`.
 * Unlike the legacy web helper this CONVERTS non-Latin digits rather than
 * dropping them, and it preserves a leading minus sign.
 *
 * Returns "" when the input holds no digits.
 */
export function parseNumericInput(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return ''

  const latin = toLatinDigits(String(input))
  const negative = hasLeadingMinus(latin)
  const cleaned = latin.replace(/[^\d.]/g, '')
  const normalised = keepFirstDecimalPoint(cleaned)

  if (!normalised) return ''
  return negative ? `-${normalised}` : normalised
}

/**
 * True when a minus sign appears before the first digit — so "؋ -1,234" and
 * "-1234" are both negative, but "1234-" is not. Accepts the ASCII hyphen and
 * the U+2212 MINUS SIGN that Intl emits.
 */
function hasLeadingMinus(text: string): boolean {
  const firstDigit = text.search(/\d/)
  if (firstDigit === -1) return false
  return /[-−]/.test(text.slice(0, firstDigit))
}

function keepFirstDecimalPoint(cleaned: string): string {
  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) return cleaned
  const whole = cleaned.slice(0, firstDot)
  const fraction = cleaned.slice(firstDot + 1).replace(/\./g, '')
  return `${whole}.${fraction}`
}

/** Group a clean numeric string with commas, preserving sign and decimals. */
export function groupThousands(input: string | number | null | undefined): string {
  const raw = parseNumericInput(input)
  if (!raw) return ''

  const negative = raw.startsWith('-')
  const [whole, fraction] = raw.replace('-', '').split('.')
  const grouped = (whole ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const body = fraction !== undefined ? `${grouped}.${fraction}` : grouped

  return negative ? `-${body}` : body
}
