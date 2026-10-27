// ============================================
// An UNSET filter is NO filter; an explicit false is «only false».
//
// The bug (26 Oct 2026): `undefined` became `''`, `'' === 'true'` is false, and
// the product list turned into «inactive products only» — an invoice picker
// that listed nothing with 10 grams of gold in stock.
// ============================================

import { describe, expect, it } from 'vitest'
import {
  customerFiltersSchema,
  flagFilter,
  idFilter,
  isUnsetFlag,
  isUnsetValue,
  productFiltersSchema,
  setFilters,
  textFilter,
} from '../index'

describe('flagFilter', () => {
  it('A–C. undefined, null and the empty string are NO filter — never false', () => {
    for (const unset of [undefined, null, '', '  ']) {
      expect(flagFilter(unset)).toBeUndefined()
    }
  })

  it('what String(x) leaves on a URL is no filter either', () => {
    for (const word of ['undefined', 'null', 'NULL', ' Undefined ']) {
      expect(flagFilter(word)).toBeUndefined()
    }
  })

  it('D. explicit false is «only the false ones»', () => {
    for (const no of [false, 'false', 'FALSE', '0']) expect(flagFilter(no)).toBe(false)
  })

  it('E. explicit true is «only the true ones»', () => {
    for (const yes of [true, 'true', 'True', '1']) expect(flagFilter(yes)).toBe(true)
  })

  it('unset ≠ false and unset ≠ true', () => {
    expect(flagFilter(undefined)).not.toBe(false)
    expect(flagFilter(undefined)).not.toBe(true)
  })

  it('a word that is not a flag is not a condition', () => {
    expect(flagFilter('maybe')).toBeUndefined()
    expect(flagFilter(2)).toBeUndefined()
  })
})

describe('idFilter and textFilter', () => {
  it('an unset id is no scope — «» is not an id', () => {
    for (const unset of [undefined, null, '', 'undefined', 'null', '   ']) {
      expect(idFilter(unset)).toBeUndefined()
    }
    expect(idFilter(' 33333333-3333-4333-8333-333333333333 ')).toBe(
      '33333333-3333-4333-8333-333333333333',
    )
  })

  it('a search that is the WORD «null» is a search — only a blank is no search', () => {
    expect(textFilter('null')).toBe('null')
    expect(textFilter('undefined')).toBe('undefined')
    for (const blank of [undefined, null, '', '   ']) expect(textFilter(blank)).toBeUndefined()
    expect(textFilter(' طلا ')).toBe('طلا')
  })
})

describe('setFilters', () => {
  it('keeps what was set, drops what was not, keeps an explicit false', () => {
    expect(
      setFilters({ isActive: false, lowStock: undefined, search: '', page: 0, note: null }),
    ).toEqual({ isActive: false, page: 0 })
  })

  it('knows what «unset» is', () => {
    expect(isUnsetValue('')).toBe(true)
    expect(isUnsetValue(false)).toBe(false)
    expect(isUnsetValue(0)).toBe(false)
    expect(isUnsetFlag('null')).toBe(true)
    expect(isUnsetValue('null')).toBe(false)
  })
})

describe('the list schemas obey the same contract', () => {
  it('product filters: unset isActive/lowStock are absent, explicit ones survive', () => {
    for (const unset of ['', 'undefined', 'null', null]) {
      const parsed = productFiltersSchema.parse({ isActive: unset, lowStock: unset })
      expect(parsed.isActive).toBeUndefined()
      expect(parsed.lowStock).toBeUndefined()
    }
    expect(productFiltersSchema.parse({ isActive: 'false' }).isActive).toBe(false)
    expect(productFiltersSchema.parse({ isActive: 'true' }).isActive).toBe(true)
    expect(productFiltersSchema.parse({ isActive: false }).isActive).toBe(false)
  })

  it('customer filters: unset isActive/hasBalance are absent', () => {
    const parsed = customerFiltersSchema.parse({ isActive: '', hasBalance: 'null' })
    expect(parsed.isActive).toBeUndefined()
    expect(parsed.hasBalance).toBeUndefined()
    expect(customerFiltersSchema.parse({ hasBalance: 'false' }).hasBalance).toBe(false)
  })
})
