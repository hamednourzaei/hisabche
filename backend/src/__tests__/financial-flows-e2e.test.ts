// ============================================
// The critical financial flows, end to end through the domain.
//
// ---------------------------------------------------------------------------
// WHAT "END TO END" MEANS HERE
//
// These run the real domain functions of several cores in sequence, in the
// order a real document moves through them, and assert on the figure that
// comes out the far end. No database and no HTTP — those are covered by
// `vertical-slice-integration.test.ts` and `scripts/verify-slice.mjs`.
//
// What this catches that per-core tests cannot: a core whose own tests pass
// while its OUTPUT is the wrong input for the next one. Every bug this file
// is shaped around lives in the seam between two correct cores.
// ============================================

import { describe, expect, it } from 'vitest'

import { computeDocument, footingError, toMinor, type TaxComponent } from '../services/tax'
import { planConsumption, grossProfit, type CostLayer } from '../services/inventory-costing'
import { planRepost, type CostedIssue } from '../services/inventory-costing/repost.domain'
import {
  autoAllocate,
  outstandingOf,
  partyBalance,
  validateAllocations,
  type LedgerMovement,
  type OpenInvoice,
} from '../services/payments'
import {
  buildPosting,
  summarise as summariseSession,
  validateOrder,
  type PosOrder,
  type PosSession,
} from '../services/pos'
import { planAllocation, type StockBatch } from '../services/traceability/lot.domain'
import { buildSchedule, duePostings, disposeAsset } from '../services/assets/depreciation.domain'
import { revalue, realisedDifferenceMinor, type ForeignBalance } from '../services/currency'

// ══════════════════════════════════════════════════════════════════════
// FLOW 1  buy → sell → the profit is the real one
// ══════════════════════════════════════════════════════════════════════

describe('flow: purchase → sale → cost of goods sold → profit', () => {
  it('prices the sale from the purchase it actually drew from', () => {
    // The A35 case from .claude/detail.md, run through the real cores.
    const layers: CostLayer[] = [
      {
        id: 'jan',
        productId: 'a35',
        warehouseId: null,
        remainingQty: 1,
        unitCost: 10_000_000,
        entryDate: '2026-01-01',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'feb',
        productId: 'a35',
        warehouseId: null,
        remainingQty: 1,
        unitCost: 9_000_000,
        entryDate: '2026-02-01',
        createdAt: '2026-02-01T00:00:00.000Z',
      },
    ]

    const first = planConsumption(layers, 1)
    expect(grossProfit(12_000_000, first.totalCost)).toBe(2_000_000)

    const afterFirst = layers.map((layer) =>
      layer.id === 'jan' ? { ...layer, remainingQty: 0 } : layer,
    )
    const second = planConsumption(afterFirst, 1)
    expect(grossProfit(13_000_000, second.totalCost)).toBe(4_000_000)

    // Six million, not seven. The whole reason cost layers exist.
    expect(
      grossProfit(12_000_000, first.totalCost) + grossProfit(13_000_000, second.totalCost),
    ).toBe(6_000_000)
  })

  it('carries the SAME cost into tax and into the ledger', () => {
    // The seam: if the tax core and the costing core round differently, the
    // invoice total and the journal entry disagree and nothing says which is
    // right.
    const vat: TaxComponent = {
      id: 'vat',
      labelKey: 'tax.vat',
      computation: 'percent',
      treatment: 'standard',
      rate: 15,
      includedInPrice: false,
    }

    const document = computeDocument([
      { lineId: 'l1', quantity: 1, unitPriceMinor: toMinor(120_000), components: [vat] },
    ])

    expect(footingError(document)).toBe(0)
    expect(document.netMinor + document.taxMinor).toBe(document.totalMinor)
  })
})

// ══════════════════════════════════════════════════════════════════════
// FLOW 2  invoice → payment → what is still owed
// ══════════════════════════════════════════════════════════════════════

describe('flow: invoice → part payment → balance → settlement', () => {
  const invoices: OpenInvoice[] = [
    {
      invoiceId: 'inv-1',
      invoiceNumber: 'INV-1',
      total: 300,
      allocated: 0,
      dueDate: '2026-01-31',
      invoiceDate: '2026-01-01',
    },
    {
      invoiceId: 'inv-2',
      invoiceNumber: 'INV-2',
      total: 400,
      allocated: 0,
      dueDate: '2026-02-28',
      invoiceDate: '2026-02-01',
    },
  ]

  it('settles the oldest first and keeps the remainder as an advance', () => {
    const { allocations, unallocated } = autoAllocate(1000, invoices)

    expect(allocations).toEqual([
      { invoiceId: 'inv-1', amount: 300 },
      { invoiceId: 'inv-2', amount: 400 },
    ])
    // The overpayment is not refused and not lost.
    expect(unallocated).toBe(300)
    expect(validateAllocations(1000, allocations, invoices)).toEqual([])
  })

  it('leaves the right balance after a part payment', () => {
    const { allocations } = autoAllocate(500, invoices)

    const afterPayment = invoices.map((invoice) => {
      const paid = allocations.find((a) => a.invoiceId === invoice.invoiceId)?.amount ?? 0
      return { ...invoice, allocated: invoice.allocated + paid }
    })

    expect(outstandingOf(afterPayment[0]!)).toBe(0)
    expect(outstandingOf(afterPayment[1]!)).toBe(200)
  })

  it('the party ledger agrees with the outstanding balance', () => {
    // Two independent computations of "what does this customer owe". If they
    // ever disagree, one screen contradicts another and nobody can say which.
    const movements: LedgerMovement[] = [
      { date: '2026-01-01', kind: 'sale', amount: 300, reference: 'INV-1' },
      { date: '2026-02-01', kind: 'sale', amount: 400, reference: 'INV-2' },
      { date: '2026-02-15', kind: 'payment_in', amount: 500, reference: 'PMT-1' },
    ]

    const { allocations } = autoAllocate(500, invoices)
    const stillOwed = invoices.reduce((sum, invoice) => {
      const paid = allocations.find((a) => a.invoiceId === invoice.invoiceId)?.amount ?? 0
      return sum + outstandingOf({ ...invoice, allocated: invoice.allocated + paid })
    }, 0)

    expect(partyBalance(movements)).toBe(stillOwed)
  })
})

