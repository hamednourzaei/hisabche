// ============================================
// T8 — a column the customer pays for must reach the total.
//
// ---------------------------------------------------------------------------
// THE REPORTED DEFECT, IN THE OWNER'S WORDS
//
//   «الان درصد میزارم نوع رو و مثلا برای فروش طلا 18 درصد اجرت میذارم
//    با ستون کلی جمع نمیشه خب این ضعفه»
//
// A gold trader adds an «اجرت» column of type `percent`, puts 18 in it, and
// the invoice total does not move. `rowExtraMoney` began with:
//
//     if (column.type !== 'currency') return sum
//
// so every percent column was worth exactly zero.
//
// This is an ACCOUNTING defect, not a display one. The wrong figure is what
// gets printed, what posts to the ledger, and what the customer's balance is
// computed from.
//
// ---------------------------------------------------------------------------
// THE SECOND HALF, WHICH IS EASY TO MISS
//
// The grid computing the right total is not enough. The SERVER totals a saved
// item with `computeItemTotal`, which sums `quantity × amount` over the
// details. A percent column was persisted as `{ quantity: 18, amount: 0 }` —
// eighteen times nothing. So a fix in the grid alone would make the screen and
// the saved invoice disagree, which is worse than both being wrong.
//
// Every test below therefore checks BOTH sides of that boundary.
// ============================================

import { describe, expect, it } from 'vitest'

import { computeItemTotal } from '../schemas/invoice.schema'
import {
  columnCountsInTotal,
  rowExtraPercent,
  rowToInvoiceItem,
  rowTotal,
  summarize,
  type GridMoneyContext,
  type InvoiceColumn,
  type InvoiceGridRow,
} from '../schemas/invoice-grid'

const ctx: GridMoneyContext = { currency: 'AFN', precision: 0, rates: {} }

const column = (patch: Partial<InvoiceColumn> & { id: string }): InvoiceColumn => ({
  label: patch.id,
  type: 'currency',
  system: false,
  visible: true,
  aggregate: false,
  precision: 0,
  ...patch,
})

/** description + quantity + unitPrice, plus whatever the test adds. */
const baseColumns: InvoiceColumn[] = [
  column({ id: 'description', type: 'text', system: true }),
  column({ id: 'quantity', type: 'decimal', system: true, precision: 3 }),
  column({ id: 'unitPrice', type: 'currency', system: true }),
]

const row = (values: Record<string, string>): InvoiceGridRow => ({
  id: 'row-1',
  values: { description: 'انگشتر طلا', ...values },
})

describe('the gold example, end to end', () => {
  // 10 grams at 1,000,000 = 10,000,000, plus 18% اجرت = 1,800,000.
  const columns = [
    ...baseColumns,
    column({ id: 'ojrat', label: 'اجرت', type: 'percent', includeInTotal: true }),
  ]
  const goldRow = row({ quantity: '10', unitPrice: '1000000', ojrat: '18' })

  it('the grid total includes the making charge', () => {
    // Before T8 this was 10,000,000 — the number the customer does not pay.
    expect(rowTotal(goldRow, columns, ctx)).toBe(11_800_000)
  })

  it('⚠️ the SAVED item totals to the same figure', () => {
    const item = rowToInvoiceItem(goldRow, columns, ctx)!
    // This is the assertion that catches a grid-only fix. The server never
    // sees the grid; it sees these details.
    expect(computeItemTotal(item)).toBe(11_800_000)
  })

  it('the detail explains itself — the rate stays beside the amount', () => {
    const item = rowToInvoiceItem(goldRow, columns, ctx)!
    const ojrat = item.details.find((detail) => detail.title.includes('اجرت'))!
    expect(ojrat.amount).toBe(1_800_000)
    // An amount with no rate beside it cannot be checked by the customer, or
    // by whoever reads the invoice next year.
    expect(ojrat.title).toContain('18%')
  })

  it('the invoice summary carries it too', () => {
    const summary = summarize({
      rows: [goldRow],
      columns,
      ctx,
      discountValue: 0,
      discountType: 'fixed',
      taxRate: 0,
    })
    expect(summary.subtotal).toBe(11_800_000)
    expect(summary.total).toBe(11_800_000)
  })
})

describe('the toggle decides, per column', () => {
  const off = [...baseColumns, column({ id: 'ojrat', type: 'percent', includeInTotal: false })]
  const on = [...baseColumns, column({ id: 'ojrat', type: 'percent', includeInTotal: true })]
  const goldRow = row({ quantity: '10', unitPrice: '1000000', ojrat: '18' })

  it('off means the column is informational only', () => {
    expect(rowTotal(goldRow, off, ctx)).toBe(10_000_000)
  })

  it('on means it is charged', () => {
    expect(rowTotal(goldRow, on, ctx)).toBe(11_800_000)
  })

  it('a money column can be switched OFF too', () => {
    // The toggle is not «percent columns only». A حمل column recorded for
    // reference but paid separately must not inflate the invoice.
    const columns = [...baseColumns, column({ id: 'shipping', includeInTotal: false })]
    const r = row({ quantity: '1', unitPrice: '1000', shipping: '500' })
    expect(rowTotal(r, columns, ctx)).toBe(1000)
  })
})

