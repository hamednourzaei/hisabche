import { describe, it, expect } from 'vitest'
import {
  planReordersWithPackRounding,
  evaluateThreeWayMatch,
  buildSupplierScorecard,
  MIN_PURCHASES_FOR_A_SCORE,
} from '../index'

const SUP_A = '11111111-1111-4111-8111-111111111111'
const PROD_1 = '22222222-2222-4222-8222-222222222222'
const PROD_2 = '33333333-3333-4333-8333-333333333333'
const VAR_A = '44444444-4444-4444-8444-444444444444'
const VAR_B = '55555555-5555-4555-8555-555555555555'

describe('V60 Slice 10 — Procurement planning, pack rounding, 3-way match & scorecard', () => {
  it('rounds deficit up to purchase pack size while subtracting open PO stock, and requires human approval', () => {
    // target = max(reorderLevel=20, demand=3*10=30) = 30; available = 15 - 2 + 2 = 15; deficit = 15; pack=6 => 18 (3 packs)
    const result = planReordersWithPackRounding([
      {
        productId: PROD_1,
        supplierId: SUP_A,
        onHand: 15,
        reservedQuantity: 2,
        openPoQuantity: 2,
        reorderLevel: 20,
        demandForecastDaily: 3,
        leadTimeDays: 10,
        purchasePackSize: 6,
        unitPrice: 120,
      },
      {
        productId: PROD_2,
        supplierId: SUP_A,
        onHand: 50,
        openPoQuantity: 0,
        reorderLevel: 10,
        purchasePackSize: 12,
        unitPrice: 50,
      },
    ])

    expect(result.requiresHumanApproval).toBe(true)
    expect(result.lines[0]).toMatchObject({
      productId: PROD_1,
      rawDeficit: 15,
      packSize: 6,
      roundedQuantity: 18,
      packsCount: 3,
    })
    expect(result.lines[1]?.roundedQuantity).toBe(0)
    expect(result.draftPlan.ok).toBe(true)
    if (result.draftPlan.ok) {
      expect(result.draftPlan.groups).toHaveLength(1)
      expect(result.draftPlan.groups[0]?.lines[0]?.quantity).toBe(18)
    }
  })

  it('refuses payment approval when partial receipt / QTY_SHORT occurs', () => {
    const res = evaluateThreeWayMatch({
      poLines: [{ productId: PROD_1, quantity: 10, unitPriceMinor: 5000 }],
      receiptLines: [{ productId: PROD_1, quantity: 7 }],
      invoiceLines: [{ productId: PROD_1, quantity: 10, unitPriceMinor: 5000 }],
    })
    expect(res.matched).toBe(false)
    expect(res.mayApprovePayment).toBe(false)
    expect(res.mismatches.some((m) => m.code === 'QTY_SHORT')).toBe(true)
  })

  it('flags OVER_RECEIPT and PRICE_DRIFT explicitly and never silently corrects', () => {
    const res = evaluateThreeWayMatch({
      poLines: [{ productId: PROD_1, quantity: 10, unitPriceMinor: 5000 }],
      receiptLines: [{ productId: PROD_1, quantity: 12 }],
      invoiceLines: [{ productId: PROD_1, quantity: 10, unitPriceMinor: 5500 }],
    })
    expect(res.matched).toBe(false)
    expect(res.mayApprovePayment).toBe(false)
    expect(res.mismatches.map((m) => m.code).sort()).toEqual(['OVER_RECEIPT', 'PRICE_DRIFT'])
    const priceDrift = res.mismatches.find((m) => m.code === 'PRICE_DRIFT')
    expect(priceDrift?.orderedUnitPriceMinor).toBe(5000)
    expect(priceDrift?.invoicedUnitPriceMinor).toBe(5500)
  })

  it('flags VARIANT_MISMATCH when received/billed variant differs from PO variant', () => {
    const res = evaluateThreeWayMatch({
      poLines: [{ productId: PROD_1, variantId: VAR_A, quantity: 5, unitPriceMinor: 1000 }],
      receiptLines: [{ productId: PROD_1, variantId: VAR_B, quantity: 5 }],
      invoiceLines: [{ productId: PROD_1, variantId: VAR_A, quantity: 5, unitPriceMinor: 1000 }],
    })
    expect(res.matched).toBe(false)
    expect(res.mayApprovePayment).toBe(false)
    expect(res.mismatches.some((m) => m.code === 'VARIANT_MISMATCH')).toBe(true)
  })

  it('grants payment approval only when PO, receipt, and invoice match on qty, variant, and price', () => {
    const res = evaluateThreeWayMatch({
      poLines: [{ productId: PROD_1, variantId: VAR_A, quantity: 6, unitPriceMinor: 2500 }],
      receiptLines: [{ productId: PROD_1, variantId: VAR_A, quantity: 6 }],
      invoiceLines: [{ productId: PROD_1, variantId: VAR_A, quantity: 6, unitPriceMinor: 2500 }],
    })
    expect(res.matched).toBe(true)
    expect(res.mayApprovePayment).toBe(true)
    expect(res.mismatches).toEqual([])
  })

  it('computes supplier scorecard using canonical scoreSupplier thresholds', () => {
    const rows = buildSupplierScorecard(
      [{ supplierId: SUP_A, name: 'Supplier Alpha', active: true }],
      Array.from({ length: MIN_PURCHASES_FOR_A_SCORE }, (_, i) => ({
        supplierId: SUP_A,
        productId: PROD_1,
        quantity: 1,
        orderedDate: `2026-01-0${i + 1}`,
        receivedDate: `2026-01-${String(i + 1 + 14).padStart(2, '0')}`,
        amountMinor: 12500,
        listPriceMinor: 10000,
      })),
      '2026-02-01',
    )
    expect(rows[0]?.band).toBe('high')
    expect(rows[0]?.signals.some((s) => s.key === 'LATE_DELIVERY')).toBe(true)
    expect(rows[0]?.signals.some((s) => s.key === 'PRICE_DRIFT')).toBe(true)
  })
})
