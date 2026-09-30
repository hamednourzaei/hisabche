// ============================================
// Engine N22 (supplier) — supplier risk and concentration.
// Capabilities #10, #15, #19.
//
// ⚠️ WHAT IS WORTH DEFENDING, GIVEN THERE IS NO EXTERNAL DATA SOURCE.
//
// No credit bureau, no trade data, no supplier financials. Everything below is
// derived from what the shop itself did, and the risk is that a future change
// reaches for a number this product cannot source. `POSITIONING-2026-09-15.md`
// records what happens when it does: «customer counts / ratings» were claimed on
// the landing and had to be deleted because there was no rating system at all.
//
// So the tests here are as much about the SHAPE of the answer as the number:
//
//   1. TOO LITTLE HISTORY IS `unknown`, NOT A GOOD SCORE. A supplier bought from
//      once, delivered on time, would score 10/100 low-risk on any scale that
//      averages — and the buyer would put them on the approved list.
//   2. AN UNRECEIVED ORDER IS THE WORST SIGNAL AND CANNOT BE AVERAGED AWAY. One
//      order paid for and never delivered is money gone; averaging it against
//      four punctual deliveries hides it.
//   3. AN INACTIVE SUPPLIER IS `unknown`, NOT LOW RISK. Its risk stopped being
//      observable, and reporting that as safe keeps it on the buying list.
//   4. CONCENTRATION IS A FINDING, NOT A SCORE. 70% of spending through one door
//      is a fact a buyer has never seen on a purchase order.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  CONCENTRATION_THRESHOLD_PERCENT,
  MIN_PURCHASES_FOR_A_SCORE,
  scoreSupplier,
  supplierConcentration,
  type PurchaseRecord,
  type SupplierFacts,
} from '../services/supplier/supplier-intelligence.domain'

const AS_OF = '2026-09-30'

const supplier = (over: Partial<SupplierFacts> = {}): SupplierFacts => ({
  supplierId: 'sup-1',
  name: 'DABS Kabul',
  active: true,
  ...over,
})

const purchase = (over: Partial<PurchaseRecord> = {}): PurchaseRecord => ({
  supplierId: 'sup-1',
  productId: 'prod-1',
  orderedDate: '2026-09-01',
  receivedDate: '2026-09-01',
  amountMinor: 100_000,
  listPriceMinor: 100_000,
  quantity: 1,
  ...over,
})

describe('N22 — too little history is unknown, not safe', () => {
  it('one purchase produces no score at all', () => {
    // ⚠️ THE test that matters most in this file. Averaging over one order gives
    // a perfect record, and a perfect record on one order reads as a supplier
    // the shop can rely on.
    const risk = scoreSupplier(supplier(), [purchase()], AS_OF)

    expect(risk.band).toBe('unknown')
    expect(risk.score).toBeNull()
    expect(MIN_PURCHASES_FOR_A_SCORE).toBe(3)
  })

  it('two purchases are still not enough', () => {
    const risk = scoreSupplier(supplier(), [purchase(), purchase()], AS_OF)
    expect(risk.band).toBe('unknown')
  })

  it('three punctual purchases are LOW risk', () => {
    // ⚠️ The case that keeps the scale readable: the ordinary supplier sits at
    // the bottom, so a mid-range score means something.
    const risk = scoreSupplier(supplier(), [purchase(), purchase(), purchase()], AS_OF)

    expect(risk.band).toBe('low')
    expect(risk.signals).toEqual([])
  })

  it('an inactive supplier is unknown, not low risk', () => {
    // ⚠️ Its risk stopped being observable. Reporting that as safe would keep it
    // on the buying list.
    const risk = scoreSupplier(
      supplier({ active: false }),
      [purchase(), purchase(), purchase()],
      AS_OF,
    )

    expect(risk.band).toBe('unknown')
    expect(risk.score).toBeNull()
  })
})

