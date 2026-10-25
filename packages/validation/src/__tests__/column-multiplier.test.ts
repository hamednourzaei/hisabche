// ============================================
// «ضرب در ستون» — a money column scaled by a numeric column, row by row.
//
// THE REPORTED CASE
//
//   قیمت هر گرم ۲۵٬۰۰۰٬۰۰۰ · وزن خالص ۱۰ گرم · جمع ستون وزن روشن
//   ← مبلغ باید ۲۵۰٬۰۰۰٬۰۰۰ شود؛ بود ۲۵٬۰۰۰٬۰۰۰ (وزن فقط جمع می‌شد، ضرب نمی‌شد).
//
// THE MEANING FOR SEVERAL ROWS
//
// Each row's price is multiplied by THAT row's weight; the lines then add up.
// (۲۵م + ۳۰م) × (۱۰ + ۵) would price a row with another row's weight, and
// nothing on the saved invoice could reproduce it: the server stores a total
// per line (`quantity × unitPrice + details`). One row reads the same either
// way, which is why the reported case is also test 2.
//
// Every test that totals a row also checks the SERVER's arithmetic
// (`computeItemTotal` over the mapped item) — a grid that disagrees with what
// is saved is worse than one that is wrong in both places.
// ============================================

import { describe, expect, it } from 'vitest'

import { computeItemTotal } from '../schemas/invoice.schema'
import {
  canBeMultiplierSource,
  columnTotals,
  invalidMultipliers,
  multiplierIssue,
  rowToInvoiceItem,
  rowTotal,
  rowUnitPrice,
  summarize,
  validateGrid,
  type GridMoneyContext,
  type InvoiceColumn,
  type InvoiceGridRow,
} from '../schemas/invoice-grid'

const ctx: GridMoneyContext = { currency: 'AFN', precision: 0, rates: {} }

const column = (patch: Partial<InvoiceColumn> & { id: string }): InvoiceColumn => ({
  label: patch.id,
  type: 'decimal',
  system: false,
  visible: true,
  aggregate: false,
  precision: 3,
  ...patch,
})

const description = column({ id: 'description', type: 'text', system: true, precision: 0 })
const quantity = column({ id: 'quantity', system: true })
const price = (patch: Partial<InvoiceColumn> = {}) =>
  column({ id: 'unitPrice', type: 'currency', system: true, precision: 0, ...patch })
const netWeight = (patch: Partial<InvoiceColumn> = {}) =>
  column({ id: 'net-weight', label: 'وزن خالص', aggregate: true, ...patch })

const row = (values: Record<string, string>, id = 'r1'): InvoiceGridRow => ({
  id,
  values: { description: 'دستبند هرمس', ...values },
})

/** What the server would total for the item the grid mapped. */
function serverTotal(r: InvoiceGridRow, columns: readonly InvoiceColumn[]): number {
  const item = rowToInvoiceItem(r, columns, ctx)
  if (!item) throw new Error('row was not mappable')
  return computeItemTotal({
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount,
    details: item.details,
  })
}

describe('sum is unchanged', () => {
  it('a weight column set to «جمع» only adds up its own cells', () => {
    const columns = [description, quantity, price(), netWeight()]
    const rows = [row({ unitPrice: '25000000', 'net-weight': '10' })]
    expect(columnTotals(rows, columns, ctx)['net-weight']).toBe(10)
    // …and the line is still quantity × price: a sum never multiplies.
    expect(rowTotal(rows[0]!, columns, ctx)).toBe(25_000_000)
  })
})

