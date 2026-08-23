// ============================================
// The invoice grid engine.
//
// Everything here is about money and about the promise that the preview shows
// what the builder showed. The UI is thin on purpose so these tests cover the
// parts that can be wrong in a way a shopkeeper would notice.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  COLUMN,
  canAggregate,
  canDeleteColumn,
  columnTotals,
  customColumnId,
  defaultColumns,
  emptyRow,
  moveColumn,
  parseCellNumber,
  roundTo,
  rowToInvoiceItem,
  rowTotal,
  summarize,
  toInvoiceCurrency,
  validateGrid,
  visibleColumns,
  type GridMoneyContext,
  type InvoiceColumn,
  type InvoiceGridRow,
} from '../schemas/invoice-grid'

const IRR: GridMoneyContext = { currency: 'IRR', precision: 0, rates: {} }

function row(id: string, values: Record<string, string>): InvoiceGridRow {
  return { id, values }
}

function withColumn(columns: InvoiceColumn[], column: InvoiceColumn): InvoiceColumn[] {
  return [...columns, column]
}

describe('money helpers', () => {
  it('rounds through scaled integers rather than raw floats', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE-754.
    expect(roundTo(0.1 + 0.2, 2)).toBe(0.3)
    expect(roundTo(2.675, 2)).toBe(2.68)
    expect(roundTo(114_349_999.999999, 0)).toBe(114_350_000)
  })

  it('parses Persian and Arabic digits and separators', () => {
    expect(parseCellNumber('۱۲٬۵۰۰')).toBe(12500)
    expect(parseCellNumber('١٠٫٢٥')).toBe(10.25)
    expect(parseCellNumber('35,700,000')).toBe(35700000)
    expect(parseCellNumber('')).toBe(0)
    expect(parseCellNumber('abc')).toBe(0)
  })

  it('refuses to convert without a rate instead of returning the raw number', () => {
    expect(toInvoiceCurrency(600, 'USD', IRR)).toBeNull()
    expect(toInvoiceCurrency(600, 'USD', { ...IRR, rates: { USD: 59_500 } })).toBe(35_700_000)
    expect(toInvoiceCurrency(600, 'IRR', IRR)).toBe(600)
  })
})

describe('default columns', () => {
  it('carries no trade-specific column', () => {
    const ids = defaultColumns('IRR').map((c) => c.id)
    expect(ids).not.toContain('karat')
    expect(ids).not.toContain('purity')
    expect(visibleColumns(defaultColumns('IRR')).map((c) => c.id)).toEqual([
      COLUMN.description,
      COLUMN.quantity,
      COLUMN.unit,
      COLUMN.unitPrice,
      COLUMN.lineTotal,
    ])
  })

  it('protects the columns the invoice cannot be saved without', () => {
    const columns = defaultColumns('IRR')
    const system = columns.filter((c) => !canDeleteColumn(c)).map((c) => c.id)
    expect(system).toEqual([
      COLUMN.description,
      COLUMN.quantity,
      COLUMN.unitPrice,
      COLUMN.lineTotal,
    ])
  })

  it('uses two decimals for USD and none for IRR', () => {
    const usd = defaultColumns('USD').find((c) => c.id === COLUMN.unitPrice)
    const irr = defaultColumns('IRR').find((c) => c.id === COLUMN.unitPrice)
    expect(usd?.precision).toBe(2)
    expect(irr?.precision).toBe(0)
  })
})

