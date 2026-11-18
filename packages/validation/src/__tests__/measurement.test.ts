// ============================================
// MEASUREMENT — the necklace scenario, and the edge matrix around it.
//
// The regression this file pins: a product stocked and priced per gram must
// sell as grams, not silently as «one piece». 15 g × 33,000,000 = 495,000,000.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  COLUMN,
  applyInvoiceDefaults,
  defaultColumns,
  rowToInvoiceItem,
  rowTotal,
  validateGrid,
  type GridMoneyContext,
  type InvoiceGridRow,
} from '../schemas/invoice-grid'
import {
  INVOICE_UNIT_CHOICES,
  convertQuantity,
  cutLossIssue,
  isCountUnit,
  isMeasurementUnit,
  lineUnitIssue,
  seedQuantityForUnit,
  stockQuantityOfLine,
  unitDimension,
} from '../schemas/measurement.domain'

const AFN: GridMoneyContext = { currency: 'AFN', precision: 0, rates: {} }
const columns = defaultColumns('AFN')

function row(values: Record<string, string>, productUnit?: string): InvoiceGridRow {
  return { id: 'r1', ...(productUnit ? { productUnit } : {}), values }
}

describe('unit classification', () => {
  it('separates counted units from measured ones', () => {
    expect(isCountUnit('piece')).toBe(true)
    expect(isCountUnit('carton')).toBe(true)
    expect(isCountUnit('gram')).toBe(false)
    expect(isCountUnit('meter')).toBe(false)
    expect(unitDimension('liter')).toBe('volume')
    expect(isMeasurementUnit('kg')).toBe(true)
    expect(isMeasurementUnit('piece')).toBe(false)
    expect(unitDimension('custom')).toBe('custom')
  })

  it('offers every unit the schema accepts, without the custom placeholder', () => {
    expect(INVOICE_UNIT_CHOICES).toContain('ton')
    expect(INVOICE_UNIT_CHOICES).toContain('mg')
    expect(INVOICE_UNIT_CHOICES).toContain('cm')
    expect(INVOICE_UNIT_CHOICES).not.toContain('custom')
  })
})

describe('quantity seeding', () => {
  it('keeps «1» only where the unit is counted one by one', () => {
    expect(seedQuantityForUnit('piece')).toBe('1')
    expect(seedQuantityForUnit('dozen')).toBe('1')
    expect(seedQuantityForUnit('gram')).toBe('')
    expect(seedQuantityForUnit('meter')).toBe('')
    expect(seedQuantityForUnit(undefined)).toBe('')
  })
})

describe('defined conversions', () => {
  it('converts inside one dimension', () => {
    expect(convertQuantity(1.5, 'kg', 'gram')).toBe(1500)
    expect(convertQuantity(1500, 'gram', 'kg')).toBe(1.5)
    expect(convertQuantity(1, 'ton', 'gram')).toBe(1_000_000)
  })

  it('refuses to convert across dimensions and for custom units', () => {
    expect(convertQuantity(1, 'gram', 'piece')).toBeNull()
    expect(convertQuantity(1, 'kg', 'meter')).toBeNull()
    expect(convertQuantity(1, 'custom', 'gram')).toBeNull()
  })
})

describe('unit mismatch', () => {
  it('flags grams sold as pieces and allows kg ↔ gram', () => {
    expect(lineUnitIssue('gram', 'piece')).toBe('unit-mismatch')
    expect(lineUnitIssue('gram', 'kg')).toBeNull()
    expect(lineUnitIssue('gram', 'gram')).toBeNull()
    expect(lineUnitIssue(undefined, 'piece')).toBeNull()
    expect(lineUnitIssue('custom', 'piece')).toBeNull()
  })

  it('stops a mismatched line instead of repricing it silently', () => {
    const line = row(
      {
        [COLUMN.description]: 'گردنبند',
        [COLUMN.quantity]: '15',
        [COLUMN.unit]: 'piece',
        [COLUMN.unitPrice]: '33000000',
      },
      'gram',
    )
    const issues = validateGrid([line], columns, AFN)
    expect(issues.map((issue) => issue.key)).toContain('invoiceBuilder.errors.unitMismatch')
  })
})

