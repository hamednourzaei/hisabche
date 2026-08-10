// ============================================
// Export semantics.
//
// An export is the one artefact that leaves the product and gets filed,
// reconciled and argued over. These tests pin the properties an accountant
// would notice if they broke: a purchase must never be filed as a sale, a
// weight must not vanish, and a comma in a name must not shift every column.
// ============================================

import { describe, expect, it } from 'vitest'

import { exportToCSV } from '../export'
import { buildCustomerExportRows, type ExportableInvoice } from '../customers/customer-export'

// exportToCSV writes to the DOM; capture the produced text instead of the file.
function captureCsv<T>(rows: T[], columns: { key: keyof T; label: string }[]): string {
  let captured = ''

  const originalBlob = globalThis.Blob
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL
  const originalCreateElement = document.createElement.bind(document)

  class CapturingBlob {
    constructor(parts: string[]) {
      captured = parts.join('')
    }
  }

  globalThis.Blob = CapturingBlob as unknown as typeof Blob
  URL.createObjectURL = () => 'blob:stub'
  URL.revokeObjectURL = () => undefined
  document.createElement = ((tag: string) => {
    const el = originalCreateElement(tag)
    if (tag === 'a') (el as HTMLAnchorElement).click = () => undefined
    return el
  }) as typeof document.createElement

  try {
    exportToCSV(rows, columns, 'test')
  } finally {
    globalThis.Blob = originalBlob
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
    document.createElement = originalCreateElement
  }

  return captured
}

describe('exportToCSV', () => {
  it('escapes a value containing a comma so columns do not shift', () => {
    const csv = captureCsv(
      [{ name: 'Sharifi, Majid', total: 100 }],
      [
        { key: 'name', label: 'Name' },
        { key: 'total', label: 'Total' },
      ],
    )

    expect(csv).toContain('"Sharifi, Majid"')
    // Header plus exactly one data row — the comma did not create a third.
    expect(csv.trim().split('\n')).toHaveLength(2)
  })

  it('escapes embedded quotes by doubling them', () => {
    const csv = captureCsv([{ name: 'A "B" C' }], [{ key: 'name', label: 'Name' }])
    expect(csv).toContain('"A ""B"" C"')
  })

  it('writes a BOM so Excel renders Persian correctly', () => {
    const csv = captureCsv([{ name: 'مجید' }], [{ key: 'name', label: 'نام' }])
    expect(csv.startsWith('﻿')).toBe(true)
  })

  it('renders null and undefined as empty cells rather than the words', () => {
    const csv = captureCsv(
      [{ a: null as unknown as string, b: undefined as unknown as string }],
      [
        { key: 'a', label: 'A' },
        { key: 'b', label: 'B' },
      ],
    )

    expect(csv).not.toContain('null')
    expect(csv).not.toContain('undefined')
  })

  it('writes nothing for an empty data set', () => {
    expect(captureCsv([] as { a: string }[], [{ key: 'a', label: 'A' }])).toBe('')
  })
})

describe('customer statement export — transaction semantics', () => {
  const unitLabel = (unit: string, label?: string | undefined) =>
    unit === 'custom' ? (label ?? '') : unit

  const rowsFor = (invoices: readonly ExportableInvoice[]) =>
    buildCustomerExportRows(invoices, { party: 'مجید طلافروش', unitLabel })

  it('keeps a purchase labelled purchase through the CSV writer', () => {
    const rows = rowsFor([
      { invoiceNumber: 'P-1', type: 'purchase', items: [{ productName: 'طلا' }] },
    ])

    const csv = captureCsv(rows, [
      { key: 'invoiceNumber', label: 'No' },
      { key: 'type', label: 'Type' },
    ])

    expect(csv).toContain('purchase')
    expect(csv).not.toContain('"sale"')
  })

  it('does not merge a sale and a purchase for the same party', () => {
    const rows = rowsFor([
      { invoiceNumber: 'S-1', type: 'sale', total: 100, items: [{ productName: 'a' }] },
      { invoiceNumber: 'P-1', type: 'purchase', total: 200, items: [{ productName: 'b' }] },
    ])

    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.type)).toEqual(['sale', 'purchase'])
    expect(rows.map((r) => r.invoiceTotal)).toEqual([100, 200])
  })

  it('survives a full round trip with weight, unit and nested details intact', () => {
    const rows = rowsFor([
      {
        invoiceNumber: 'P-9',
        type: 'purchase',
        items: [
          {
            productName: 'گردنبند',
            quantity: 1,
            unit: 'piece',
            weightGrams: 12.5,
            details: [
              { title: 'سنگ', quantity: 1, amount: 5000 },
              { title: 'اجرت', quantity: 1, amount: 2000 },
            ],
          },
        ],
      },
    ])

    const csv = captureCsv(rows, [
      { key: 'type', label: 'Type' },
      { key: 'unit', label: 'Unit' },
      { key: 'weightGrams', label: 'Weight' },
      { key: 'details', label: 'Details' },
    ])

    expect(csv).toContain('purchase')
    expect(csv).toContain('piece')
    expect(csv).toContain('12.5')
    expect(csv).toContain('سنگ')
    expect(csv).toContain('اجرت')
  })

  it('exports a custom unit using the label the user typed', () => {
    const rows = rowsFor([
      { items: [{ productName: 'طلا', quantity: 2, unit: 'custom', unitLabel: 'مثقال' }] },
    ])

    const csv = captureCsv(rows, [{ key: 'unit', label: 'Unit' }])
    expect(csv).toContain('مثقال')
    expect(csv).not.toContain('custom')
  })

  it('keeps a historical invoice with no details exporting correctly', () => {
    // Rows created before item details existed must still produce a full line,
    // with an empty details cell rather than a dropped row.
    const rows = rowsFor([
      { invoiceNumber: 'OLD-1', total: 50, items: [{ productName: 'قند', quantity: 3 }] },
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0]?.details).toBe('')
    expect(rows[0]?.type).toBe('sale')
    expect(rows[0]?.quantity).toBe(3)
  })

  it('distinguishes 10 grams of gold from one necklace weighing 12.5 g', () => {
    const rows = rowsFor([
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
})
