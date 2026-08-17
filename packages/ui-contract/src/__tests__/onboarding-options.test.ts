// ============================================
// Onboarding lists. The ids are written onto the account, so an accidental
// rename silently changes what an existing profile means — these tests make
// that impossible to do quietly.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  BUSINESS_MODELS,
  BUSINESS_TYPES,
  BUSINESS_TYPE_OTHER,
  filterBusinessTypes,
} from '../business-types'
import { CURRENCIES, primaryCurrencies } from '../currencies'

const identity = (_key: string, fallback: string) => fallback

describe('business types', () => {
  it('has no duplicate ids', () => {
    const ids = BUSINESS_TYPES.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps the sales models out of the searchable trades', () => {
    // They are asked as cards; repeating them in the list would let someone
    // pick "retail" twice and read as two different answers.
    const tradeIds = new Set(BUSINESS_TYPES.map((o) => o.id))
    for (const model of BUSINESS_MODELS) {
      expect(tradeIds.has(model.id)).toBe(false)
    }
  })

  it('offers retail and wholesale as the two models', () => {
    expect(BUSINESS_MODELS.map((m) => m.id)).toEqual(['retail', 'wholesale'])
  })

  it('gives every trade a label key and a Persian fallback', () => {
    for (const option of BUSINESS_TYPES) {
      expect(option.labelKey).toMatch(/^businessType\./)
      expect(option.labelFa.trim().length).toBeGreaterThan(0)
    }
  })

  it('covers the weight-based trades that motivated unit support', () => {
    const ids = BUSINESS_TYPES.map((o) => o.id)
    expect(ids).toContain('jewellery')
    expect(ids).toContain('currencyExchange')
  })

  it('reserves "other" for the fallback rather than listing it as a trade', () => {
    expect(BUSINESS_TYPE_OTHER.id).toBe('other')
    expect(BUSINESS_TYPES.some((o) => o.id === 'other')).toBe(false)
  })
})

describe('filterBusinessTypes', () => {
  it('returns everything for an empty query', () => {
    expect(filterBusinessTypes('', identity)).toHaveLength(BUSINESS_TYPES.length)
    expect(filterBusinessTypes('   ', identity)).toHaveLength(BUSINESS_TYPES.length)
  })

  it('matches on the localised label', () => {
    const results = filterBusinessTypes('طلا', identity)
    expect(results.map((r) => r.id)).toContain('jewellery')
  })

  it('matches on the id, so English typing works before translation lands', () => {
    const results = filterBusinessTypes('jewel', identity)
    expect(results.map((r) => r.id)).toContain('jewellery')
  })

  it('is case-insensitive', () => {
    expect(filterBusinessTypes('PHARM', identity).map((r) => r.id)).toContain('pharmacy')
  })

  it('returns nothing for a query that matches no trade', () => {
    expect(filterBusinessTypes('zzzznope', identity)).toHaveLength(0)
  })
})

describe('currencies', () => {
  it('has no duplicate codes', () => {
    const codes = CURRENCIES.map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('leads with afghani for Dari and toman for Persian', () => {
    expect(primaryCurrencies('af').map((c) => c.code)).toEqual(['AFN', 'USD'])
    expect(primaryCurrencies('fa').map((c) => c.code)).toEqual(['IRT', 'USD'])
  })

  it('treats the native platform language codes the same way', () => {
    expect(primaryCurrencies('fa-AF').map((c) => c.code)).toEqual(['AFN', 'USD'])
  })

  it('puts the dollar second in both, as the common reference', () => {
    for (const lang of ['fa', 'af', 'en']) {
      expect(primaryCurrencies(lang)[1]?.code).toBe('USD')
    }
  })

  it('includes precious metals, which are priced by weight', () => {
    const codes = CURRENCIES.map((c) => c.code)
    // ISO 4217 X-codes, not invented identifiers.
    expect(codes).toContain('XAU')
    expect(codes).toContain('XAG')
    expect(codes).toContain('XPT')
    expect(codes).toContain('XPD')
  })

  it('keeps toman and rial separate', () => {
    // They differ by a factor of ten; collapsing them would misstate every
    // Iranian price by an order of magnitude.
    const codes = CURRENCIES.map((c) => c.code)
    expect(codes).toContain('IRT')
    expect(codes).toContain('IRR')
  })

  it('still contains the primaries, so search can find them', () => {
    const codes = new Set(CURRENCIES.map((c) => c.code))
    for (const lang of ['fa', 'af']) {
      for (const option of primaryCurrencies(lang)) {
        expect(codes.has(option.code)).toBe(true)
      }
    }
  })
})