describe('the necklace — 15 grams at 33,000,000 per gram', () => {
  const necklace = row(
    {
      [COLUMN.description]: 'گردنبند',
      [COLUMN.quantity]: '15',
      [COLUMN.unit]: 'gram',
      [COLUMN.unitPrice]: '33000000',
    },
    'gram',
  )

  it('totals 495,000,000 through the shared row rule', () => {
    expect(rowTotal(necklace, columns, AFN)).toBe(495_000_000)
  })

  it('maps to one gram line with quantity 15 and unit gram', () => {
    const item = rowToInvoiceItem(necklace, columns, AFN)
    expect(item).not.toBeNull()
    expect(item?.unit).toBe('gram')
    expect(item?.quantity).toBe(15)
    expect(item?.unitPrice).toBe(33_000_000)
    expect(item?.totalPrice).toBe(495_000_000)
  })

  it('accepts the line without a mismatch issue', () => {
    expect(validateGrid([necklace], columns, AFN)).toEqual([])
  })

  it('handles a half gram and a quantity equal to the stock', () => {
    const half = row(
      {
        [COLUMN.description]: 'گردنبند',
        [COLUMN.quantity]: '0.5',
        [COLUMN.unit]: 'gram',
        [COLUMN.unitPrice]: '33000000',
      },
      'gram',
    )
    expect(rowTotal(half, columns, AFN)).toBe(16_500_000)
  })

  it('keeps the line at zero when the quantity is still empty', () => {
    const empty = row(
      {
        [COLUMN.description]: 'گردنبند',
        [COLUMN.unit]: 'gram',
        [COLUMN.unitPrice]: '33000000',
      },
      'gram',
    )
    expect(rowTotal(empty, columns, AFN)).toBe(0)
  })
})