describe('N22 — an unreceived order is the worst signal and cannot be averaged away', () => {
  it('one never-received order among four punctual ones is still HIGH', () => {
    // ⚠️ Money gone, not a delay. Averaging it against four good deliveries is
    // exactly how a shop ends up re-ordering from someone who took the money.
    const risk = scoreSupplier(
      supplier(),
      [
        purchase({ receivedDate: '2026-09-01' }),
        purchase({ receivedDate: '2026-09-01' }),
        purchase({ receivedDate: '2026-09-01' }),
        purchase({ receivedDate: null }),
      ],
      AS_OF,
    )

    expect(risk.band).toBe('high')
    expect(risk.signals[0]?.key).toBe('UNRECEIVED')
  })

  it('the signal counts how many never arrived', () => {
    const risk = scoreSupplier(
      supplier(),
      [
        purchase({ receivedDate: '2026-09-01' }),
        purchase({ receivedDate: null }),
        purchase({ receivedDate: null }),
      ],
      AS_OF,
    )

    expect(risk.signals[0]?.detail).toContain('2 of 3')
    expect(risk.evidence.neverReceived).toBe(2)
  })
})

describe('N22 — lateness scales, and the evidence travels with it', () => {
  it('a fortnight late is high, a few days late is moderate', () => {
    // ⚠️ Dates are BUILT, not interpolated. The first version wrote
    // `2026-09-${1 + days}`, and for `days = 30` that produced `2026-09-31` —
    // which JavaScript silently reads as 1 October. A test that constructs an
    // impossible date does not fail loudly; it measures something else.
    const late = (days: number): PurchaseRecord => {
      const received = new Date(Date.UTC(2026, 8, 1 + days))
      return purchase({
        orderedDate: '2026-09-01',
        receivedDate: received.toISOString().slice(0, 10),
      })
    }

    const bad = scoreSupplier(supplier(), [late(14), late(14), late(14)], AS_OF)
    const mild = scoreSupplier(supplier(), [late(5), late(5), late(5)], AS_OF)

    expect(bad.band).toBe('high')
    expect(mild.band).toBe('moderate')
  })

  it('reports the average so the score can be checked', () => {
    // ⚠️ A score nobody can verify is a score nobody maintains.
    const risk = scoreSupplier(
      supplier(),
      [
        purchase({ orderedDate: '2026-09-01', receivedDate: '2026-09-11' }),
        purchase({ orderedDate: '2026-09-01', receivedDate: '2026-09-21' }),
        purchase({ orderedDate: '2026-09-01', receivedDate: '2026-10-01' }),
      ],
      AS_OF,
    )

    expect(risk.evidence.averageDaysLate).toBe(20)
    expect(risk.signals[0]?.detail).toContain('20 days late')
  })
})

describe('N22 — paying above the list price is a signal', () => {
  it('reports a premium', () => {
    const risk = scoreSupplier(
      supplier(),
      [
        purchase({ amountMinor: 120_000, listPriceMinor: 100_000 }),
        purchase({ amountMinor: 120_000, listPriceMinor: 100_000 }),
        purchase({ amountMinor: 120_000, listPriceMinor: 100_000 }),
      ],
      AS_OF,
    )

    expect(risk.evidence.averagePricePremiumPercent).toBe(20)
    expect(risk.signals.map((s) => s.key)).toContain('PRICE_DRIFT')
  })

  it('paying the list price is not a signal', () => {
    const risk = scoreSupplier(supplier(), [purchase(), purchase(), purchase()], AS_OF)
    expect(risk.signals.map((s) => s.key)).not.toContain('PRICE_DRIFT')
  })
})