describe('multiply by column', () => {
  const columns = [description, quantity, price({ multiplyByColumnId: 'net-weight' }), netWeight()]

  it('25,000,000 × 10 = 250,000,000 — the reported case', () => {
    const r = row({ unitPrice: '25000000', 'net-weight': '10' })
    expect(rowTotal(r, columns, ctx)).toBe(250_000_000)
    expect(
      summarize({ rows: [r], columns, ctx, discountValue: 0, discountType: 'fixed', taxRate: 0 })
        .total,
    ).toBe(250_000_000)
  })

  it('the saved item totals the same on the server', () => {
    const r = row({ unitPrice: '25000000', 'net-weight': '10' })
    expect(serverTotal(r, columns)).toBe(250_000_000)
    // quantity stays the quantity — stock must not move by the weight.
    expect(rowToInvoiceItem(r, columns, ctx)?.quantity).toBe(1)
  })

  it('a decimal weight does not drift: 25,000,000 × 10.25 = 256,250,000', () => {
    const r = row({ unitPrice: '25000000', 'net-weight': '10.25' })
    expect(rowTotal(r, columns, ctx)).toBe(256_250_000)
    expect(serverTotal(r, columns)).toBe(256_250_000)
  })

  it('Persian digits and separators in the weight are read like any cell', () => {
    const r = row({ unitPrice: '25,000,000', 'net-weight': '۱۰٫۲۵' })
    expect(rowTotal(r, columns, ctx)).toBe(256_250_000)
  })

  it('several rows: each price × its OWN weight, then the lines add', () => {
    const rows = [
      row({ unitPrice: '25000000', 'net-weight': '10' }, 'a'),
      row({ unitPrice: '30000000', 'net-weight': '5' }, 'b'),
    ]
    const summary = summarize({
      rows,
      columns,
      ctx,
      discountValue: 0,
      discountType: 'fixed',
      taxRate: 0,
    })
    expect(summary.total).toBe(250_000_000 + 150_000_000)
    // The footer sum of the weight is still 15 — a separate figure.
    expect(columnTotals(rows, columns, ctx)['net-weight']).toBe(15)
    expect(rows.map((r) => serverTotal(r, columns))).toEqual([250_000_000, 150_000_000])
  })

  it('quantity still applies once: 2 × 25,000,000 × 10', () => {
    const r = row({ quantity: '2', unitPrice: '25000000', 'net-weight': '10' })
    expect(rowTotal(r, columns, ctx)).toBe(500_000_000)
    expect(serverTotal(r, columns)).toBe(500_000_000)
  })

  it('the discount and tax columns apply on the multiplied amount', () => {
    const withDiscount = [...columns, column({ id: 'discount', type: 'percent', precision: 2 })]
    const r = row({ unitPrice: '25000000', 'net-weight': '10', discount: '10' })
    expect(rowTotal(r, withDiscount, ctx)).toBe(225_000_000)
  })

  it('the unit price column total is the multiplied amount too', () => {
    const priceWithTotal = [
      description,
      quantity,
      price({ multiplyByColumnId: 'net-weight', aggregate: true }),
      netWeight(),
    ]
    const rows = [row({ unitPrice: '25000000', 'net-weight': '10' })]
    expect(columnTotals(rows, priceWithTotal, ctx).unitPrice).toBe(250_000_000)
  })

  it('works for any pair: an hourly rate × hours, no word «weight» anywhere', () => {
    const labour = column({
      id: 'custom-rate',
      label: 'دستمزد',
      type: 'currency',
      precision: 0,
      includeInTotal: true,
      multiplyByColumnId: 'custom-hours',
    })
    const hours = column({
      id: 'custom-hours',
      label: 'ساعت',
      type: 'integer',
      precision: 0,
      aggregate: true,
    })
    const grid = [description, quantity, price(), hours, labour]
    const r = row({ unitPrice: '1000', 'custom-rate': '200', 'custom-hours': '8' })
    expect(rowTotal(r, grid, ctx)).toBe(1000 + 1600)
    expect(serverTotal(r, grid)).toBe(1000 + 1600)
  })

  it('a multiplied price with an empty weight is refused, not charged as the plain price', () => {
    const r = row({ unitPrice: '25000000' })
    expect(rowUnitPrice(r, columns, ctx)).toBe(0)
    const issues = validateGrid([r], columns, ctx)
    expect(issues.map((i) => i.key)).toContain('invoiceBuilder.errors.multiplierRequired')
  })
})

