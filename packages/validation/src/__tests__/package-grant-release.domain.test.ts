// ============================================
// packages/validation/src/__tests__/package-grant-release.domain.test.ts
//
// M5 - the posting rule (deferred revenue) and the GRANT allocation rule, against the golden vectors the SQL trigger of
// docs/package-deferred-revenue-01-migration.sql is also proven against.
// ============================================

import { describe, expect, it } from 'vitest'
import vectors from '../__golden__/package-grant-vectors.json'
import {
  addMonthsIso,
  computePackageDeferrals,
  grantEndsOn,
  grantStateOn,
  invoiceLedgerLines,
  planGrantConsumption,
  type AllocatableGrant,
} from '../index'

const ACCOUNTS = {
  receivable: 'recv',
  sales: 'sales',
  tax: 'tax',
  cogs: 'cogs',
  inventory: 'inv',
  deferred_revenue: 'deferred',
}

const sum = (lines: Array<{ debit: number; credit: number }>) => ({
  debit: Math.round(lines.reduce((a, l) => a + l.debit, 0) * 100) / 100,
  credit: Math.round(lines.reduce((a, l) => a + l.credit, 0) * 100) / 100,
})

describe('computePackageDeferrals', () => {
  it('is 0 without a package line', () => {
    const out = computePackageDeferrals([
      { offeringType: 'goods', quantity: 2, unitPrice: 50 },
      { offeringType: 'service', quantity: 1, unitPrice: 100 },
    ])
    expect(out.total).toBe(0)
    expect(out.perLine).toEqual([0, 0])
  })

  it('is the net (after discount, before tax) of package lines in the books currency, line by line', () => {
    const lines = [
      { offeringType: 'goods', quantity: 1, unitPrice: 100 },
      { offeringType: 'package', quantity: 10, unitPrice: 200, discount: 200 },
    ]
    expect(computePackageDeferrals(lines, 1)).toEqual({ perLine: [0, 1800], total: 1800 })
    expect(computePackageDeferrals(lines, 1.5)).toEqual({ perLine: [0, 2700], total: 2700 })
  })

  it('the total is the sum of the rounded lines, never a second rounding of the sum', () => {
    const lines = [
      { offeringType: 'package', quantity: 1, unitPrice: 0.33 },
      { offeringType: 'package', quantity: 1, unitPrice: 0.33 },
      { offeringType: 'package', quantity: 1, unitPrice: 0.33 },
    ]
    const out = computePackageDeferrals(lines, 1.5)
    expect(out.perLine).toEqual([0.5, 0.5, 0.5])
    expect(out.total).toBe(1.5)
  })
})

describe('invoiceLedgerLines with deferred revenue', () => {
  it('M5-4: the package net is deferred, the tax is booked with the sale (10 000 + 1 000 tax)', () => {
    const lines = invoiceLedgerLines({
      isPurchase: false,
      total: 11000,
      taxTotal: 1000,
      deferredRevenue: 10000,
      accounts: ACCOUNTS,
    })
    expect(lines).toEqual([
      { accountId: 'recv', debit: 11000, credit: 0 },
      { accountId: 'deferred', debit: 0, credit: 10000 },
      { accountId: 'tax', debit: 0, credit: 1000 },
    ])
    expect(sum(lines).debit).toBe(sum(lines).credit)
  })

  it('a mixed invoice splits the net between deferred revenue and sales', () => {
    const lines = invoiceLedgerLines({
      isPurchase: false,
      total: 1210,
      taxTotal: 110,
      deferredRevenue: 800,
      accounts: ACCOUNTS,
    })
    expect(lines.find((l) => l.accountId === 'deferred')?.credit).toBe(800)
    expect(lines.find((l) => l.accountId === 'sales')?.credit).toBe(300)
    expect(lines.find((l) => l.accountId === 'tax')?.credit).toBe(110)
    expect(sum(lines).debit).toBe(sum(lines).credit)
  })

  it('without a deferred amount the lines are exactly what they were before M5', () => {
    expect(
      invoiceLedgerLines({ isPurchase: false, total: 1100, taxTotal: 100, accounts: ACCOUNTS }),
    ).toEqual([
      { accountId: 'recv', debit: 1100, credit: 0 },
      { accountId: 'sales', debit: 0, credit: 1000 },
      { accountId: 'tax', debit: 0, credit: 100 },
    ])
    expect(invoiceLedgerLines({ isPurchase: false, total: 500, accounts: ACCOUNTS })).toEqual([
      { accountId: 'recv', debit: 500, credit: 0 },
      { accountId: 'sales', debit: 0, credit: 500 },
    ])
  })

  it('never defers more than the net, and never defers tax', () => {
    const lines = invoiceLedgerLines({
      isPurchase: false,
      total: 1100,
      taxTotal: 100,
      deferredRevenue: 5000,
      accounts: ACCOUNTS,
    })
    expect(lines.find((l) => l.accountId === 'deferred')?.credit).toBe(1000)
    expect(lines.some((l) => l.accountId === 'sales')).toBe(false)
  })

  it('refuses to book a deferred amount when there is no account to hold it (no silent fallback to revenue)', () => {
    expect(() =>
      invoiceLedgerLines({
        isPurchase: false,
        total: 1000,
        deferredRevenue: 1000,
        accounts: { ...ACCOUNTS, deferred_revenue: undefined },
      }),
    ).toThrow('DEFERRED_REVENUE_ACCOUNT_MISSING')
  })
})

