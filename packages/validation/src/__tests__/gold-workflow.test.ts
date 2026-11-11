import { describe, expect, it } from 'vitest'
import {
  applyPrice,
  gramsToMilligrams,
  milligramsToGrams,
  planSecondHandGoldPurchase,
  priceGoldLineWithSnapshot,
  quoteGoldItemPrice,
  reconcileGoldLocationWeights,
  recordGoldMeltScrapMovement,
  summarizeGoldReportByKarat,
  validateGoldItemWeights,
} from '../index'

describe('8.5 Gold Trade: Integer Weight, Purity Pricing, Snapshot Immutability, Second-Hand & Melt', () => {
  it('stores integer milligram weights and computes purity + making charge + profit + tax via quotePrice/applyPrice', () => {
    const mg = gramsToMilligrams(10.5)
    expect(mg).toBe(10_500)
    expect(milligramsToGrams(mg)).toBe(10.5)

    const spec = validateGoldItemWeights({
      uniqueCode: 'GLD-001',
      karat: 21,
      grossWeightMg: 12_000,
      stoneWeightMg: 1_500,
      location: 'showcase',
    })
    expect(spec.netWeightMg).toBe(10_500)

    const snapshot = {
      rate24kMinorPerGram: 8_000,
      capturedAt: '2026-11-11T08:00:00Z',
      capturedBy: 'user-jeweller-1',
    }
    const calc = priceGoldLineWithSnapshot({
      productId: 'gold-ring-1',
      karat: 21,
      netWeightMg: spec.netWeightMg,
      rateSnapshot: snapshot,
      makingChargeType: 'percentage',
      makingChargeValue: 10,
      profitBp: 500, // 5%
      taxBp: 0,
    })
    // 10.5g * (8000 * 21 / 24) = 10.5 * 7000 = 73500 metal + 7350 making = 80850; + 5% profit (4043) = 84893
    expect(calc.metalValueMinor).toBe(73_500)
    expect(calc.makingChargeMinor).toBe(7_350)
    expect(calc.profitMinor).toBe(4_043)
    expect(calc.totalMinor).toBe(84_893)

    // Wire through unified quotePrice / applyPrice
    const quote = quoteGoldItemPrice(
      { productId: 'gold-ring-1', kind: 'sale', quantity: 1 },
      {
        karat: 21,
        netWeightMg: spec.netWeightMg,
        rateSnapshot: snapshot,
        makingChargeType: 'percentage',
        makingChargeValue: 10,
        profitBp: 500,
      },
      undefined,
      [],
      '2026-11-11',
    )
    expect(quote.unitPriceMinor).toBe(84_893)
    const applied = applyPrice([{ productId: 'gold-ring-1', quantity: 1 }], [quote])
    expect(applied[0]?.unitPrice).toBe(848.93)

    // Historical line snapshot remains unchanged even if board rate moves to 9000
    expect(calc.rateSnapshot.rate24kMinorPerGram).toBe(8_000)
  })

  it('handles second-hand customer purchase with KYC check, melt loss, and showcase variance', () => {
    expect(() =>
      planSecondHandGoldPurchase({
        scrapWeightMg: 5_000,
        scrapKarat: 18,
        rateSnapshot: {
          rate24kMinorPerGram: 8_000,
          capturedAt: '2026-11-11T09:00:00Z',
          capturedBy: 'u1',
        },
        deductionBp: 200,
        kycThresholdMinor: 20_000,
        hasIdentityCaptured: false,
      }),
    ).toThrow('GOLD_KYC_REQUIRED')

    const buyback = planSecondHandGoldPurchase({
      scrapWeightMg: 5_000,
      scrapKarat: 18,
      rateSnapshot: {
        rate24kMinorPerGram: 8_000,
        capturedAt: '2026-11-11T09:00:00Z',
        capturedBy: 'u1',
      },
      deductionBp: 200,
      kycThresholdMinor: 20_000,
      hasIdentityCaptured: true,
    })
    expect(buyback.documentType).toBe('second_hand_gold_purchase')
    expect(buyback.pureEquivalentMg).toBe(3_750)
    expect(buyback.grossCreditMinor).toBe(30_000)
    expect(buyback.deductionMinor).toBe(600)
    expect(buyback.netCreditMinor).toBe(29_400)

    const melt = recordGoldMeltScrapMovement({
      inputWeightMg: 10_000,
      recoveredPureMg: 9_650,
      rate24kMinorPerGram: 8_000,
    })
    expect(melt.weightLossMg).toBe(350)
    expect(melt.wasteCostMinor).toBe(2_800)

    expect(
      reconcileGoldLocationWeights({
        location: 'safe',
        systemWeightMg: 50_000,
        physicalCountedMg: 49_800,
      }).varianceMg,
    ).toBe(-200)
  })

  it('summarizes gold report by purity while keeping unknown profit null', () => {
    const report = summarizeGoldReportByKarat([
      {
        karat: 21,
        grossWeightMg: 12_000,
        netWeightMg: 10_500,
        operationType: 'sale',
        revenueMinor: 84_893,
        costMinor: 72_000,
        makingChargeMinor: 7_350,
      },
      {
        karat: 18,
        grossWeightMg: 5_000,
        netWeightMg: 5_000,
        operationType: 'second_hand_purchase',
        revenueMinor: null,
        costMinor: 29_400,
        makingChargeMinor: 0,
      },
    ])

    expect(report.find((r) => r.karat === 21)?.profitMinor).toBe(12_893)
    expect(report.find((r) => r.karat === 18)?.profitMinor).toBeNull()
    expect(report.find((r) => r.karat === 18)?.secondHandTotalMinor).toBe(29_400)
  })
})