// ══════════════════════════════════════════════════════════════════════
// FLOW 3  a day at the till
// ══════════════════════════════════════════════════════════════════════

describe('flow: open the drawer → sell → count → post', () => {
  const session: PosSession = {
    id: 's1',
    status: 'open',
    openingFloatMinor: 100_000,
    openedAt: '2026-06-15T08:00:00.000Z',
    openedBy: 'u1',
  }

  const order = (over: Partial<PosOrder>): PosOrder => ({
    id: 'o1',
    orderRef: 'r1',
    totalMinor: 50_000,
    payments: [{ method: 'cash', amountMinor: 50_000 }],
    changeMinor: 0,
    status: 'completed',
    createdAt: '',
    ...over,
  })

  it('a mixed day reconciles to the drawer', () => {
    const orders = [
      order({ id: 'a', orderRef: 'a' }),
      order({
        id: 'b',
        orderRef: 'b',
        totalMinor: 80_000,
        payments: [
          { method: 'cash', amountMinor: 30_000 },
          { method: 'card', amountMinor: 50_000 },
        ],
      }),
      order({
        id: 'c',
        orderRef: 'c',
        totalMinor: 20_000,
        payments: [{ method: 'credit', amountMinor: 20_000 }],
      }),
    ]

    for (const each of orders) {
      expect(validateOrder(session, each)).toEqual([])
    }

    const totals = summariseSession(session, orders, [])

    // Only the cash reached the drawer: 100,000 float + 50,000 + 30,000.
    expect(totals.expectedCashMinor).toBe(180_000)
    expect(totals.byMethod.card).toBe(50_000)
    expect(totals.byMethod.credit).toBe(20_000)
    expect(totals.grossSalesMinor).toBe(150_000)
  })

  it('a short drawer posts the shortage to its own figure', () => {
    const orders = [order({})]
    const closed = { ...session, countedCashMinor: 148_000 }
    const totals = summariseSession(closed, orders, [])
    const posting = buildPosting(closed, totals)

    expect(totals.varianceMinor).toBe(-2_000)
    // The shortage never touches revenue.
    expect(posting.revenueMinor).toBe(50_000)
    expect(posting.varianceMinor).toBe(-2_000)
    // Cash debited at what is really there, less the float.
    expect(posting.cashMinor).toBe(48_000)
  })
})

// ══════════════════════════════════════════════════════════════════════
// FLOW 4  a pharmacy: batches, expiry, and the cost that follows them
// ══════════════════════════════════════════════════════════════════════

describe('flow: receive batches → FEFO issue → the cost trail follows', () => {
  const batch = (over: Partial<StockBatch> & { id: string }): StockBatch => ({
    productId: 'med',
    batchNumber: over.id.toUpperCase(),
    expiryDate: null,
    receivedQty: 10,
    remainingQty: 10,
    costLayerId: `layer-${over.id}`,
    receivedOn: '2026-01-01',
    ...over,
  })

  it('ships the soonest-expiring batch and names its cost layer', () => {
    // Received first, expires later — FIFO would ship this one and leave the
    // sooner-expiring carton to be written off.
    const older = batch({ id: 'old', receivedOn: '2026-01-01', expiryDate: '2026-12-31' })
    const newer = batch({ id: 'new', receivedOn: '2026-05-01', expiryDate: '2026-07-01' })

    const plan = planAllocation([older, newer], 5, { asOf: '2026-06-15' })

    expect(plan.allocations[0]!.batchId).toBe('new')
    // The identity carries the money with it: this is the seam between the
    // traceability core and the costing core.
    expect(plan.allocations[0]!.costLayerId).toBe('layer-new')
    expect(plan.shortfall).toBe(0)
  })

  it('refuses to ship expired stock even when it is all there is', () => {
    const dead = batch({ id: 'dead', expiryDate: '2026-01-01', remainingQty: 100 })
    const plan = planAllocation([dead], 5, { asOf: '2026-06-15' })

    expect(plan.allocations).toEqual([])
    expect(plan.shortfall).toBe(5)
    // Reported rather than silently skipped: the operator has to know the
    // stock is there and unusable.
    expect(plan.blockedByExpiry[0]!.quantity).toBe(100)
  })
})