describe('invoice profile defaults', () => {
  it('shows an extra column without removing any', () => {
    const defaults = applyInvoiceDefaults(columns, { extraVisibleColumns: ['weightGrams'] })
    expect(defaults.find((c) => c.id === 'weightGrams')?.visible).toBe(true)
    expect(defaults.filter((c) => c.visible).length).toBe(
      columns.filter((c) => c.visible).length + 1,
    )
    expect(defaults.map((c) => c.id)).toEqual(columns.map((c) => c.id))
  })

  it('only sets a multiplier whose source really exists', () => {
    const ok = applyInvoiceDefaults(columns, {
      extraVisibleColumns: [],
      priceMultiplierSource: 'weightGrams',
    })
    expect(ok.find((c) => c.id === COLUMN.unitPrice)?.multiplyByColumnId).toBe('weightGrams')

    const missing = applyInvoiceDefaults(columns, {
      extraVisibleColumns: [],
      priceMultiplierSource: 'no-such-column',
    })
    expect(missing.find((c) => c.id === COLUMN.unitPrice)?.multiplyByColumnId).toBeUndefined()
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   WP-03 — «پرت برش» (cut loss)

   The scenario this pins: a 50 m roll, the customer buys 12.5 m, and 1.25 m is
   trimmed away and thrown out. The customer pays for 12.5 m; the shelf loses
   13.75 m. The two numbers are different on purpose, and nothing infers one
   from the other.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('cut loss — the rule', () => {
  it('accepts a loss on a measured unit and refuses it on a counted one', () => {
    // Measured: metres, grams, litres — a piece of the roll really is cut away.
    expect(cutLossIssue(1.25, 'meter')).toBeNull()
    expect(cutLossIssue(1.25, 'kg')).toBeNull()
    expect(cutLossIssue(1.25, 'liter')).toBeNull()
    // Counted: «2 pieces, 1 of them cut away» is not a cut. It is a stock
    // adjustment, and it must not leave the shelf through a sale.
    expect(cutLossIssue(1, 'piece')).toBe('CUT_LOSS_ON_COUNT_UNIT')
    expect(cutLossIssue(1, 'carton')).toBe('CUT_LOSS_ON_COUNT_UNIT')
    expect(cutLossIssue(1, 'dozen')).toBe('CUT_LOSS_ON_COUNT_UNIT')
    // `custom` has no dimension to judge by, so the figure stands as typed.
    expect(cutLossIssue(0.2, 'custom')).toBeNull()
  })

  it('treats «no loss recorded» as nothing to refuse', () => {
    expect(cutLossIssue(undefined, 'piece')).toBeNull()
    expect(cutLossIssue(null, 'piece')).toBeNull()
    expect(cutLossIssue(0, 'piece')).toBeNull()
  })

  it('refuses a negative loss instead of reading it as a refund', () => {
    expect(cutLossIssue(-0.5, 'meter')).toBe('CUT_LOSS_NEGATIVE')
    expect(cutLossIssue(Number.NaN, 'meter')).toBe('CUT_LOSS_NEGATIVE')
  })

  it('adds the loss to what the shelf loses, and only there', () => {
    // 12.5 + 1.25 = 13.75 metres leave the shelf.
    expect(stockQuantityOfLine({ quantity: 12.5, cutLossQuantity: 1.25 })).toBe(13.75)
    // Exact scale check beside the exact one: 0.1 + 0.2 must not drift.
    expect(stockQuantityOfLine({ quantity: 0.1, cutLossQuantity: 0.2 })).toBeCloseTo(0.3, 10)
    // No loss and no field at all are the same thing — «none was recorded».
    expect(stockQuantityOfLine({ quantity: 12.5 })).toBe(12.5)
    expect(stockQuantityOfLine({ quantity: 12.5, cutLossQuantity: null })).toBe(12.5)
  })
})

describe('cut loss — the invoice line', () => {
  const withLoss = (cutLoss: string, unit = 'meter'): InvoiceGridRow =>
    row({
      [COLUMN.description]: 'رول پارچه',
      [COLUMN.quantity]: '12.5',
      [COLUMN.unit]: unit,
      [COLUMN.unitPrice]: '200000',
      [COLUMN.cutLoss]: cutLoss,
    })

  it('carries the loss on its own field, never into the money', () => {
    const item = rowToInvoiceItem(withLoss('1.25'), columns, AFN)
    expect(item).not.toBeNull()
    // Money is on the sold 12.5 m: 12.5 × 200,000 = 2,500,000.
    expect(item!.quantity).toBe(12.5)
    expect(item!.cutLossQuantity).toBe(1.25)
    expect(rowTotal(withLoss('1.25'), columns, AFN)).toBe(2_500_000)
    // The same line without a loss is worth exactly the same.
    expect(rowTotal(withLoss(''), columns, AFN)).toBe(2_500_000)
  })

  it('omits the field entirely when the cell is empty or zero', () => {
    expect('cutLossQuantity' in rowToInvoiceItem(withLoss(''), columns, AFN)!).toBe(false)
    expect('cutLossQuantity' in rowToInvoiceItem(withLoss('0'), columns, AFN)!).toBe(false)
  })

  it('stops the row before sending it when the unit is counted', () => {
    const issues = validateGrid([withLoss('1', 'piece')], columns, AFN)
    expect(issues.map((issue) => issue.key)).toContain('invoiceBuilder.errors.cutLossOnCountUnit')
    // …and the metred line passes the same check.
    const ok = validateGrid([withLoss('1.25', 'meter')], columns, AFN)
    expect(ok.map((issue) => issue.key)).not.toContain('invoiceBuilder.errors.cutLossOnCountUnit')
  })
})
