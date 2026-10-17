// ============================================
// The movements export — the file an accountant opens must say the same thing
// as the table on screen: a purchase is a purchase, a decrease is a decrease,
// quantities are NUMBERS (so a spreadsheet can sum them), and a part that is
// not there is «—», never zero.
// ============================================

import { describe, expect, it } from 'vitest'

import type { StockMovementRecord } from '@hisabche/api'

import {
  MOVEMENT_TYPES,
  movementDirectionWord,
  movementExportFilename,
  movementExportMarkdown,
  movementExportRecords,
  movementExportTable,
  movementPlace,
  movementTypeWord,
} from '../warehouse/movement-export'

const words: Record<string, string> = {
  'warehouse.movementType.sale': 'فروش',
  'warehouse.movementType.purchase': 'خرید',
  'warehouse.movementType.adjustment': 'تعدیل',
  'warehouse.movementIn': 'افزایش',
  'warehouse.movementOut': 'کاهش',
  'common.date': 'تاریخ',
  'common.type': 'نوع',
  'warehouse.direction': 'جهت',
  'warehouse.warehouseName': 'انبار',
  'warehouse.change': 'تغییر',
  'warehouse.balance': 'مانده',
  'warehouse.source': 'مبدأ',
  'evidence.source.invoice': 'فاکتور',
}
const t = (key: string, fallback?: string) => words[key] ?? fallback ?? key
const dateTime = (iso: string) => `when(${iso})`

function movement(overrides: Partial<StockMovementRecord>): StockMovementRecord {
  return {
    id: 'm1',
    type: 'sale',
    quantity: -2,
    referenceType: null,
    referenceId: null,
    notes: null,
    fromWarehouseId: null,
    toWarehouseId: null,
    createdAt: '2026-10-01T08:00:00.000Z',
    balance: 3,
    ...overrides,
  }
}

const names = new Map([
  ['a', 'انبار تست'],
  ['b', 'انبار مرکزی'],
])

describe('the words', () => {
  it('a known type is asked of the catalogue, an unknown one is shown as sent', () => {
    expect(movementTypeWord('sale', t)).toBe('فروش')
    expect(movementTypeWord('something_new', t)).toBe('something_new')
    expect(MOVEMENT_TYPES).toContain('adjustment')
  })

  it('a negative quantity is a decrease, zero or more an increase', () => {
    expect(movementDirectionWord(-2, t)).toBe('کاهش')
    expect(movementDirectionWord(0, t)).toBe('افزایش')
    expect(movementDirectionWord(5, t)).toBe('افزایش')
  })

  it('a transfer reads from ← to; a one-sided movement reads its side; neither is null', () => {
    expect(movementPlace(movement({ fromWarehouseId: 'a', toWarehouseId: 'b' }), names)).toBe(
      'انبار تست ← انبار مرکزی',
    )
    expect(movementPlace(movement({ toWarehouseId: 'b' }), names)).toBe('انبار مرکزی')
    expect(movementPlace(movement({ fromWarehouseId: 'a' }), names)).toBe('انبار تست')
    expect(movementPlace(movement({ fromWarehouseId: 'gone' }), names)).toBeNull()
    expect(movementPlace(movement({}), names)).toBeNull()
  })
})

describe('the table', () => {
  const table = movementExportTable(
    [
      movement({
        id: 'm1',
        type: 'purchase',
        quantity: 5,
        toWarehouseId: 'b',
        balance: 5,
        referenceType: 'invoice',
      }),
      movement({ id: 'm2', fromWarehouseId: 'b', balance: 3, notes: 'فروش به علی' }),
      movement({ id: 'm3', type: 'adjustment', quantity: 0, balance: 0, createdAt: null }),
    ],
    { t, dateTime, warehouseNames: names },
  )

  it('seven columns, unique headers, in reading order', () => {
    expect(table.headers).toEqual(['تاریخ', 'نوع', 'جهت', 'انبار', 'تغییر', 'مانده', 'مبدأ'])
    expect(new Set(table.headers).size).toBe(table.headers.length)
  })

  it('says what happened, where, how much, and where it came from — numbers as numbers', () => {
    expect(table.rows[0]).toEqual([
      'when(2026-10-01T08:00:00.000Z)',
      'خرید',
      'افزایش',
      'انبار مرکزی',
      5,
      5,
      'فاکتور',
    ])
    // A note on the movement wins over the document kind — it is the human word.
    expect(table.rows[1]).toEqual([
      'when(2026-10-01T08:00:00.000Z)',
      'فروش',
      'کاهش',
      'انبار مرکزی',
      -2,
      3,
      'فروش به علی',
    ])
    expect(typeof table.rows[1]![4]).toBe('number')
    expect(typeof table.rows[1]![5]).toBe('number')
  })

  it('a missing date or source is «—», never today and never zero', () => {
    expect(table.rows[2]![0]).toBe('—')
    expect(table.rows[2]![6]).toBe('—')
  })

  it('the xlsx records keep every column paired with its header', () => {
    const records = movementExportRecords(table)
    expect(Object.keys(records[0]!)).toEqual(table.headers)
    expect(records[1]!['تغییر']).toBe(-2)
    expect(records[1]!['انبار']).toBe('انبار مرکزی')
  })
})

describe('the Markdown document', () => {
  const table = movementExportTable([movement({ notes: 'a | b' })], {
    t,
    dateTime,
    warehouseNames: names,
  })

  it('is a title, the table, and nothing invented', () => {
    const md = movementExportMarkdown(table, {
      title: 'افزایش و کاهش موجودی',
      productName: 'شال',
      warning: '',
    })
    expect(md).toContain('# افزایش و کاهش موجودی — شال')
    expect(md).toContain('| تاریخ | نوع | جهت | انبار | تغییر | مانده | مبدأ |')
    expect(md).toContain('| --- | --- | --- | --- | --- | --- | --- |')
    // A pipe inside a value cannot shift every column after it.
    expect(md).toContain('a \\| b')
    expect(md).not.toContain('⚠️')
  })

  it('a short history is warned about in the file, not only on screen', () => {
    const md = movementExportMarkdown(table, {
      title: 't',
      productName: '',
      warning: 'جمع این حرکت‌ها با موجودی ثبت‌شده یکی نیست',
    })
    expect(md).toContain('> ⚠️ جمع این حرکت‌ها با موجودی ثبت‌شده یکی نیست')
    expect(md.startsWith('# t\n')).toBe(true)
  })
})

describe('the filename', () => {
  const today = new Date(2026, 9, 17)

  it('carries the product name and the day, without characters a filesystem refuses', () => {
    expect(movementExportFilename('شال ابریشمی', today)).toBe('شال ابریشمی-movements-2026-10-17')
    expect(movementExportFilename('a/b:c*d?e"f<g>h|i', today)).toBe(
      'a b c d e f g h i-movements-2026-10-17',
    )
    expect(movementExportFilename('   ', today)).toBe('stock-movements-2026-10-17')
  })
})
