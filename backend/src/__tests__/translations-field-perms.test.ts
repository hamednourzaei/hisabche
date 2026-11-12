import { describe, expect, it } from 'vitest'
import {
  resolveLocalizedName,
  matchesLocalizedSearch,
  redactSensitiveFields,
  filterCsvColumnsForHiddenFields,
} from '@hisabche/validation'

describe('B.2.21 & B.2.23 Data translations & Field-level permissions', () => {
  it('picks locale then falls back to original name and searches all variants', () => {
    const tr = { fa: 'شکر', af: 'بوره' }
    expect(resolveLocalizedName('Sugar', tr, 'af')).toBe('بوره')
    expect(resolveLocalizedName('Sugar', tr, 'en')).toBe('Sugar')
    expect(matchesLocalizedSearch('Sugar', tr, 'بوره')).toBe(true)
    expect(matchesLocalizedSearch('Sugar', tr, 'sug')).toBe(true)
    expect(matchesLocalizedSearch('Sugar', tr, 'salt')).toBe(false)
  })

  it('removes sensitive fields for seller without product.cost.read, returns hidden list, and omits from CSV', () => {
    const res = redactSensitiveFields(
      [{ id: 'p1', name: 'Tea', sell_price: 200, buy_price: 120, cost_price: 115 }],
      new Set(['product.read']),
    )
    expect(res.rows[0]).toEqual({ id: 'p1', name: 'Tea', sell_price: 200 })
    expect(res.hidden).toContain('buy_price')
    expect(res.hidden).toContain('cost_price')
    expect(
      filterCsvColumnsForHiddenFields(['name', 'sell_price', 'buy_price'], res.hidden),
    ).toEqual(['name', 'sell_price'])
  })
})
