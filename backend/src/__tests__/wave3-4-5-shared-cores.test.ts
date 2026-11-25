// ============================================
// backend/src/__tests__/wave3-4-5-shared-cores.test.ts
//
// Verifies Wave 3, 4 & 5 Shared-Core Domain Engines:
//   - G04/G05/G06/G68/G69: Tips, service charge, tip pool, capacity/waitlist
//   - G33/G34/G23/G24/KYC: VAT per currency, bank matching, FX KYC/daily cap
//   - G14/G72/G49/G50/G100: COD reconciliation, supplier scorecard, fleet compliance
// ============================================

import { describe, expect, it } from 'vitest'
import {
  allocateCapacityOrWaitlist,
  computeServiceChargeAndTip,
  computeVatReturnByCurrency,
  evaluateExchangeKycLimit,
  evaluateFleetCompliance,
  matchBankTransactions,
  poolTipsEqually,
  reconcileCodBatch,
  scoreSupplierPerformance,
} from '@hisabche/validation'

describe('Wave 3/4/5 — Shared-Core Extensions', () => {
  it('computes service charge, tip pooling, and capacity waitlist (G04/G05/G68/G69)', () => {
    expect(computeServiceChargeAndTip(10_000, 1000, 500)).toEqual({
      serviceChargeMinor: 1000,
      tipMinor: 500,
      grandTotalMinor: 11_500,
    })
    expect(poolTipsEqually(100, ['u1', 'u2', 'u3'])).toEqual({ u1: 34, u2: 33, u3: 33 })

    const r1 = allocateCapacityOrWaitlist(2, ['s1', 's2'], [], 's3')
    expect(r1.status).toBe('waitlisted')
    expect(r1.waitlistIds).toEqual(['s3'])
  })

  it('computes VAT per currency, matches bank feeds, and enforces FX KYC/AML (G33/G34/G23/G24/KYC)', () => {
    const vat = computeVatReturnByCurrency([
      { currency: 'AFN', kind: 'sale', netMinor: 10_000, vatMinor: 500 },
      { currency: 'AFN', kind: 'purchase', netMinor: 4_000, vatMinor: 200 },
      { currency: 'USD', kind: 'sale', netMinor: 1_000, vatMinor: 50 },
    ])
    expect(vat).toEqual([
      { currency: 'AFN', outputVatMinor: 500, inputVatMinor: 200, netPayableMinor: 300 },
      { currency: 'USD', outputVatMinor: 50, inputVatMinor: 0, netPayableMinor: 50 },
    ])

    const matches = matchBankTransactions(
      [
        { id: 'b1', date: '2026-11-25', currency: 'AFN', amountMinor: 5000, reference: 'INV-101' },
        {
          id: 'b2',
          date: '2026-11-25',
          currency: 'USD',
          amountMinor: 9900,
          reference: 'UNMATCHED',
        },
      ],
      [{ id: 'p1', date: '2026-11-24', currency: 'AFN', amountMinor: 5000, reference: 'INV-101' }],
    )
    expect(matches[0]).toEqual({ feedId: 'b1', candidateId: 'p1', confidence: 'exact_ref' })
    expect(matches[1]).toEqual({ feedId: 'b2', candidateId: null, confidence: 'unmatched' })

    expect(
      evaluateExchangeKycLimit({
        dailyAccumulatedMinor: 4000,
        requestedMinor: 2000,
        kycThresholdMinor: 5000,
        dailyCapMinor: 10_000,
        hasVerifiedIdDocument: false,
      }),
    ).toEqual({ allowed: false, reason: 'KYC_DOCUMENT_REQUIRED' })
  })

  it('reconciles COD batches, scores suppliers, and checks fleet compliance (G14/G72/G49/G50/G100)', () => {
    expect(
      reconcileCodBatch([
        { parcelId: 'p1', collectedMinor: 1500, courierFeeMinor: 100, delivered: true },
        { parcelId: 'p2', collectedMinor: 2000, courierFeeMinor: 100, delivered: false },
      ]),
    ).toEqual({
      deliveredCount: 1,
      returnedCount: 1,
      grossCollectedMinor: 1500,
      totalFeesMinor: 100,
      netMerchantPayoutMinor: 1400,
    })

    expect(
      scoreSupplierPerformance({ totalOrders: 0, onTimeOrders: 0, defectiveOrders: 0 }),
    ).toEqual({
      score: null,
      tier: 'UNKNOWN',
    })
    expect(
      scoreSupplierPerformance({ totalOrders: 20, onTimeOrders: 18, defectiveOrders: 1 }),
    ).toEqual({
      score: 80,
      tier: 'B',
    })

    expect(
      evaluateFleetCompliance({
        currentKm: 52_000,
        nextServiceKm: 50_000,
        insuranceExpiresAt: '2026-12-31T00:00:00Z',
        asOfIso: '2026-11-25T00:00:00Z',
      }),
    ).toEqual({ serviceDue: true, insuranceExpired: false, compliant: false })
  })
})