describe('grant term dates', () => {
  it('adds whole months and clamps to the end of a shorter month', () => {
    expect(addMonthsIso('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsIso('2026-11-02', 6)).toBe('2027-05-02')
    expect(addMonthsIso('2026-11-02', 12)).toBe('2027-11-02')
    expect(addMonthsIso('2024-01-31', 1)).toBe('2024-02-29')
  })

  it('a GRANT that was never used has no end date (SOLD != ACTIVATED)', () => {
    expect(grantEndsOn({ termMonths: 1, activatedOn: null })).toBeNull()
    expect(grantEndsOn({ termMonths: null, activatedOn: '2026-11-02' })).toBeNull()
    expect(grantEndsOn({ termMonths: 6, activatedOn: '2026-11-02' })).toBe('2027-05-02')
  })

  it('states: not started, active, expired, suspended', () => {
    const base: AllocatableGrant = {
      id: 'g',
      startsOn: '2026-10-01',
      quantity: 1,
      deferredAmount: null,
      termMonths: 1,
      activatedOn: '2026-10-05',
    }
    const paused = { ...base, suspensions: [{ startsOn: '2026-10-10', endsOn: '2026-10-20' }] }
    expect(grantStateOn(base, '2026-09-30')).toBe('not_started')
    expect(grantStateOn(base, '2026-11-05')).toBe('active')
    expect(grantStateOn(base, '2026-11-06')).toBe('expired')
    expect(grantStateOn(paused, '2026-10-15')).toBe('suspended')
    expect(grantStateOn(paused, '2026-10-21')).toBe('active')
  })
})

describe('planGrantConsumption - golden vectors (shared with the SQL trigger)', () => {
  for (const vector of vectors.vectors) {
    it(`${vector.id}: ${vector.title}`, () => {
      const plan = planGrantConsumption(
        vector.grants as AllocatableGrant[],
        vector.quantity,
        vector.onDate,
        vector.unattributed,
      )
      expect(plan.allocations).toEqual(vector.expected.allocations)
      expect(plan.totalReleasedAmount).toBe(vector.expected.totalReleasedAmount)
      expect(plan.shortfall).toBe(vector.expected.shortfall)
    })
  }

  it('releases exactly the deferred total over N deliveries, whatever the rounding', () => {
    let consumed = 0
    let released = 0
    for (let i = 0; i < 7; i++) {
      const plan = planGrantConsumption(
        [
          {
            id: 'g',
            startsOn: '2026-10-01',
            quantity: 7,
            deferredAmount: 100,
            termMonths: null,
            activatedOn: null,
            consumedQuantity: consumed,
            releasedAmount: released,
          },
        ],
        1,
        '2026-11-02',
      )
      consumed += 1
      released = Math.round((released + plan.totalReleasedAmount) * 100) / 100
    }
    expect(released).toBe(100)
  })

  it('refuses a non-positive quantity', () => {
    expect(() => planGrantConsumption([], 0, '2026-11-02')).toThrow(
      'CONSUMPTION_QUANTITY_MUST_BE_POSITIVE',
    )
  })
})

describe('suspension events (append-only): SUSPEND stops ONE GRANT, a later RESUME lifts it', () => {
  it('turns events into the suspended days', async () => {
    const { suspensionIntervals } = await import('../index')
    expect(
      suspensionIntervals([
        { grantId: 'g', kind: 'SUSPEND', effectiveOn: '2026-11-01' },
        { grantId: 'g', kind: 'RESUME', effectiveOn: '2026-11-11' },
      ]),
    ).toEqual([{ startsOn: '2026-11-01', endsOn: '2026-11-10' }])
    expect(
      suspensionIntervals([{ grantId: 'g', kind: 'SUSPEND', effectiveOn: '2026-11-01' }]),
    ).toEqual([{ startsOn: '2026-11-01', endsOn: null }])
    // a RESUME with nothing suspended, and a second SUSPEND while suspended, change nothing
    expect(
      suspensionIntervals([{ grantId: 'g', kind: 'RESUME', effectiveOn: '2026-11-01' }]),
    ).toEqual([])
    expect(
      suspensionIntervals([
        { grantId: 'g', kind: 'SUSPEND', effectiveOn: '2026-11-01' },
        { grantId: 'g', kind: 'SUSPEND', effectiveOn: '2026-11-05' },
      ]),
    ).toEqual([{ startsOn: '2026-11-01', endsOn: null }])
  })

  it('suspending one GRANT never stops another', () => {
    const grants: AllocatableGrant[] = [
      {
        id: 'a',
        startsOn: '2026-10-01',
        quantity: 2,
        deferredAmount: 200,
        termMonths: null,
        activatedOn: null,
        suspensions: [{ startsOn: '2026-11-01', endsOn: null }],
      },
      {
        id: 'b',
        startsOn: '2026-10-02',
        quantity: 2,
        deferredAmount: 400,
        termMonths: null,
        activatedOn: null,
      },
    ]
    const plan = planGrantConsumption(grants, 1, '2026-11-02')
    expect(plan.allocations.map((x) => x.grantId)).toEqual(['b'])
  })
})

describe('a package product carries a term of 1, 6 or 12 months', () => {
  it('accepts those and nothing else', async () => {
    const { createProductSchema } = await import('../schemas/product.schema')
    const base = { name: 'Course', offeringType: 'package' as const }
    for (const term of [1, 6, 12]) {
      expect(
        createProductSchema.safeParse({ ...base, packageTermMonths: term }).success,
        String(term),
      ).toBe(true)
    }
    for (const term of [0, 3, 24, -1]) {
      expect(
        createProductSchema.safeParse({ ...base, packageTermMonths: term }).success,
        String(term),
      ).toBe(false)
    }
    expect(createProductSchema.safeParse({ ...base, packageTermMonths: null }).success).toBe(true)
    expect(createProductSchema.safeParse(base).success).toBe(true)
  })
})

describe("B2-5: profit revenue takes the ledger's deferral off, in the books currency only", () => {
  const invoice = { id: 'i1', currency: 'AFN', subtotal: 10000, discountTotal: 0 }
  const line = {
    invoiceId: 'i1',
    productId: 'p',
    productName: 'Course',
    quantity: 10,
    totalPrice: 10000,
  }
  const base = {
    from: '2026-11-01',
    to: '2026-11-30',
    invoices: [invoice],
    lines: [line],
    consumptions: [],
    payrolls: [],
  }

  it("revenue = the invoices' net sales - the ledger's deferred change; gross profit follows", async () => {
    const { buildProfitReport } = await import('../index')
    const report = buildProfitReport({
      ...base,
      currency: 'AFN',
      deferredRevenueChange: 7000,
      booksCurrency: 'AFN',
    })
    expect(report.totals.revenue).toBe(3000)
    expect(report.totals.deferredRevenueChange).toBe(7000)
  })

  it('without a deferral the report is exactly what it was (no new field)', async () => {
    const { buildProfitReport } = await import('../index')
    const report = buildProfitReport({ ...base, currency: 'AFN', booksCurrency: 'AFN' })
    expect(report.totals.revenue).toBe(10000)
    expect('deferredRevenueChange' in report.totals).toBe(false)
  })

  it("never lands on another currency's report (no conversion, no guess)", async () => {
    const { buildProfitReport } = await import('../index')
    const report = buildProfitReport({
      ...base,
      invoices: [{ ...invoice, currency: 'USD' }],
      currency: 'USD',
      deferredRevenueChange: 7000,
      booksCurrency: 'AFN',
    })
    expect(report.totals.revenue).toBe(10000)
    expect('deferredRevenueChange' in report.totals).toBe(false)
  })
})

describe('C5: RETURN and SCRAP are different events (one rule for server and device)', () => {
  it('restock needs no stock decision; scrap does; both on one return still needs it', async () => {
    const { planReturnDisposition } = await import('../index')
    const sale = 'sale_return' as const
    expect(
      planReturnDisposition({ returnType: sale, lines: [{ restockChoice: 'restock' }] }),
    ).toEqual({
      needsStockAdjust: false,
      dispositions: ['restock'],
    })
    expect(
      planReturnDisposition({ returnType: sale, lines: [{ restockChoice: 'scrap' }] })
        .needsStockAdjust,
    ).toBe(true)
    expect(
      planReturnDisposition({
        returnType: sale,
        lines: [{ restockChoice: 'restock' }, { restockChoice: 'scrap' }],
      }).needsStockAdjust,
    ).toBe(true)
  })

  it('a line that says neither is refused - nothing is defaulted to restock', async () => {
    const { planReturnDisposition } = await import('../index')
    for (const choice of [undefined, null, '', 'discard', 'RESTOCK']) {
      expect(() =>
        planReturnDisposition({ returnType: 'sale_return', lines: [{ restockChoice: choice }] }),
      ).toThrow('RETURN_DISPOSITION_REQUIRED')
    }
  })

  it('a purchase return moves nothing back into the shop and is not decided here', async () => {
    const { planReturnDisposition } = await import('../index')
    expect(planReturnDisposition({ returnType: 'purchase_return', lines: [{}] })).toEqual({
      needsStockAdjust: false,
      dispositions: [],
    })
  })
})

describe('C1: an expired GRANT is never revived; a renewal is always a NEW GRANT', () => {
  const old: AllocatableGrant = {
    id: 'a',
    startsOn: '2026-08-01',
    quantity: 5,
    deferredAmount: 500,
    termMonths: 1,
    activatedOn: '2026-08-05',
    consumedQuantity: 2,
    releasedAmount: 200,
  }
  const renewal: AllocatableGrant = {
    id: 'b',
    startsOn: '2026-11-01',
    quantity: 4,
    deferredAmount: 800,
    termMonths: 1,
    activatedOn: null,
  }

  it('1-4: the expired GRANT cannot consume, keeps its 3 unspent units as history, and renewal does not revive them', () => {
    expect(grantStateOn(old, '2026-11-02')).toBe('expired')
    const alone = planGrantConsumption([old], 1, '2026-11-02')
    expect(alone.allocations).toEqual([])
    expect(alone.shortfall).toBe(1) // refused: nothing eligible
    // after the renewal the OLD remainder still does not count: the 3 old units are not added to the 4 new ones
    const both = planGrantConsumption([old, renewal], 5, '2026-11-02')
    expect(both.allocations).toEqual([{ grantId: 'b', quantity: 4, releasedAmount: 800 }])
    expect(both.shortfall).toBe(1)
  })

  it('5-6: the NEW GRANT consumes with its own value, and allocation is deterministic whatever order the rows arrive in', () => {
    const forward = planGrantConsumption([old, renewal], 2, '2026-11-02')
    const reversed = planGrantConsumption([renewal, old], 2, '2026-11-02')
    expect(forward).toEqual(reversed)
    expect(forward.allocations).toEqual([{ grantId: 'b', quantity: 2, releasedAmount: 400 }])
  })

  it('the old GRANT never gives deferred revenue back out after it expired (nothing is released to a dead grant)', () => {
    const plan = planGrantConsumption([old, renewal], 4, '2026-11-02')
    expect(plan.totalReleasedAmount).toBe(800)
  })
})

describe('C2: the ledger is the headline and the drill-down reconciles to it', () => {
  const invoice = { id: 'i1', currency: 'AFN', subtotal: 300, discountTotal: 0 }
  const line = { invoiceId: 'i1', productId: 'p', productName: 'Pen', quantity: 2, totalPrice: 300 }
  const consumption = {
    invoiceId: 'i1',
    productId: 'p',
    amount: 200,
    isEstimated: false,
    quantity: 2,
  }
  const base = {
    from: '2026-11-01',
    to: '2026-11-30',
    currency: 'AFN',
    booksCurrency: 'AFN',
    invoices: [invoice],
    lines: [line],
    consumptions: [consumption],
    payrolls: [],
  }

  it('sum(drill-down) + reconciliation == ledger, for revenue and for cost + loss', async () => {
    const { buildProfitReport } = await import('../index')
    const report = buildProfitReport({
      ...base,
      ledgerTotals: { revenue: 500, cost: 140, inventoryLoss: 60 },
    })
    expect(report.totals.ledger).toEqual({
      revenue: 500,
      cost: 140,
      inventoryLoss: 60,
      grossProfit: 300,
    })
    expect(report.totals.reconciliation).toEqual({ revenue: 200, cost: 0 }) // the ledger holds 200 of revenue the lines do not show
    // the HEADLINE is the ledger; the rows are drill-down and reconcile to it
    expect(report.totals.basis).toBe('ledger')
    expect(report.totals.revenue).toBe(500)
    expect(report.totals.cost).toBe(200) // cost of sales 140 + inventory loss 60
    expect(report.totals.drillDown).toEqual({ revenue: 300, cost: 200 })
    expect(report.totals.drillDown!.revenue + report.totals.reconciliation!.revenue).toBe(
      report.totals.ledger!.revenue,
    )
    expect(report.totals.drillDown!.cost + report.totals.reconciliation!.cost).toBe(
      report.totals.ledger!.cost + report.totals.ledger!.inventoryLoss,
    )
  })

  it("no ledger block unless the ledger was read, and never on another currency's report", async () => {
    const { buildProfitReport } = await import('../index')
    expect('ledger' in buildProfitReport({ ...base }).totals).toBe(false)
    const usd = buildProfitReport({
      ...base,
      invoices: [{ ...invoice, currency: 'USD' }],
      currency: 'USD',
      ledgerTotals: { revenue: 500, cost: 0, inventoryLoss: 0 },
    })
    expect('ledger' in usd.totals).toBe(false)
  })
})
