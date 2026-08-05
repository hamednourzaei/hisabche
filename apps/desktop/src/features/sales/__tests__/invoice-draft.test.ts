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
      ])
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
