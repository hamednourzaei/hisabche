// ============================================
// Which Intl locale to format numbers and dates with.
//
// `Intl.NumberFormat('fa-IR')` emits Persian digits (۱۲۳); `'en'` emits Latin
// (123). Components across the app hardcoded `'fa-AF'`/`'fa-IR'`, so switching
// the UI to English left every amount, count and date still rendered in
// Persian digits. Resolving from the active UI language fixes that at the
// source instead of per component.
// ============================================

/** UI language codes, as web (`fa`/`af`/`en`) and native (`fa-IR`/`fa-AF`) name them. */
export type UiLanguage = string | null | undefined

/**
 * Map a UI language to the locale its numbers and dates should use.
 *
 * Dari stays on `fa-AF` rather than collapsing to `fa-IR`: the two differ in
 * calendar and month names, not just digits.
 */
export function resolveIntlLocale(lang: UiLanguage): string {
  switch (lang) {
    case 'en':
    case 'en-US':
    case 'en-GB':
      return 'en'
    case 'af':
    case 'fa-AF':
      return 'fa-AF'
    case 'fa':
    case 'fa-IR':
      return 'fa-IR'
    default:
      return 'fa-IR'
  }
}

/**
 * True when the locale renders Latin digits.
 *
 * Useful where a caller needs to pick a font stack or letter-spacing that only
 * suits one numeral system.
 */
export function usesLatinDigits(lang: UiLanguage): boolean {
  return resolveIntlLocale(lang) === 'en'
}