describe('rows and columns', () => {
  it('seeds a new row with each column default value', () => {
    const columns = withColumn(defaultColumns('IRR'), {
      id: 'custom-گارانتی',
      label: 'گارانتی',
      type: 'text',
      system: false,
      visible: true,
      aggregate: false,
      precision: 0,
      defaultValue: '۱۲ ماه',
    })
    expect(emptyRow('r1', columns).values['custom-گارانتی']).toBe('۱۲ ماه')
  })

  it('gives a colliding custom title a distinct id', () => {
    const columns = defaultColumns('IRR')
    const first = customColumnId('وزن خالص', columns)
    const second = customColumnId('وزن خالص', [
      ...columns,
      {
        id: first,
        label: 'وزن خالص',
        type: 'decimal',
        system: false,
        visible: true,
        aggregate: true,
        precision: 3,
      },
    ])
    expect(second).not.toBe(first)
  })

  it('reorders without dropping a column', () => {
    const columns = defaultColumns('IRR')
    const moved = moveColumn(columns, COLUMN.unit, -1)
    expect(moved.map((c) => c.id)).toContain(COLUMN.unit)
    expect(moved).toHaveLength(columns.length)
    expect(moved[1]?.id).toBe(COLUMN.unit)
  })

  it('does not move past either end', () => {
    const columns = defaultColumns('IRR')
    expect(moveColumn(columns, COLUMN.description, -1).map((c) => c.id)).toEqual(
      columns.map((c) => c.id),
    )
  })

  it('only lets numeric column types aggregate', () => {
    expect(canAggregate('decimal')).toBe(true)
    expect(canAggregate('currency')).toBe(true)
    expect(canAggregate('text')).toBe(false)
    expect(canAggregate('percent')).toBe(false)
    expect(canAggregate('boolean')).toBe(false)
  })
})

describe('line totals', () => {
  const columns = defaultColumns('IRR')

  it('multiplies quantity by unit price', () => {
    expect(
      rowTotal(
        row('r', { description: 'دستبند', quantity: '2', unitPrice: '28600000' }),
        columns,
        IRR,
      ),
    ).toBe(57_200_000)
  })

  it('treats a blank quantity as one', () => {
    expect(rowTotal(row('r', { description: 'انگشتر', unitPrice: '21450000' }), columns, IRR)).toBe(
      21_450_000,
    )
  })

  it('applies a per-row discount before a per-row tax', () => {
    const withPercents = columns.map((c) =>
      c.id === COLUMN.discount || c.id === COLUMN.tax ? { ...c, visible: true } : c,
    )
    // 1000 − 10% = 900, +9% tax = 981.
    expect(
      rowTotal(
        row('r', {
          description: 'خدمت',
          quantity: '1',
          unitPrice: '1000',
          discount: '10',
          tax: '9',
        }),
        withPercents,
        IRR,
      ),
    ).toBe(981)
  })

  it('adds a user-defined money column in the invoice currency', () => {
    const withFee = withColumn(columns, {
      id: 'custom-اجرت',
      label: 'اجرت',
      type: 'currency',
      system: false,
      visible: true,
      aggregate: true,
      precision: 0,
      currency: 'IRR',
    })
    expect(
      rowTotal(
        row('r', {
          description: 'گردنبند',
          quantity: '1',
          unitPrice: '1000000',
          'custom-اجرت': '250000',
        }),
        withFee,
        IRR,
      ),
    ).toBe(1_250_000)
  })

  it('never folds a foreign-currency column into the total without a rate', () => {
    const withUsd = withColumn(columns, {
      id: 'custom-usd',
      label: 'مبلغ (دلار)',
      type: 'currency',
      system: false,
      visible: true,
      aggregate: true,
      precision: 2,
      currency: 'USD',
    })
    const line = row('r', {
      description: 'گوشواره',
      quantity: '1',
      unitPrice: '1000000',
      'custom-usd': '600',
    })
    expect(rowTotal(line, withUsd, IRR)).toBe(1_000_000)
    // With a rate, and only then, it participates.
    expect(rowTotal(line, withUsd, { ...IRR, rates: { USD: 59_500 } })).toBe(1_000_000 + 35_700_000)
  })

  it('converts a foreign unit price at the supplied rate', () => {
    const usdPriced = columns.map((c) =>
      c.id === COLUMN.unitPrice ? { ...c, currency: 'USD' as const, precision: 2 } : c,
    )
    const line = row('r', { description: 'گوشواره', quantity: '2', unitPrice: '320' })
    expect(rowTotal(line, usdPriced, IRR)).toBe(0)
    expect(rowTotal(line, usdPriced, { ...IRR, rates: { USD: 59_500 } })).toBe(2 * 19_040_000)
  })
})

