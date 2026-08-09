import { createInvoiceSchema } from '@hisabche/validation'

import { buildInvoice, lineTotal, subtotalOf, type DraftItem } from '../use-invoice-draft'

const item = (patch: Partial<DraftItem>): DraftItem => ({
  key: 'k',
  productName: 'x',
  quantity: 1,
  unitPrice: 100,
  discount: 0,
  ...patch,
})

describe('lineTotal', () => {
  it('applies the discount percentage', () => {
    expect(lineTotal(item({ quantity: 2, unitPrice: 100, discount: 10 }))).toBe(180)
  })

  it('returns the plain product when there is no discount', () => {
    expect(lineTotal(item({ quantity: 3, unitPrice: 50 }))).toBe(150)
  })
})

describe('subtotalOf', () => {
  it('is zero for an empty basket', () => {
    expect(subtotalOf([])).toBe(0)
  })

  it('accumulates across items', () => {
    const items = [
      item({ key: 'a', quantity: 2, unitPrice: 100 }),
      item({ key: 'b', quantity: 1, unitPrice: 50, discount: 50 }),
    ]
    expect(subtotalOf(items)).toBe(225)
  })
})

describe('buildInvoice', () => {
  it('produces a payload the shared schema accepts', () => {
    const payload = buildInvoice([item({ quantity: 2, unitPrice: 100 })], 'AFN')

    expect(payload.type).toBe('sale')
    expect(payload.total).toBe(200)
    expect(createInvoiceSchema.safeParse(payload).success).toBe(true)
  })

  it('is rejected by the schema when there are no items', () => {
    const payload = buildInvoice([], 'AFN')
    expect(createInvoiceSchema.safeParse(payload).success).toBe(false)
  })

  it('carries the selected customer', () => {
    const payload = buildInvoice([item({})], 'AFN', '3f2504e0-4f89-11d3-9a0c-0305e82c3301')
    expect(payload.customerId).toBe('3f2504e0-4f89-11d3-9a0c-0305e82c3301')
  })
})

// ============================================
// Unified sale/purchase + nested details (mobile).
// Mirrors the desktop suite — both platforms must agree on the money rule.
// ============================================

describe('transaction type', () => {
  it('defaults to sale so existing callers are unchanged', () => {
    expect(buildInvoice([item({})], 'AFN').type).toBe('sale')
  })

  it('carries purchase through to the payload', () => {
    expect(buildInvoice([item({})], 'AFN', undefined, 'purchase').type).toBe('purchase')
  })
})

describe('nested details', () => {
  const necklace = item({
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
    expect(lineTotal(item({ quantity: 2, unitPrice: 100 }))).toBe(200)
  })

  it('details are informational by default', () => {
    expect(lineTotal(necklace)).toBe(50000)
  })

  it('when priced, components REPLACE the base — no double counting', () => {
    expect(lineTotal({ ...necklace, detailsArePriced: true })).toBe(50000)
    expect(lineTotal({ ...necklace, unitPrice: 999999, detailsArePriced: true })).toBe(50000)
  })

  it('supports an unlimited number of components', () => {
    const many = item({
      details: Array.from({ length: 40 }, (_, i) => ({
        key: `d${i}`,
        title: `جزء ${i}`,
        quantity: 1,
        amount: 100,
      })),
      detailsArePriced: true,
    })
    expect(lineTotal(many)).toBe(4000)
  })

  it('persists components in order and drops untitled rows', () => {
    const payload = buildInvoice([necklace], 'AFN')
    const details = (payload.items[0] as any).details
    expect(details.map((d: any) => d.title)).toEqual(['زنجیر', 'سنگ', 'اجرت'])
    expect(details.map((d: any) => d.sortOrder)).toEqual([0, 1, 2])
  })
})

describe('units and weight', () => {
  it('defaults to piece', () => {
    expect((buildInvoice([item({})], 'AFN').items[0] as any).unit).toBe('piece')
  })

  it('carries gram for weight-priced goods', () => {
    const payload = buildInvoice(
      [item({ productName: 'طلا', quantity: 10, unit: 'gram', unitPrice: 5000 })],
      'AFN',
    )
    expect((payload.items[0] as any).unit).toBe('gram')
    expect(payload.total).toBe(50000)
  })

  it('sends a custom label only when the unit is custom', () => {
    expect(
      (buildInvoice([item({ unit: 'custom', unitLabel: ' مثقال ' })], 'AFN').items[0] as any)
        .unitLabel,
    ).toBe('مثقال')
    expect(
      (buildInvoice([item({ unit: 'gram', unitLabel: 'stale' })], 'AFN').items[0] as any).unitLabel,
    ).toBeUndefined()
  })

  it('WEIGHT IS NOT QUANTITY', () => {
    const payloadItem = buildInvoice(
      [item({ quantity: 1, unit: 'piece', weightGrams: 12.5 })],
      'AFN',
    ).items[0] as any
    expect(payloadItem.quantity).toBe(1)
    expect(payloadItem.weightGrams).toBe(12.5)
  })
})
