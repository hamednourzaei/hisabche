import { describe, expect, it } from 'vitest'
import {
  compareSupplierQuotations,
  canConvertQuotationToPo,
  resolvePurchaseContractPrice,
} from '@hisabche/validation'

describe('B.2.13 & B.2.14 RFQ quotations & Long-term purchase contracts', () => {
  it('compares quotations by total and by line and rejects expired quotation conversion', () => {
    const cmp = compareSupplierQuotations([
      {
        id: 'q1',
        supplierId: 's1',
        currency: 'AFN',
        validUntil: '2026-12-31',
        totalMinor: 5000,
        lines: [{ productId: 'p1', quantity: 5, unitPriceMinor: 1000 }],
      },
      {
        id: 'q2',
        supplierId: 's2',
        currency: 'AFN',
        validUntil: '2026-12-31',
        totalMinor: 4500,
        lines: [{ productId: 'p1', quantity: 5, unitPriceMinor: 900 }],
      },
    ])
    expect(cmp.byTotal[0]?.id).toBe('q2')
    expect(cmp.bestByLine['p1']?.supplierId).toBe('s2')

    expect(
      canConvertQuotationToPo({ validUntil: '2026-01-01', status: 'submitted' }, '2026-06-01'),
    ).toEqual({ ok: false, code: 'QUOTATION_EXPIRED' })
  })

  it('defaults PO line to contract price and flags deviations', () => {
    const rules = [
      {
        productId: 'p1',
        agreedUnitPriceMinor: 1200,
        currency: 'AFN',
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      },
    ]
    expect(resolvePurchaseContractPrice(rules, 'p1', '2026-06-01', 1200)).toEqual({
      matched: true,
      defaultPriceMinor: 1200,
      deviationFlag: false,
    })
    expect(resolvePurchaseContractPrice(rules, 'p1', '2026-06-01', 1350)).toEqual({
      matched: true,
      defaultPriceMinor: 1200,
      deviationFlag: true,
    })
    expect(resolvePurchaseContractPrice(rules, 'p1', '2027-01-01', 1350).matched).toBe(false)
  })
})
