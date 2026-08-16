// ============================================
// The Intl locale for the active UI language.
//
// Components used to hardcode 'fa-AF'/'fa-IR' when formatting, so numbers and
// dates stayed in Persian digits after switching the interface to English.
// Reading the locale here keeps every renderer consistent — desktop resolves
// the same value through its next-intl shim.
// ============================================

'use client'

import { useLocale } from 'next-intl'
import { resolveIntlLocale, usesLatinDigits } from '@hisabche/formatting'

/** e.g. `fa-IR`, `fa-AF`, `en` — ready to hand to `Intl.*`. */
export function useIntlLocale(): string {
  return resolveIntlLocale(useLocale())
}

/** True when the active language renders Latin digits. */
export function useLatinDigits(): boolean {
  return usesLatinDigits(useLocale())
}