describe('column totals', () => {
  const columns = defaultColumns('IRR').map((c) =>
    c.id === COLUMN.weight ? { ...c, visible: true } : c,
  )
  const rows = [
    row('a', {
      description: 'گردنبند',
      quantity: '1',
      weightGrams: '10.250',
      unitPrice: '35700000',
    }),
    row('b', { description: 'دستبند', quantity: '2', weightGrams: '8.300', unitPrice: '28600000' }),
    row('c', {}), // the trailing blank row must not distort anything
  ]

  it('sums every aggregating column and leaves the rest undefined', () => {
    const totals = columnTotals(rows, columns, IRR)
    expect(totals[COLUMN.quantity]).toBe(3)
    expect(totals[COLUMN.weight]).toBe(18.55)
    expect(totals[COLUMN.lineTotal]).toBe(35_700_000 + 57_200_000)
    expect(totals[COLUMN.description]).toBeUndefined()
    expect(totals[COLUMN.unit]).toBeUndefined()
  })

  it('never sums a percentage, even if a caller marks it aggregatable', () => {
    const bad = columns.map((c) => (c.id === COLUMN.discount ? { ...c, aggregate: true } : c))
    expect(columnTotals(rows, bad, IRR)[COLUMN.discount]).toBeUndefined()
  })

  it('keeps decimals exact across many rows', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      row(`r${i}`, { description: 'x', weightGrams: '0.1', unitPrice: '1' }),
    )
    expect(columnTotals(many, columns, IRR)[COLUMN.weight]).toBe(1)
  })
})

describe('invoice summary', () => {
  const columns = defaultColumns('IRR')
  const rows = [
    row('a', { description: 'گردنبند', quantity: '1', unitPrice: '35700000' }),
    row('b', { description: 'دستبند', quantity: '2', unitPrice: '28600000' }),
    row('c', {}),
  ]

  it('counts only rows that will become items', () => {
    const summary = summarize({
      rows,
      columns,
      ctx: IRR,
      discountValue: 0,
      discountType: 'fixed',
      taxRate: 0,
    })
    expect(summary.itemCount).toBe(2)
    expect(summary.subtotal).toBe(92_900_000)
    expect(summary.total).toBe(92_900_000)
  })

  it('applies a fixed discount, then tax on the discounted amount', () => {
    const summary = summarize({
      rows,
      columns,
      ctx: IRR,
      discountValue: 900_000,
      discountType: 'fixed',
      taxRate: 9,
    })
    expect(summary.discountTotal).toBe(900_000)
    expect(summary.taxTotal).toBe(roundTo(92_000_000 * 0.09, 0))
    expect(summary.total).toBe(92_000_000 + summary.taxTotal)
  })

  it('applies a percentage discount', () => {
    const summary = summarize({
      rows,
      columns,
      ctx: IRR,
      discountValue: 10,
      discountType: 'percentage',
      taxRate: 0,
    })
    expect(summary.discountTotal).toBe(9_290_000)
    expect(summary.total).toBe(83_610_000)
  })

  it('never lets a discount push the total below zero', () => {
    const summary = summarize({
      rows,
      columns,
      ctx: IRR,
      discountValue: 999_999_999_999,
      discountType: 'fixed',
      taxRate: 0,
    })
    expect(summary.total).toBe(0)
  })

  it('reports a foreign column total separately from the invoice total', () => {
    const withUsd = withColumn(columns, {
      id: 'custom-usd',
      label: 'مبلغ (دلار)',
      type: 'currency',
      system: false,
      visible: true,
      aggregate: true,
      precision: 2,
      currency: 'USD',
    })
    const usdRows = [
      row('a', {
        description: 'گردنبند',
        quantity: '1',
        unitPrice: '35700000',
        'custom-usd': '600',
      }),
      row('b', {
        description: 'دستبند',
        quantity: '1',
        unitPrice: '28600000',
        'custom-usd': '480',
      }),
    ]
    const summary = summarize({
      rows: usdRows,
      columns: withUsd,
      ctx: IRR,
      discountValue: 0,
      discountType: 'fixed',
      taxRate: 0,
    })
    expect(summary.total).toBe(64_300_000)
    expect(summary.foreignTotals).toEqual([{ currency: 'USD', amount: 1080 }])
  })
})

