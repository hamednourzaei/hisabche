// packages/ui/src/lib/thousands.ts
//
// Shared thousand-separator formatting for money/price/amount/salary inputs.
// The DISPLAYED string gets ",", but the value handed back to callers via
// `unformatThousands` (and thus stored in component state / submitted to the
// API) is always the clean digit string — no separators, no currency
// symbols — so existing `Number(...)` / `parseFloat(...)` call sites keep
// working unchanged.

const PERSIAN_ZERO = 0x06f0
const ARABIC_ZERO = 0x0660

/**
 * Persian (۰-۹) and Arabic-Indic (٠-٩) digits -> Latin.
 *
 * ⚠️ FIX (data loss): this used to be absent, so `unformatThousands` stripped
 * non-Latin digits as "not a digit". Pasting "۱۲۳۴" into a money input
 * submitted "" instead of 1234, and typing a mixed "1۲3۴" submitted "13".
 * The user's own keyboard produces these digits.
 */
function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (ch) => {
    const code = ch.charCodeAt(0)
    const base = code >= PERSIAN_ZERO ? PERSIAN_ZERO : ARABIC_ZERO
    return String(code - base)
  })
}

/** Strip everything except digits and a single decimal point. */
export function unformatThousands(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return ''
  // Convert before stripping — never discard a digit just because of its script.
  const str = toLatinDigits(String(input))
  const cleaned = str.replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) return cleaned
  // Keep only the first decimal point; drop any extras the user typed.
  const intPart = cleaned.slice(0, firstDot)
  const decPart = cleaned.slice(firstDot + 1).replace(/\./g, '')
  return `${intPart}.${decPart}`
}

/** Format a clean (or dirty) numeric string with thousand separators. */
export function formatThousands(input: string | number | null | undefined): string {
  const raw = unformatThousands(input)
  if (!raw) return ''
  const [intPart, decPart] = raw.split('.')
  const grouped = (intPart || '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped
}