describe('⚠️ columns saved before T8 keep their exact meaning', () => {
  // `includeInTotal: undefined` is a COMPATIBILITY RULE, not a default.
  // Getting this wrong changes the total of invoices that are already saved.
  const goldRow = row({ quantity: '10', unitPrice: '1000000', extra: '18' })

  it('a money column with no flag still counts, as it always did', () => {
    const columns = [...baseColumns, column({ id: 'extra', type: 'currency' })]
    expect(rowTotal(goldRow, columns, ctx)).toBe(10_000_018)
  })

  it('a percent column with no flag still does NOT count, as it always did', () => {
    // Defaulting this to true would silently raise the total of every
    // existing invoice that has a percent column on it.
    const columns = [...baseColumns, column({ id: 'extra', type: 'percent' })]
    expect(rowTotal(goldRow, columns, ctx)).toBe(10_000_000)
  })
})

describe('the built-in discount and tax are never double-counted', () => {
  it('the discount column is applied once, by name', () => {
    const columns = [
      ...baseColumns,
      column({ id: 'discount', type: 'percent', system: true, includeInTotal: true }),
    ]
    const r = row({ quantity: '1', unitPrice: '1000', discount: '10' })
    // 10% off 1000 = 900. Counting it as a SURCHARGE as well would give 990.
    expect(rowTotal(r, columns, ctx)).toBe(900)
    expect(columnCountsInTotal(columns[columns.length - 1]!)).toBe(false)
  })

  it('the tax column is applied once, by name', () => {
    const columns = [
      ...baseColumns,
      column({ id: 'tax', type: 'percent', system: true, includeInTotal: true }),
    ]
    const r = row({ quantity: '1', unitPrice: '1000', tax: '10' })
    expect(rowTotal(r, columns, ctx)).toBe(1100)
  })

  it('the unit price is not counted twice', () => {
    const r = row({ quantity: '2', unitPrice: '1000' })
    expect(rowTotal(r, baseColumns, ctx)).toBe(2000)
  })
})

describe('several percent columns add rather than compound', () => {
  it('18% + 2% is 20% of the base, not 18% then 2%', () => {
    // Compounding would make the ORDER of the columns change the price, and
    // the order is a display preference the user drags around.
    const columns = [
      ...baseColumns,
      column({ id: 'ojrat', type: 'percent', includeInTotal: true }),
      column({ id: 'maliat', type: 'percent', includeInTotal: true }),
    ]
    const r = row({ quantity: '1', unitPrice: '1000000', ojrat: '18', maliat: '2' })
    expect(rowExtraPercent(r, columns)).toBe(20)
    expect(rowTotal(r, columns, ctx)).toBe(1_200_000)
  })

  it('a percent is charged on the base PLUS the flat money columns', () => {
    // «زنجیر + سنگ» — the making charge is on the whole piece, not just the
    // chain.
    const columns = [
      ...baseColumns,
      column({ id: 'stone', type: 'currency', includeInTotal: true }),
      column({ id: 'ojrat', type: 'percent', includeInTotal: true }),
    ]
    const r = row({ quantity: '1', unitPrice: '1000', stone: '1000', ojrat: '10' })
    // (1000 + 1000) × 1.10 = 2200
    expect(rowTotal(r, columns, ctx)).toBe(2200)
  })

  it('the discount applies to the making charge too', () => {
    // What a shopkeeper means by «۱۰٪ تخفیف دادم» — off the whole price.
    const columns = [
      ...baseColumns,
      column({ id: 'discount', type: 'percent', system: true }),
      column({ id: 'ojrat', type: 'percent', includeInTotal: true }),
    ]
    const r = row({ quantity: '1', unitPrice: '1000', ojrat: '20', discount: '10' })
    // 1000 + 200 = 1200, less 10% = 1080
    expect(rowTotal(r, columns, ctx)).toBe(1080)
  })
})

describe('an empty percent cell charges nothing', () => {
  it('blank is not zero-point-something, and not the whole base', () => {
    const columns = [...baseColumns, column({ id: 'ojrat', type: 'percent', includeInTotal: true })]
    const r = row({ quantity: '1', unitPrice: '1000', ojrat: '' })
    expect(rowTotal(r, columns, ctx)).toBe(1000)
  })

  it('a zero percent produces no detail row at all', () => {
    const columns = [...baseColumns, column({ id: 'ojrat', type: 'percent', includeInTotal: true })]
    const r = row({ quantity: '1', unitPrice: '1000', ojrat: '0' })
    const item = rowToInvoiceItem(r, columns, ctx)!
    expect(item.details.some((detail) => detail.title.includes('ojrat'))).toBe(false)
  })
})
