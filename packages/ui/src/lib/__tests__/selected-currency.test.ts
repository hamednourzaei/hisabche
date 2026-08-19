// ============================================
// REGRESSION — the currency the user selected is the currency they are shown.
//
// The bug this pins, in three parts:
//
//   1. The onboarding wizard wrote its answer to `useOnboardingStore
//      .defaultCurrency`, which NOTHING read. Every amount in the product is
//      formatted from `useCurrencyStore.primaryCurrency`, which stayed on its
//      'AFN' default. The currency step was decorative.
//   2. The step offered 25 codes (IRT, TRY, XAU …) while the product supports
//      four. An unsupported answer was written through `as CurrencyCode` and
//      then swallowed by `CONFIG[code] || CONFIG.AFN` — so picking تومان
//      showed افغانی.
//   3. Formatting helpers derived the LOCALE from the currency, so digits
//      followed the money rather than the reader's language.
// ============================================

import { afterEach, describe, expect, it } from 'vitest'

import { isSupportedCurrency, SUPPORTED_CURRENCIES, useCurrencyStore } from '@hisabche/store'
import { currencySign, formatAmount, resolveIntlLocale } from '@hisabche/formatting'

import { formatSelectedAmount, formatSelectedMoney, selectedCurrency } from '../money-display'

const initial = useCurrencyStore.getState().primaryCurrency

afterEach(() => {
  useCurrencyStore.getState().setPrimaryCurrency(initial)
})

describe('the selected currency reaches the formatter', () => {
  it.each(SUPPORTED_CURRENCIES)('renders %s, not the AFN default', (code) => {
    useCurrencyStore.getState().setPrimaryCurrency(code)

    expect(selectedCurrency()).toBe(code)
    expect(formatSelectedMoney(1000)).toContain(currencySign(code))
  })

  it('never falls back to another currency once a choice is made', () => {
    useCurrencyStore.getState().setPrimaryCurrency('USD')
    // The concrete failure: '؋' appearing on a dollar shop's screen.
    expect(formatSelectedMoney(1000)).not.toContain(currencySign('AFN'))
  })

  it("honours the currency's precision — USD keeps its cents, AFN does not", () => {
    useCurrencyStore.getState().setPrimaryCurrency('USD')
    const usd = formatSelectedAmount(1234.5)
    useCurrencyStore.getState().setPrimaryCurrency('AFN')
    const afn = formatSelectedAmount(1234.5)

    expect(usd).not.toBe(afn)
  })
})

describe('digits follow the reader, not the money', () => {
  // The old table pinned each currency to a locale (AFN -> fa-AF, USD ->
  // en-US), so an English reader on an AFN shop got Persian digits and a
  // Persian reader on a USD shop got Latin ones.
  it('formats the same amount in the same currency differently per locale', () => {
    expect(formatAmount(1234, 'AFN', resolveIntlLocale('en'))).toBe('1,234')
    expect(formatAmount(1234, 'AFN', resolveIntlLocale('fa'))).not.toBe('1,234')
  })

  it('formats a USD amount in Persian digits for a Persian reader', () => {
    expect(formatAmount(1234.5, 'USD', resolveIntlLocale('fa'))).not.toMatch(/[0-9]/)
  })
})

describe('an unsupported onboarding code is never coerced to another currency', () => {
  it.each(['IRT', 'TRY', 'XAU', 'INR'])('rejects %s rather than silently meaning AFN', (code) => {
    // These are real entries in the onboarding catalogue that
    // `currencyCodeSchema` rejects and no invoice can carry. The guard exists
    // so the mismatch is visible instead of becoming افغانی.
    expect(isSupportedCurrency(code)).toBe(false)
  })

  it('accepts exactly the codes the backend schema accepts', () => {
    expect([...SUPPORTED_CURRENCIES]).toEqual(['AFN', 'USD', 'PKR', 'IRR'])
  })
})