describe('mapping to the invoice API', () => {
  const columns = defaultColumns('IRR')

  it('skips a row with no description', () => {
    expect(rowToInvoiceItem(row('r', { quantity: '2' }), columns, IRR)).toBeNull()
  })

  it('keeps quantity, unit and weight as three separate fields', () => {
    const withWeight = columns.map((c) => (c.id === COLUMN.weight ? { ...c, visible: true } : c))
    const item = rowToInvoiceItem(
      row('r', {
        description: 'گردنبند',
        quantity: '1',
        unit: 'piece',
        weightGrams: '12.5',
        unitPrice: '100',
      }),
      withWeight,
      IRR,
    )
    expect(item).toMatchObject({ quantity: 1, unit: 'piece', weightGrams: 12.5 })
  })

  it('sends a free-text unit as `custom` with its label', () => {
    const item = rowToInvoiceItem(
      row('r', { description: 'طناب', quantity: '1', unit: 'جفت', unitPrice: '100' }),
      columns,
      IRR,
    )
    expect(item?.unit).toBe('custom')
    expect(item?.unitLabel).toBe('جفت')
  })

  it('stores a user money column as a priced detail', () => {
    const withFee = withColumn(columns, {
      id: 'custom-اجرت',
      label: 'اجرت',
      type: 'currency',
      system: false,
      visible: true,
      aggregate: true,
      precision: 0,
      currency: 'IRR',
    })
    const item = rowToInvoiceItem(
      row('r', {
        description: 'گردنبند',
        quantity: '1',
        unitPrice: '1000000',
        'custom-اجرت': '250000',
      }),
      withFee,
      IRR,
    )
    expect(item?.details).toEqual([
      { title: 'اجرت', quantity: 1, amount: 250_000, unit: 'piece', sortOrder: 0 },
    ])
    expect(item?.totalPrice).toBe(1_250_000)
  })

  it('stores a non-money numeric column with a ZERO amount so no total is corrupted', () => {
    // This is the invariant the whole storage scheme rests on: a purity of 18
    // must never add 18 to the money.
    const withPurity = withColumn(columns, {
      id: 'custom-عیار',
      label: 'عیار',
      type: 'integer',
      system: false,
      visible: true,
      aggregate: false,
      precision: 0,
    })
    const line = row('r', {
      description: 'انگشتر',
      quantity: '1',
      unitPrice: '1000000',
      'custom-عیار': '18',
    })
    const item = rowToInvoiceItem(line, withPurity, IRR)
    expect(item?.details).toEqual([
      { title: 'عیار', quantity: 18, amount: 0, unit: 'piece', sortOrder: 0 },
    ])
    expect(item?.totalPrice).toBe(1_000_000)
    expect(rowTotal(line, withPurity, IRR)).toBe(1_000_000)
  })

  it('stores a foreign money column without adding it to the line', () => {
    const withUsd = withColumn(columns, {
      id: 'custom-usd',
      label: 'مبلغ (دلار)',
      type: 'currency',
      system: false,
      visible: true,
      aggregate: true,
      precision: 2,
      currency: 'USD',
    })
    const item = rowToInvoiceItem(
      row('r', {
        description: 'گوشواره',
        quantity: '1',
        unitPrice: '1000000',
        'custom-usd': '600',
      }),
      withUsd,
      IRR,
    )
    expect(item?.details[0]).toMatchObject({ title: 'مبلغ (دلار)', quantity: 600, amount: 0 })
    expect(item?.totalPrice).toBe(1_000_000)
  })

  it('puts text, date and choice columns into the item notes', () => {
    const extra: InvoiceColumn[] = [
      {
        id: 'custom-IMEI',
        label: 'IMEI',
        type: 'text',
        system: false,
        visible: true,
        aggregate: false,
        precision: 0,
      },
      {
        id: 'custom-گارانتی',
        label: 'گارانتی',
        type: 'select',
        system: false,
        visible: true,
        aggregate: false,
        precision: 0,
        options: ['۱۲ ماه'],
      },
    ]
    const item = rowToInvoiceItem(
      row('r', {
        description: 'گوشی',
        quantity: '1',
        unitPrice: '100',
        'custom-IMEI': '35673',
        'custom-گارانتی': '۱۲ ماه',
      }),
      [...columns, ...extra],
      IRR,
    )
    expect(item?.notes).toBe('IMEI: 35673 • گارانتی: ۱۲ ماه')
    expect(item?.details).toEqual([])
  })

  it('never sends a detail with a zero quantity, which the schema rejects', () => {
    const withFee = withColumn(columns, {
      id: 'custom-اجرت',
      label: 'اجرت',
      type: 'currency',
      system: false,
      visible: true,
      aggregate: true,
      precision: 0,
      currency: 'IRR',
    })
    const item = rowToInvoiceItem(
      row('r', { description: 'x', quantity: '1', unitPrice: '100', 'custom-اجرت': '0' }),
      withFee,
      IRR,
    )
    expect(item?.details).toEqual([])
  })
})

