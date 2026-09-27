// Scale labels (27 Sep 2026): an EAN-13 from a shop scale carries a weight or
// a price. The line's quantity is the weight — stock moves by what was sold,
// not by «one piece». Off by default; a wrong check digit is refused.
import { COLUMN, type InvoiceGridRow } from '@hisabche/validation'
import { describe, expect, it } from 'vitest'

import { planScan } from '../lib/barcode/scan-into-invoice'
import {
  DEFAULT_SCALE_LABEL_CONFIG,
  ean13CheckDigit,
  parseScaleLabel,
  quantityOfLabel,
  sanitizeScaleLabelConfig,
  type ScaleLabelConfig,
} from '../lib/barcode/scale-label'

const on: ScaleLabelConfig = { ...DEFAULT_SCALE_LABEL_CONFIG, enabled: true }
const label = (first12: string) => first12 + String(ean13CheckDigit(first12))

describe('parseScaleLabel', () => {
  it('the check digit is the real EAN-13 one', () => {
    // A published EAN-13: 4006381333931.
    expect(ean13CheckDigit('400638133393')).toBe(1)
  })

  it('weight: 20 | 12345 | 01250 → product 2012345, 1.25 kg', () => {
    expect(parseScaleLabel(label('201234501250'), on)).toEqual({
      kind: 'weight',
      productCode: '2012345',
      quantity: 1.25,
    })
  })

  it('price: the amount, with the configured decimals', () => {
    const cfg: ScaleLabelConfig = { ...on, valueKind: 'price', decimals: 0 }
    expect(parseScaleLabel(label('210000100450'), cfg)).toEqual({
      kind: 'price',
      productCode: '2100001',
      amount: 450,
    })
  })

  it('⚠️ OFF by default — a shop without a scale never has codes read this way', () => {
    expect(parseScaleLabel(label('201234501250'), DEFAULT_SCALE_LABEL_CONFIG)).toBeNull()
  })

  it('⚠️ a wrong check digit is refused, never guessed', () => {
    const good = label('201234501250')
    const bad = good.slice(0, 12) + String((Number(good[12]) + 1) % 10)
    expect(parseScaleLabel(bad, on)).toBeNull()
  })

  it('an ordinary product code is not a label', () => {
    expect(parseScaleLabel('4006381333931', on)).toBeNull() // prefix 40
    expect(parseScaleLabel('12345', on)).toBeNull()
  })

  it('a zero value is not a sale', () => {
    expect(parseScaleLabel(label('201234500000'), on)).toBeNull()
  })
})

describe('quantityOfLabel', () => {
  it('a weight is the quantity', () => {
    expect(quantityOfLabel({ kind: 'weight', productCode: 'x', quantity: 0.75 }, 0)).toBe(0.75)
  })
  it('a price ÷ the unit price', () => {
    expect(quantityOfLabel({ kind: 'price', productCode: 'x', amount: 450 }, 300)).toBe(1.5)
  })
  it('⚠️ a price with no unit price is null — «one kilogram» would be a guess', () => {
    expect(quantityOfLabel({ kind: 'price', productCode: 'x', amount: 450 }, 0)).toBeNull()
  })
})

describe('settings are sanitised', () => {
  it('garbage becomes the defaults; digits stay inside what fits 13', () => {
    expect(sanitizeScaleLabelConfig({ itemDigits: 99, decimals: -1, prefixes: ['x', 1] })).toEqual({
      ...DEFAULT_SCALE_LABEL_CONFIG,
    })
  })
})

describe('planScan adds the weight', () => {
  const row = (id: string, productId: string | undefined, quantity: string): InvoiceGridRow =>
    ({
      id,
      productId,
      values: { [COLUMN.quantity]: quantity, [COLUMN.unit]: 'kg' },
    }) as InvoiceGridRow

  it('the same product again: + weight, not + 1', () => {
    const plan = planScan(
      [row('r1', 'p1', '0.5')],
      { id: 'p1', name: 'پنیر', price: '300', unit: 'kg' },
      0.75,
    )
    expect(plan).toEqual({ kind: 'increment', rowId: 'r1', quantity: '1.25' })
  })

  it('an ordinary scan still adds one', () => {
    const plan = planScan([row('r1', 'p1', '2')], { id: 'p1', name: 'x', price: '1', unit: 'kg' })
    expect(plan).toEqual({ kind: 'increment', rowId: 'r1', quantity: '3' })
  })
})
