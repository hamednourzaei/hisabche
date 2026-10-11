// ============================================
// Connecting a column by what it holds, when its name says nothing — and
// declining to, whenever the cells allow two readings.
// ============================================

import { describe, expect, it } from 'vitest'

import { inferMappingFromContent } from '../services/migration'

const NAMELESS = ['ستون ۱', 'ستون ۲', 'ستون ۳', 'ستون ۴', 'ستون ۵']

describe('reading a column from its contents', () => {
  it('⚠️ quantity × price = amount is found by the arithmetic, not by the headers', () => {
    // 2 × 150 = 300, 1 × 90 = 90, 5 × 150 = 750, 3 × 40 = 120 — worked by hand.
    const rows = [
      ['1405/07/19', '2', '150', '300', 'چای'],
      ['1405/07/19', '1', '90', '90', 'قند'],
      ['1405/07/20', '5', '150', '750', 'چای'],
      ['1405/07/21', '3', '40', '120', 'نمک'],
    ]

    const seen = inferMappingFromContent('invoice', NAMELESS, rows, {})

    expect(seen.mapping).toEqual({ date: 0, quantity: 1, unitPrice: 2, lineTotal: 3 })
    expect(seen.inferred).toEqual(['date', 'quantity', 'unitPrice', 'lineTotal'])
  })

  it('⚠️ two date columns are not guessed between', () => {
    const rows = [
      ['2026-10-01', '2026-10-15', '100'],
      ['2026-10-02', '2026-10-16', '200'],
      ['2026-10-03', '2026-10-17', '300'],
    ]
    const seen = inferMappingFromContent('invoice', ['a', 'b', 'c'], rows, {})
    expect(seen.mapping).not.toHaveProperty('date')
  })

  it('⚠️ when every quantity is one, price and amount cannot be told apart — so neither is', () => {
    const rows = [
      ['1', '150', '150'],
      ['1', '90', '90'],
      ['1', '40', '40'],
    ]
    expect(inferMappingFromContent('invoice', ['a', 'b', 'c'], rows, {}).mapping).toEqual({})
  })

  it('numbers that do not multiply out are left alone', () => {
    const rows = [
      ['2', '150', '999'],
      ['1', '90', '12'],
      ['5', '150', '7'],
    ]
    expect(inferMappingFromContent('invoice', ['a', 'b', 'c'], rows, {}).mapping).toEqual({})
  })

  it('a field the headers already connected is never moved', () => {
    const rows = [
      ['1405/07/19', '2', '150', '300'],
      ['1405/07/19', '1', '90', '90'],
      ['1405/07/20', '5', '150', '750'],
    ]
    // The person (or the header) said column 3 is the unit price.
    const seen = inferMappingFromContent('invoice', ['a', 'b', 'c', 'd'], rows, { unitPrice: 3 })
    expect(seen.mapping).toEqual({ date: 0 })
  })

  it('customers: the phone column, the e-mail column and the one column of names', () => {
    const rows = [
      ['احمد رحیمی', '0700123456', 'ahmad@example.com'],
      ['کریم نوری', '0799111222', 'karim@example.com'],
      ['ولی احمدی', '+93788000111', 'wali@example.com'],
    ]
    const seen = inferMappingFromContent('customer', ['x', 'y', 'z'], rows, {})
    expect(seen.mapping).toEqual({ phone: 1, email: 2, fullName: 0 })
  })

  it('⚠️ two columns of text are not guessed between for the name', () => {
    const rows = [
      ['احمد', 'کابل', '0700123456'],
      ['کریم', 'هرات', '0799111222'],
      ['ولی', 'مزار', '0788000111'],
    ]
    const seen = inferMappingFromContent('customer', ['x', 'y', 'z'], rows, {})
    expect(seen.mapping).toEqual({ phone: 2 })
  })

  it('products: a column of barcodes is not mistaken for phones or amounts', () => {
    const rows = [
      ['چای', '6260000000011'],
      ['قند', '6260000000028'],
      ['نمک', '6260000000035'],
    ]
    expect(inferMappingFromContent('product', ['x', 'y'], rows, {}).mapping).toEqual({
      barcode: 1,
      name: 0,
    })
  })

  it('two rows are not enough to call a column anything', () => {
    const rows = [
      ['احمد', '0700123456'],
      ['کریم', '0799111222'],
    ]
    expect(inferMappingFromContent('customer', ['x', 'y'], rows, {}).mapping).toEqual({})
  })
})