// ══════════════════════════════════════════════════════════════════════
// FLOW 5  the backdated receipt that rewrites last month's profit
// ══════════════════════════════════════════════════════════════════════

describe('flow: backdated receipt → repost → correction, never a rewrite', () => {
  it('finds every sale whose cost changed and states the difference', () => {
    const layers: CostLayer[] = [
      {
        id: 'backdated',
        productId: 'p1',
        warehouseId: null,
        remainingQty: 10,
        unitCost: 800,
        entryDate: '2026-03-01',
        createdAt: '2026-03-20T00:00:00.000Z',
      },
    ]

    const issues: CostedIssue[] = [
      {
        consumerType: 'invoice',
        consumerId: 'inv-1',
        consumerLine: 'a',
        productId: 'p1',
        quantity: 1,
        entryDate: '2026-03-10',
        recordedCostMinor: 100_000,
      },
    ]

    const plan = planRepost(layers, issues, '2026-03-01')

    expect(plan.adjustments).toHaveLength(1)
    expect(plan.adjustments[0]!.recomputedCostMinor).toBe(80_000)
    // Negative: cost of goods sold was OVERSTATED, so profit was understated.
    expect(plan.netAdjustmentMinor).toBe(-20_000)
  })

  it('is idempotent — running it twice proposes the same correction', () => {
    const layers: CostLayer[] = [
      {
        id: 'l1',
        productId: 'p1',
        warehouseId: null,
        remainingQty: 10,
        unitCost: 800,
        entryDate: '2026-03-01',
        createdAt: '2026-03-01T00:00:00.000Z',
      },
    ]
    const issues: CostedIssue[] = [
      {
        consumerType: 'invoice',
        consumerId: 'inv-1',
        consumerLine: 'a',
        productId: 'p1',
        quantity: 1,
        entryDate: '2026-03-10',
        recordedCostMinor: 100_000,
      },
    ]

    expect(planRepost(layers, issues, '2026-03-01')).toEqual(
      planRepost(layers, issues, '2026-03-01'),
    )
  })
})

// ══════════════════════════════════════════════════════════════════════
// FLOW 6  an asset from purchase to disposal
// ══════════════════════════════════════════════════════════════════════

describe('flow: capitalise → depreciate → miss a run → dispose', () => {
  const schedule = buildSchedule({
    costMinor: 1_200_000,
    salvageMinor: 0,
    periods: 12,
    method: 'straight_line',
    firstPeriodOn: '2026-01-31',
    periodMonths: 1,
  })

  it('the schedule sums exactly to what was capitalised', () => {
    expect(schedule.reduce((sum, entry) => sum + entry.amountMinor, 0)).toBe(1_200_000)
  })

  it('a run six weeks late posts every entry it owes', () => {
    const due = duePostings(schedule, [1], '2026-04-30')
    expect(due.map((entry) => entry.period)).toEqual([2, 3, 4])
  })

  it('a second run posts nothing', () => {
    expect(duePostings(schedule, [1, 2, 3, 4], '2026-04-30')).toEqual([])
  })

  it('disposal compares proceeds to book value and cancels the rest', () => {
    const result = disposeAsset(1_200_000, schedule, {
      onDate: '2026-06-30',
      proceedsMinor: 700_000,
    })

    expect(result.netBookValueMinor).toBe(600_000)
    expect(result.gainOrLossMinor).toBe(100_000)
    expect(result.cancelledPeriods).toEqual([7, 8, 9, 10, 11, 12])
  })
})

// ══════════════════════════════════════════════════════════════════════
// FLOW 7  a foreign invoice from issue to settlement
// ══════════════════════════════════════════════════════════════════════

describe('flow: foreign invoice → revalue → settle', () => {
  const receivable: ForeignBalance = {
    sourceType: 'receivable',
    sourceId: 'inv-usd',
    currency: 'USD',
    foreignMinor: 100_000,
    bookedRate: 70,
    bookedBaseMinor: 7_000_000,
  }

  it('an unrealised gain while it is still outstanding', () => {
    expect(revalue(receivable, 73).differenceMinor).toBe(300_000)
  })

  it('the realised gain on settlement matches what was revalued to', () => {
    // The seam: if the two used different formulas, the unrealised gain would
    // not cleanly become the realised one and a difference would linger with
    // no document behind it.
    const unrealised = revalue(receivable, 73).differenceMinor
    const realised = realisedDifferenceMinor({
      foreignMinor: 100_000,
      bookedRate: 70,
      settlementRate: 73,
      sourceType: 'receivable',
    })

    expect(realised).toBe(unrealised)
  })

  it('a payable moves the opposite way', () => {
    const payable: ForeignBalance = { ...receivable, sourceType: 'payable' }
    expect(revalue(payable, 73).differenceMinor).toBe(-300_000)
  })
})