describe('validation', () => {
  const columns = defaultColumns('IRR')

  it('flags a filled row with no description', () => {
    const issues = validateGrid([row('r', { quantity: '2' })], columns, IRR)
    expect(issues.map((i) => i.key)).toContain('invoiceBuilder.errors.descriptionRequired')
  })

  it('flags a zero unit price, which the server would reject', () => {
    const issues = validateGrid([row('r', { description: 'x', quantity: '1' })], columns, IRR)
    expect(issues.map((i) => i.key)).toContain('invoiceBuilder.errors.priceRequired')
  })

  it('flags an empty grid', () => {
    const issues = validateGrid([row('r', {})], columns, IRR)
    expect(issues.map((i) => i.key)).toEqual(['invoiceBuilder.errors.noItems'])
  })

  it('passes a complete row', () => {
    expect(
      validateGrid(
        [row('r', { description: 'x', quantity: '1', unitPrice: '100' }), row('b', {})],
        columns,
        IRR,
      ),
    ).toEqual([])
  })
})

describe('preview consistency', () => {
  it('renders from the same visible columns the builder uses', () => {
    // The preview reads `visibleColumns(columns)` from the same store. Adding
    // and deleting a column therefore changes both, or neither.
    let columns = defaultColumns('IRR')
    const added: InvoiceColumn = {
      id: 'custom-وزن-خالص',
      label: 'وزن خالص',
      type: 'decimal',
      system: false,
      visible: true,
      aggregate: true,
      precision: 3,
    }
    columns = withColumn(columns, added)
    expect(visibleColumns(columns).map((c) => c.label)).toContain('وزن خالص')

    columns = columns.filter((c) => c.id !== COLUMN.unit)
    expect(visibleColumns(columns).map((c) => c.id)).not.toContain(COLUMN.unit)
  })

  it('agrees with the summary on the total', () => {
    const columns = defaultColumns('IRR')
    const rows = [row('a', { description: 'x', quantity: '3', unitPrice: '1000' })]
    const summary = summarize({
      rows,
      columns,
      ctx: IRR,
      discountValue: 0,
      discountType: 'fixed',
      taxRate: 0,
    })
    const totals = columnTotals(rows, columns, IRR)
    expect(totals[COLUMN.lineTotal]).toBe(summary.subtotal)
    expect(rowToInvoiceItem(rows[0]!, columns, IRR)?.totalPrice).toBe(summary.subtotal)
  })
})
