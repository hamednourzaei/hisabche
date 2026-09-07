// ============================================
// REGRESSION — the currency the user selected is the currency they are shown.
//
// The bug this pins, in three parts:
//
//   1. The onboarding wizard wrote its answer to `useOnboardingStore
//      .defaultCurrency`, which NOTHING read. Every amount in the product is
//      formatted from `useCurrencyStore.primaryCurrency`, which stayed on its
//      'AFN' default. The currency step was decorative.
//   2. The step offered 25 codes (IRT, TRY, XAU …) while the product supported
//      four. An unsupported answer was written through `as CurrencyCode` and
//      then swallowed by `CONFIG[code] || CONFIG.AFN` — so picking تومان
//      showed افغانی. (Task T1 later opened the list to all 25; the coercion
//      guard stayed, because the fallback path is what caused the bug — not
//      the size of the list.)
//   3. Formatting helpers derived the LOCALE from the currency, so digits
//      followed the money rather than the reader's language.
// ============================================

import { afterEach, describe, expect, it } from 'vitest'

import { isSupportedCurrency, SUPPORTED_CURRENCIES, useCurrencyStore } from '@hisabche/store'
import { CURRENCY_CODES } from '@hisabche/validation'
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
  /**
   * ⚠️ THIS BLOCK USED TO NAME IRT, TRY, XAU AND INR AS THE REJECTED CODES.
   *
   * All four are ACTIVE since task T1 — the owner opened the list because the
   * business trades metals and onboarding was filtering 25 catalogued codes
   * down to four. So the EXAMPLES expired, not the invariant.
   *
   * The invariant is part 2 of the bug at the top of this file: an onboarding
   * answer outside the supported set was written through `as CurrencyCode`
   * and then swallowed by `CONFIG[code] || CONFIG.AFN`, so an unsupported
   * pick silently displayed افغانی. That failure mode is unchanged — a code
   * outside the list must be REJECTED, never quietly become another currency.
   */
  it.each(['ZZZ', 'EURO', 'afn', '', 'XYZ'])(
    'rejects %s rather than silently meaning AFN',
    (code) => {
      expect(isSupportedCurrency(code)).toBe(false)
    },
  )

  it.each(['IRT', 'TRY', 'XAU', 'INR'])(
    'accepts %s — supported since T1, and not coerced',
    (code) => {
      // The other half of the same guard: a code that IS supported must arrive
      // intact. Rejecting it would resurrect the fallback-to-AFN path from the
      // other side.
      expect(isSupportedCurrency(code)).toBe(true)
      useCurrencyStore.getState().setPrimaryCurrency(code as (typeof SUPPORTED_CURRENCIES)[number])
      expect(selectedCurrency()).toBe(code)
    },
  )

  it('accepts exactly the codes the backend schema accepts', () => {
    // Asserted against CURRENCY_CODES itself rather than a copied literal, so
    // the store and the zod enum cannot drift apart again.
    expect([...SUPPORTED_CURRENCIES]).toEqual([...CURRENCY_CODES])
  })
})
