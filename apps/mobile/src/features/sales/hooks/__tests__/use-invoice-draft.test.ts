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
    const payload = buildInvoice(
      [item({})],
      'AFN',
      '3f2504e0-4f89-11d3-9a0c-0305e82c3301'
    )
    expect(payload.customerId).toBe('3f2504e0-4f89-11d3-9a0c-0305e82c3301')
  })
})
