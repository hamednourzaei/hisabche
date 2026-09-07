// ============================================
// T1 — the picker and the schema must offer the same currencies.
//
// THE BUG THIS PINS: `packages/ui-contract` catalogued 25 codes and the
// onboarding wizard rendered all of them, while `currencyCodeSchema` accepted
// four. Every other choice reached `handleSetCurrency`, failed
// `isSupportedCurrency`, and returned — the wizard accepted the click, showed
// the code as chosen, and stored nothing. The owner's report was that adding
// currencies in the database changed nothing; the filter was the enum.
//
// Both lists were widened to the same 25. A code in ONE list only is the
// regression: extra in the catalogue means a dead option, extra in the schema
// means a currency nobody can pick.
// ============================================

import { describe, expect, it } from 'vitest'

import { CURRENCIES, primaryCurrencies } from '@hisabche/ui-contract'
import { CURRENCY_CODES } from '@hisabche/validation'
import { CURRENCY_SIGN, FRACTION_DIGITS } from '@hisabche/formatting'

const catalogue = CURRENCIES.map((c) => c.code)

describe('the currency picker offers exactly what the schema accepts', () => {
  it('every catalogued code is accepted by the schema', () => {
    for (const code of catalogue) {
      expect(CURRENCY_CODES as readonly string[], `${code} is offered but not accepted`).toContain(
        code,
      )
    }
  })

  it('every accepted code is offered somewhere in the picker', () => {
    for (const code of CURRENCY_CODES) {
      expect(catalogue, `${code} is accepted but unreachable in the UI`).toContain(code)
    }
  })

  it('the two lists are the same size — no duplicates hiding a gap', () => {
    expect(new Set(catalogue).size).toBe(CURRENCY_CODES.length)
  })
})

describe('a currency the user can pick can also be displayed', () => {
  // Reaching the store is not enough: a code with no precision and no sign
  // formats as a wrong amount rather than a missing option.
  it.each(catalogue)('%s has a precision and a sign', (code) => {
    expect(FRACTION_DIGITS[code as keyof typeof FRACTION_DIGITS]).toBeDefined()
    expect(CURRENCY_SIGN[code as keyof typeof CURRENCY_SIGN]).toBeDefined()
  })
})

describe('the two codes shown above the search box are real', () => {
  it.each(['fa', 'af', 'fa-AF', 'en'])('%s primaries are selectable', (lang) => {
    for (const option of primaryCurrencies(lang)) {
      expect(CURRENCY_CODES as readonly string[]).toContain(option.code)
    }
  })
})
