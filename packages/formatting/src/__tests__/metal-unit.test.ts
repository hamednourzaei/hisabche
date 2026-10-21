// A metal is stored in grams and SHOWN in the chosen unit — converted, not relabelled.
import { afterEach, describe, expect, it } from 'vitest'

import { currencySign, formatAmount } from '../money'
import { metalFactor, setMetalDisplayUnit, toShownMetal, toStoredMetal } from '../metal-unit'

afterEach(() => setMetalDisplayUnit('g'))

describe('metal display unit', () => {
  it('1,000 g is 1 kg and 1,000,000 g is 1 t — both ways', () => {
    expect(toShownMetal(2_500, 'XAU', 'kg')).toBe(2.5)
    expect(toStoredMetal(2.5, 'XAU', 'kg')).toBe(2_500)
    expect(toShownMetal(3_000_000, 'XAG', 't')).toBe(3)
    expect(toStoredMetal(3, 'XAG', 't')).toBe(3_000_000)
  })

  it('a currency that is not a metal is never scaled', () => {
    setMetalDisplayUnit('kg')
    expect(metalFactor('AFN')).toBe(1)
    expect(formatAmount(2_500, 'AFN', 'en')).toBe('2,500')
  })

  it('formats a gram figure in the chosen unit, with its sign', () => {
    setMetalDisplayUnit('kg')
    expect(formatAmount(2_500, 'XAU', 'en')).toBe('2.5')
    expect(currencySign('XAU', 'en')).toBe('kg')
    setMetalDisplayUnit('g')
    expect(formatAmount(2_500, 'XAU', 'en')).toBe('2,500')
    expect(currencySign('XAU', 'en')).toBe('g')
  })

  it('keeps a milligram in every unit — no rounding away what the books hold', () => {
    setMetalDisplayUnit('t')
    // 1 mg = 0.000000001 t
    expect(formatAmount(1_000_000.001, 'XAU', 'en')).toBe('1.000000001')
  })

  it('an unset preference reads as grams, the stored unit', () => {
    expect(formatAmount(1_500, 'XAU', 'en')).toBe('1,500')
  })
})