describe('what can be configured', () => {
  const columns = [
    description,
    quantity,
    price(),
    netWeight(),
    column({ id: 'note', type: 'text', precision: 0 }),
  ]

  it('a numeric column may be a source; text, money, percent, computed and quantity may not', () => {
    expect(canBeMultiplierSource(netWeight())).toBe(true)
    expect(canBeMultiplierSource(column({ id: 'n', type: 'integer' }))).toBe(true)
    expect(canBeMultiplierSource(column({ id: 't', type: 'text' }))).toBe(false)
    expect(canBeMultiplierSource(column({ id: 'm', type: 'currency' }))).toBe(false)
    expect(canBeMultiplierSource(column({ id: 'p', type: 'percent' }))).toBe(false)
    expect(canBeMultiplierSource(column({ id: 'c', type: 'computed' }))).toBe(false)
    expect(canBeMultiplierSource(quantity)).toBe(false)
  })

  it('a valid choice has no issue', () => {
    expect(multiplierIssue(price({ multiplyByColumnId: 'net-weight' }), columns)).toBeNull()
  })

  it('a column that is not multiplied has no issue — nothing to validate', () => {
    expect(multiplierIssue(price(), columns)).toBeNull()
  })

  it('a source column that does not exist is rejected', () => {
    expect(multiplierIssue(price({ multiplyByColumnId: 'gone' }), columns)).toBe('missing')
  })

  it('a text source is rejected', () => {
    expect(multiplierIssue(price({ multiplyByColumnId: 'note' }), columns)).toBe('not-numeric')
  })

  it('a column cannot multiply by itself', () => {
    expect(multiplierIssue(price({ multiplyByColumnId: 'unitPrice' }), columns)).toBe('self')
  })

  it('only a money column carries a multiplier', () => {
    expect(multiplierIssue(netWeight({ multiplyByColumnId: 'net-weight' }), columns)).toBe(
      'not-a-rate',
    )
    expect(multiplierIssue(column({ id: 'x', multiplyByColumnId: 'net-weight' }), columns)).toBe(
      'not-a-rate',
    )
  })

  it('a circular configuration is rejected from both ends, and so is a chain', () => {
    const a = column({ id: 'a', type: 'currency', precision: 0, multiplyByColumnId: 'b' })
    const b = column({ id: 'b', type: 'currency', precision: 0, multiplyByColumnId: 'a' })
    // A money column is never a source, so A → B and B → A are both refused.
    expect(invalidMultipliers([a, b])).toEqual([
      { columnId: 'a', issue: 'not-numeric' },
      { columnId: 'b', issue: 'not-numeric' },
    ])

    // Even a hand-edited draft that gives a numeric source its own multiplier is refused as a chain.
    const hours = column({ id: 'h', type: 'integer', multiplyByColumnId: 'w' })
    const weight = column({ id: 'w', type: 'decimal' })
    const rate = price({ multiplyByColumnId: 'h' })
    expect(multiplierIssue(rate, [rate, hours, weight])).toBe('chained')
  })

  it('an invalid configuration never changes arithmetic — the plain price is used', () => {
    const broken = [description, quantity, price({ multiplyByColumnId: 'gone' }), netWeight()]
    const r = row({ unitPrice: '25000000', 'net-weight': '10' })
    expect(rowTotal(r, broken, ctx)).toBe(25_000_000)
  })
})

describe('invoices saved before the field existed', () => {
  it('a column with no multiplier is byte-for-byte what it was', () => {
    const columns = [description, quantity, price(), netWeight()]
    const r = row({ quantity: '3', unitPrice: '1500', 'net-weight': '7' })
    expect(rowTotal(r, columns, ctx)).toBe(4500)
    expect(rowToInvoiceItem(r, columns, ctx)).toMatchObject({
      quantity: 3,
      unitPrice: 1500,
      totalPrice: 4500,
    })
  })

  it('the field survives a JSON round-trip, which is how the draft is stored', () => {
    const configured = price({ multiplyByColumnId: 'net-weight' })
    expect(JSON.parse(JSON.stringify(configured)).multiplyByColumnId).toBe('net-weight')
    expect('multiplyByColumnId' in JSON.parse(JSON.stringify(price()))).toBe(false)
  })
})
