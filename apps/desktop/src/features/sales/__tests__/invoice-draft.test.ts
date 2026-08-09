import { createInvoiceSchema } from '@hisabche/validation'

import { buildInvoice, lineTotal, subtotalOf, type DraftLine } from '../invoice-draft'

const line = (patch: Partial<DraftLine>): DraftLine => ({
  key: 'k',
  productName: 'x',
  quantity: 1,
  unitPrice: 100,
  discount: 0,
  ...patch,
})

describe('lineTotal', () => {
  it('applies the discount percentage', () => {
    expect(lineTotal(line({ quantity: 2, unitPrice: 100, discount: 10 }))).toBe(180)
  })

  it('multiplies quantity by price when undiscounted', () => {
    expect(lineTotal(line({ quantity: 3, unitPrice: 50 }))).toBe(150)
  })
})

describe('subtotalOf', () => {
  it('is zero for an empty basket', () => {
    expect(subtotalOf([])).toBe(0)
  })

  it('accumulates across lines', () => {
    expect(
      subtotalOf([
        line({ key: 'a', quantity: 2, unitPrice: 100 }),
        line({ key: 'b', quantity: 1, unitPrice: 50, discount: 50 }),
      ]),
    ).toBe(225)
  })
})

describe('buildInvoice', () => {
  it('produces a payload the shared schema accepts', () => {
    const payload = buildInvoice([line({ quantity: 2, unitPrice: 100 })], 'AFN')

    expect(payload.type).toBe('sale')
    expect(payload.total).toBe(200)
    expect(createInvoiceSchema.safeParse(payload).success).toBe(true)
  })

  it('is rejected by the schema without line items', () => {
    expect(createInvoiceSchema.safeParse(buildInvoice([], 'AFN')).success).toBe(false)
  })
})

// ============================================
// Unified sale/purchase + nested details.
// ============================================

describe('transaction type', () => {
  it('defaults to sale so every existing caller is unchanged', () => {
    expect(buildInvoice([line({})], 'AFN').type).toBe('sale')
  })

  it('carries purchase through to the payload', () => {
    const payload = buildInvoice([line({})], 'AFN', undefined, 'purchase')
    expect(payload.type).toBe('purchase')
    expect(createInvoiceSchema.safeParse(payload).success).toBe(true)
  })
})

describe('nested details', () => {
  const necklace = line({
    productName: 'گردنبند',
    quantity: 1,
    unitPrice: 50000,
    details: [
      { key: 'd1', title: 'زنجیر', quantity: 1, amount: 40000 },
      { key: 'd2', title: 'سنگ', quantity: 2, amount: 2500 },
      { key: 'd3', title: 'اجرت', quantity: 1, amount: 5000 },
    ],
  })

  it('BACKWARD COMPATIBLE: a line with no details totals exactly as before', () => {
    expect(lineTotal(line({ quantity: 2, unitPrice: 100 }))).toBe(200)
  })

  it('details are informational by default — the total is untouched', () => {
    expect(lineTotal(necklace)).toBe(50000)
  })

  it('when priced, the components REPLACE the base — never add to it', () => {
    expect(lineTotal({ ...necklace, detailsArePriced: true })).toBe(50000)
    expect(lineTotal({ ...necklace, unitPrice: 999999, detailsArePriced: true })).toBe(50000)
  })

  it('applies the line discount after the component sum', () => {
    expect(lineTotal({ ...necklace, detailsArePriced: true, discount: 10 })).toBe(45000)
  })

  it('supports an unlimited number of components', () => {
    const many = line({
      details: Array.from({ length: 50 }, (_, i) => ({
        key: `d${i}`,
        title: `جزء ${i}`,
        quantity: 1,
        amount: 100,
      })),
      detailsArePriced: true,
    })
    expect(lineTotal(many)).toBe(5000)
  })

  it('persists components in order and drops untitled rows', () => {
    const payload = buildInvoice([necklace], 'AFN')
    const details = (payload.items[0] as { details?: { title: string; sortOrder: number }[] })
      .details
    expect(details?.map((d) => d.title)).toEqual(['زنجیر', 'سنگ', 'اجرت'])
    expect(details?.map((d) => d.sortOrder)).toEqual([0, 1, 2])
    expect(createInvoiceSchema.safeParse(payload).success).toBe(true)
  })

  it('omits blank component rows from the payload', () => {
    const payload = buildInvoice(
      [line({ details: [{ key: 'x', title: '   ', quantity: 1, amount: 5 }] })],
      'AFN',
    )
    expect((payload.items[0] as { details?: unknown[] }).details).toEqual([])
  })
})

describe('units and weight', () => {
  it('defaults to piece', () => {
    const payload = buildInvoice([line({})], 'AFN')
    expect((payload.items[0] as { unit: string }).unit).toBe('piece')
  })

  it('carries gram for weight-priced goods', () => {
    const payload = buildInvoice(
      [line({ productName: 'طلا', quantity: 10, unit: 'gram', unitPrice: 5000 })],
      'AFN',
    )
    expect((payload.items[0] as { unit: string }).unit).toBe('gram')
    expect(payload.total).toBe(50000)
    expect(createInvoiceSchema.safeParse(payload).success).toBe(true)
  })

  it('sends a custom unit label only when the unit is custom', () => {
    const custom = buildInvoice([line({ unit: 'custom', unitLabel: ' مثقال ' })], 'AFN')
    expect((custom.items[0] as { unitLabel?: string }).unitLabel).toBe('مثقال')

    const standard = buildInvoice([line({ unit: 'gram', unitLabel: 'stale' })], 'AFN')
    expect((standard.items[0] as { unitLabel?: string }).unitLabel).toBeUndefined()
  })

  it('WEIGHT IS NOT QUANTITY: one necklace weighing 12.5 g', () => {
    const payload = buildInvoice(
      [line({ quantity: 1, unit: 'piece', weightGrams: 12.5, unitPrice: 50000 })],
      'AFN',
    )
    const item = payload.items[0] as { quantity: number; weightGrams?: number }
    expect(item.quantity).toBe(1)
    expect(item.weightGrams).toBe(12.5)
    expect(createInvoiceSchema.safeParse(payload).success).toBe(true)
  })
})
