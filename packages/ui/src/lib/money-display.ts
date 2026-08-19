// ============================================
// packages/ui/src/lib/money-display.ts
//
// Money formatting for the handful of helpers that run OUTSIDE React and so
// cannot call `useCurrency` / `useIntlLocale` — the `fmt` used by the
// dashboard, customers and warehouse views.
//
// Each of those three files carried its own copy of this table:
//
//   AFN: { locale: "fa-AF", decimals: 0 }, USD: { locale: "en-US", ... }
//   const config = CONFIG[currency] || CONFIG.AFN
//
// which was wrong twice over. The locale was derived from the CURRENCY, so the
// reader's language was ignored — an English interface showed Persian digits
// whenever the shop was on AFN. And the `|| CONFIG.AFN` fallback rendered any
// unrecognised code as افغانی rather than saying it did not know.
//
// Precision now comes from `@hisabche/formatting`, the single money contract
// shared with desktop and mobile.
// ============================================

import { resolveIntlLocale, formatAmount, currencySign } from '@hisabche/formatting'
import { useCurrencyStore, type CurrencyCode } from '@hisabche/store'

/** The default UI language, used when nothing better is known (SSR). */
const DEFAULT_LOCALE = resolveIntlLocale('fa')

/**
 * The reader's Intl locale, read from `<html lang>` — which the web root
 * layout and the desktop shell both set from the active UI language. This is
 * the only locale signal available outside a React tree; components that CAN
 * use a hook should use `useIntlLocale` instead.
 */
export function documentIntlLocale(): string {
  if (typeof document === 'undefined') return DEFAULT_LOCALE
  const lang = document.documentElement.getAttribute('lang')
  return lang ? resolveIntlLocale(lang) : DEFAULT_LOCALE
}

/** The currency the user chose. Never substituted for another one. */
export function selectedCurrency(): CurrencyCode {
  return useCurrencyStore.getState().primaryCurrency
}

/** Grouped digits in the user's currency and the reader's locale — no sign. */
export function formatSelectedAmount(value: number): string {
  return formatAmount(value, selectedCurrency(), documentIntlLocale())
}

/** The same, with the currency's sign appended. */
export function formatSelectedMoney(value: number): string {
  const currency = selectedCurrency()
  return `${formatAmount(value, currency, documentIntlLocale())} ${currencySign(currency)}`
}
