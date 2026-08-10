import { describe, expect, it } from 'vitest'

import {
  buildCustomerExportRows,
  CUSTOMER_EXPORT_COLUMNS,
  type ExportableInvoice,
} from '../customer-export'

const unitLabel = (unit: string, label?: string | undefined) =>
  unit === 'custom' ? (label ?? '') : unit

const build = (invoices: readonly ExportableInvoice[]) =>
  buildCustomerExportRows(invoices, { party: 'مجید طلافروش', unitLabel })

describe('buildCustomerExportRows', () => {
  it('emits one row per invoice line', () => {
    const rows = build([
      {
        invoiceNumber: 'INV-1',
        items: [
          { productName: 'گردنبند', quantity: 1, unitPrice: 100, totalPrice: 100 },
          { productName: 'زنجیر', quantity: 2, unitPrice: 50, totalPrice: 100 },
        ],
      },
    ])

    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.productName)).toEqual(['گردنبند', 'زنجیر'])
  })

  it('repeats invoice-level fields on every line so each row stands alone', () => {
    const rows = build([
      {
        invoiceNumber: 'INV-1',
        date: '1403-05-01',
        total: 200,
        paidAmount: 50,
        items: [{ productName: 'a' }, { productName: 'b' }],
      },
    ])

    for (const row of rows) {
      expect(row.invoiceNumber).toBe('INV-1')
      expect(row.date).toBe('1403-05-01')
      expect(row.invoiceTotal).toBe(200)
      expect(row.paidAmount).toBe(50)
      expect(row.remaining).toBe(150)
    }
  })

  it('does not flatten purchases into sales', () => {
    const rows = build([
      { invoiceNumber: 'S-1', type: 'sale', items: [{ productName: 'a' }] },
      { invoiceNumber: 'P-1', type: 'purchase', items: [{ productName: 'b' }] },
    ])

    expect(rows.map((r) => r.type)).toEqual(['sale', 'purchase'])
  })

  it('treats a legacy invoice with no type as a sale', () => {
    // Pre-migration rows have a null type; the backend queries read them as
    // sales, and the export must agree or the totals will not reconcile.
    const [row] = build([{ invoiceNumber: 'OLD-1', items: [{ productName: 'a' }] }])
    expect(row?.type).toBe('sale')
  })

  it('preserves quantity, unit and weight as distinct values', () => {
    // "10 grams of gold" and "1 necklace weighing 12.5 g" must not collapse.
    const rows = build([
      {
        items: [
          { productName: 'طلا', quantity: 10, unit: 'gram' },
          { productName: 'گردنبند', quantity: 1, unit: 'piece', weightGrams: 12.5 },
        ],
      },
    ])

    expect(rows[0]).toMatchObject({ quantity: 10, unit: 'gram', weightGrams: '' })
    expect(rows[1]).toMatchObject({ quantity: 1, unit: 'piece', weightGrams: 12.5 })
  })

  it('distinguishes a zero weight from an absent one', () => {
    const rows = build([{ items: [{ productName: 'a', weightGrams: 0 }, { productName: 'b' }] }])

    expect(rows[0]?.weightGrams).toBe(0)
    expect(rows[1]?.weightGrams).toBe('')
  })

  it('resolves a custom unit to the label the user typed', () => {
    const rows = build([
      { items: [{ productName: 'طلا', quantity: 1, unit: 'custom', unitLabel: 'مثقال' }] },
    ])

    expect(rows[0]?.unit).toBe('مثقال')
  })

  it('carries nested item details through the export', () => {
    const rows = build([
      {
        items: [
          {
            productName: 'گردنبند',
            details: [
              { title: 'سنگ', quantity: 1, amount: 5000 },
              { title: 'اجرت', quantity: 1, amount: 2000 },
            ],
          },
        ],
      },
    ])

    expect(rows[0]?.details).toBe('سنگ: 1 × 5000 | اجرت: 1 × 2000')
  })

  it('keeps an invoice with no line items rather than dropping it', () => {
    const rows = build([{ invoiceNumber: 'INV-EMPTY', total: 500, paidAmount: 0 }])

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ invoiceNumber: 'INV-EMPTY', productName: '', remaining: 500 })
  })

  it('never reports a negative remaining balance on an overpaid invoice', () => {
    const [row] = build([{ total: 100, paidAmount: 150, items: [{ productName: 'a' }] }])
    expect(row?.remaining).toBe(0)
  })

  it('produces every declared column on every row', () => {
    const rows = build([
      { invoiceNumber: 'INV-1', items: [{ productName: 'a' }] },
      { invoiceNumber: 'INV-2' },
    ])

    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([...CUSTOMER_EXPORT_COLUMNS].sort())
    }
  })

  it('returns nothing for an empty statement', () => {
    expect(build([])).toEqual([])
  })
})
