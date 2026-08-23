// ============================================
// The rules the mobile card presentation depends on.
//
// The card decides what to put on its face and what to fold away, and the
// mobile list decides which rows are real items. Both are pure functions of
// the column configuration, so they are pinned here rather than only inside a
// component — a change that quietly makes a phone show ten fields, or show an
// empty card for the grid's trailing blank row, fails here first.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  COLUMN,
  defaultColumns,
  isRowFilled,
  isRowSubmittable,
  rowTotal,
  visibleColumns,
  type GridMoneyContext,
  type InvoiceColumn,
  type InvoiceGridRow,
} from '../schemas/invoice-grid'

const IRR: GridMoneyContext = { currency: 'IRR', precision: 0, rates: {} }

/** The four roles the card shows on its face — mirrors `PRIMARY_IDS`. */
const PRIMARY_IDS: readonly string[] = [
  COLUMN.description,
  COLUMN.quantity,
  COLUMN.unit,
  COLUMN.unitPrice,
]

function row(id: string, values: Record<string, string>): InvoiceGridRow {
  return { id, values }
}

function custom(id: string, label: string, type: InvoiceColumn['type']): InvoiceColumn {
  return { id, label, type, system: false, visible: true, aggregate: false, precision: 0 }
}

/** What the card folds behind «اطلاعات بیشتر» for a given row. */
function secondaryFor(
  r: InvoiceGridRow,
  columns: readonly InvoiceColumn[],
): readonly InvoiceColumn[] {
  return visibleColumns(columns).filter(
    (c) =>
      !PRIMARY_IDS.includes(c.id) &&
      c.type !== 'computed' &&
      (r.values[c.id] ?? '').trim().length > 0,
  )
}

describe('what the mobile card shows on its face', () => {
  it('keeps the face to four fields no matter how many columns are configured', () => {
    // A gold shop and a contractor configure completely different extras.
    const columns = [
      ...defaultColumns('IRR'),
      custom('custom-عیار', 'عیار', 'integer'),
      custom('custom-وزن', 'وزن', 'decimal'),
      custom('custom-اجرت', 'اجرت', 'currency'),
      custom('custom-کد-پروژه', 'کد پروژه', 'text'),
      custom('custom-درصد-پیشرفت', 'درصد پیشرفت', 'percent'),
    ]

    const onFace = visibleColumns(columns).filter((c) => PRIMARY_IDS.includes(c.id))
    expect(onFace).toHaveLength(4)
    expect(onFace.map((c) => c.id)).toEqual(PRIMARY_IDS)
  })

  it('folds every extra column away, whatever the trade calls them', () => {
    const columns = [
      ...defaultColumns('IRR'),
      custom('custom-عیار', 'عیار', 'integer'),
      custom('custom-کد-پروژه', 'کد پروژه', 'text'),
      custom('custom-ساعت-کار', 'ساعت کار', 'decimal'),
    ]
    const line = row('r', {
      description: 'کار',
      quantity: '1',
      unitPrice: '1000',
      'custom-عیار': '18',
      'custom-کد-پروژه': 'P-12',
      'custom-ساعت-کار': '7.5',
    })

    expect(secondaryFor(line, columns).map((c) => c.label)).toEqual([
      'عیار',
      'کد پروژه',
      'ساعت کار',
    ])
  })

  it('folds away only the extras that were actually filled in', () => {
    const columns = [
      ...defaultColumns('IRR'),
      custom('custom-عیار', 'عیار', 'integer'),
      custom('custom-کد-پروژه', 'کد پروژه', 'text'),
    ]
    const line = row('r', { description: 'کار', unitPrice: '1000', 'custom-عیار': '18' })

    // An empty extra is not a row of "—" on a phone; it is simply absent.
    expect(secondaryFor(line, columns).map((c) => c.id)).toEqual(['custom-عیار'])
  })

  it('never puts the computed total in the disclosure — it has its own band', () => {
    const columns = defaultColumns('IRR')
    const line = row('r', { description: 'کار', quantity: '2', unitPrice: '1000' })
    expect(secondaryFor(line, columns).some((c) => c.type === 'computed')).toBe(false)
  })
})

describe('which rows become cards', () => {
  const columns = defaultColumns('IRR')

  it('skips the grid trailing blank row so no empty card is drawn', () => {
    const rows = [
      row('a', { description: 'کالا', quantity: '1', unitPrice: '100' }),
      row('blank', {}),
    ]
    expect(rows.filter(isRowFilled).map((r) => r.id)).toEqual(['a'])
  })

  it('still shows a started-but-incomplete row, so it can be fixed', () => {
    // Typing a price and nothing else must not make the line disappear.
    const started = row('a', { unitPrice: '100' })
    expect(isRowFilled(started)).toBe(true)
    expect(isRowSubmittable(started)).toBe(false)
  })
})

describe('the card and the grid agree', () => {
  it('reads the line total from the same engine the table does', () => {
    const columns = defaultColumns('IRR')
    const line = row('r', { description: 'کالا', quantity: '3', unitPrice: '1000' })

    // The card renders `rowTotal(...)` directly; there is no card-side maths
    // to drift from the table's.
    expect(rowTotal(line, columns, IRR)).toBe(3000)
  })
})
