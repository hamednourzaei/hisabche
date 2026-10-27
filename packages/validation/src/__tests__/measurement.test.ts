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
  isCountUnit,
  isMeasurementUnit,
  lineUnitIssue,
  seedQuantityForUnit,
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