describe('#19 — concentration is the finding shops have never seen', () => {
  const many = (supplierId: string, amountMinor: number): PurchaseRecord =>
    purchase({ supplierId, amountMinor })

  it('reports a supplier carrying most of the spend', () => {
    const findings = supplierConcentration(
      [many('sup-1', 700_000), many('sup-2', 200_000), many('sup-3', 100_000)],
      [
        supplier({ supplierId: 'sup-1', name: 'DABS Kabul' }),
        supplier({ supplierId: 'sup-2', name: 'Etrooz' }),
        supplier({ supplierId: 'sup-3', name: 'Local market' }),
      ],
    )

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      kind: 'SUPPLIER_CONCENTRATION',
      subjectId: 'sup-1',
      sharePercent: 70,
    })
    expect(findings[0]?.detail).toContain('DABS Kabul')
  })

  it('says nothing when the spend is genuinely spread', () => {
    // ⚠️ 33/33/34 across three doors. Nothing reaches 40%, and the shop really
    // can walk away from any one supplier.
    expect(CONCENTRATION_THRESHOLD_PERCENT).toBe(40)

    const findings = supplierConcentration(
      [many('sup-1', 330_000), many('sup-2', 330_000), many('sup-3', 340_000)],
      [
        supplier({ supplierId: 'sup-1' }),
        supplier({ supplierId: 'sup-2' }),
        supplier({ supplierId: 'sup-3' }),
      ],
    )

    expect(findings.filter((f) => f.kind === 'SUPPLIER_CONCENTRATION')).toEqual([])
  })

  it('EXACTLY at the threshold is still concentrated', () => {
    // ⚠️ 40/30/30 — two thirds of the spend through two doors, and the largest
    // exactly on the line. A boundary that excluded its own definition would
    // report this shop as diversified.
    const findings = supplierConcentration(
      [many('sup-1', 400_000), many('sup-2', 300_000), many('sup-3', 300_000)],
      [
        supplier({ supplierId: 'sup-1' }),
        supplier({ supplierId: 'sup-2' }),
        supplier({ supplierId: 'sup-3' }),
      ],
    )

    const concentrated = findings.filter((f) => f.kind === 'SUPPLIER_CONCENTRATION')
    expect(concentrated).toHaveLength(1)
    expect(concentrated[0]?.sharePercent).toBe(40)
  })

  it('reports a supplier well over the threshold', () => {
    const findings = supplierConcentration(
      [many('sup-1', 450_000), many('sup-2', 300_000), many('sup-3', 250_000)],
      [
        supplier({ supplierId: 'sup-1' }),
        supplier({ supplierId: 'sup-2' }),
        supplier({ supplierId: 'sup-3' }),
      ],
    )

    const concentrated = findings.filter((f) => f.kind === 'SUPPLIER_CONCENTRATION')
    expect(concentrated).toHaveLength(1)
    expect(concentrated[0]?.sharePercent).toBe(45)
  })

  it('counts SPEND, not units', () => {
    // ⚠️ Unit counting would make a shop that buys 900 cheap pens and 1,000
    // expensive bolts from two suppliers look diversified. The money is not.
    const findings = supplierConcentration(
      [
        purchase({ supplierId: 'sup-1', amountMinor: 900_000, quantity: 900 }),
        purchase({ supplierId: 'sup-2', amountMinor: 100_000, quantity: 1 }),
      ],
      [supplier({ supplierId: 'sup-1' }), supplier({ supplierId: 'sup-2' })],
    )

    expect(findings.some((f) => f.subjectId === 'sup-1')).toBe(true)
  })

  it('reports a product with only one source, which is a different failure', () => {
    // ⚠️ A shop can switch most suppliers. It cannot switch the one product only
    // that supplier sells.
    const findings = supplierConcentration(
      [
        purchase({ productId: 'rare-1', supplierId: 'sup-1' }),
        purchase({ productId: 'common', supplierId: 'sup-1' }),
        purchase({ productId: 'common', supplierId: 'sup-2' }),
      ],
      [supplier({ supplierId: 'sup-1' }), supplier({ supplierId: 'sup-2' })],
    )

    const single = findings.filter((f) => f.kind === 'PRODUCT_SINGLE_SOURCE')
    expect(single).toHaveLength(1)
    expect(single[0]?.subjectId).toBe('rare-1')
  })

  it('nothing purchased, nothing found', () => {
    expect(supplierConcentration([], [])).toEqual([])
  })

  it('the threshold is a named export so the UI can explain itself', () => {
    expect(CONCENTRATION_THRESHOLD_PERCENT).toBe(40)
  })
})
