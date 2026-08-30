// ============================================
// Budgets, backdated cost recalculation, landed cost, reordering and
// timesheet billing.
//
// Each of these has an obvious implementation that is quietly wrong, and each
// test below is aimed at that specific wrongness rather than at the happy path.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  applicableBudgets,
  checkSpend,
  evaluate,
  periodFor,
  varianceReport,
  type Budget,
} from '../services/budgeting/budget.domain'
import {
  allocateLandedCost,
  planRepost,
  suggestReorders,
  type CostedIssue,
} from '../services/inventory-costing/repost.domain'
import {
  buildBillableLines,
  profitability,
  summarise as summariseTime,
  validateBilling,
  type ProjectBillingConfig,
  type TimeEntry,
} from '../services/timesheets/billing.domain'
import type { CostLayer } from '../services/inventory-costing'

// ══════════════════════════════════════════════ BUDGETS

describe('budgets count what is committed, not only what is spent', () => {
  const budget = (over: Partial<Budget> = {}): Budget => ({
    id: 'b1',
    accountId: 'rent',
    period: 'monthly',
    startsOn: '2026-01-01',
    amountMinor: 1_000_000,
    action: 'block',
    warnAtPercent: 80,
    isActive: true,
    ...over,
  })

  it('SUBTRACTS COMMITTED SPEND from what is available', () => {
    // The whole point: telling somebody they are over budget after the money
    // is gone is a report, not a control.
    const status = evaluate(
      budget(),
      { actualMinor: 400_000, committedMinor: 500_000 },
      '2026-03-15',
    )
    expect(status.availableMinor).toBe(100_000)
  })

  it('warns before it blocks', () => {
    const status = evaluate(budget(), { actualMinor: 850_000, committedMinor: 0 }, '2026-03-15')
    expect(status.state).toBe('warning')
  })

  it('reports exceeded when committed alone takes it over', () => {
    const status = evaluate(budget(), { actualMinor: 0, committedMinor: 1_100_000 }, '2026-03-15')
    expect(status.state).toBe('exceeded')
    expect(status.availableMinor).toBe(-100_000)
  })

  it('works out which period a date falls in', () => {
    expect(periodFor(budget(), '2026-03-15')).toEqual({ start: '2026-03-01', end: '2026-03-31' })
  })

  it('handles a quarterly budget', () => {
    expect(periodFor(budget({ period: 'quarterly' }), '2026-05-15').start).toBe('2026-04-01')
  })

  it('BLOCKS only when the budget says block', () => {
    const over = evaluate(
      budget({ action: 'warn' }),
      { actualMinor: 990_000, committedMinor: 0 },
      '2026-03-15',
    )
    const check = checkSpend([{ status: over, amountMinor: 50_000 }])

    // A control that stops the shop is a control somebody deletes.
    expect(check.allowed).toBe(true)
    expect(check.warnings).toHaveLength(1)
  })

  it('refuses when a blocking budget would be exceeded', () => {
    const status = evaluate(budget(), { actualMinor: 990_000, committedMinor: 0 }, '2026-03-15')
    const check = checkSpend([{ status, amountMinor: 50_000 }])

    expect(check.allowed).toBe(false)
    expect(check.problems[0]!.overBy).toBe(40_000)
  })

  it('lets a workspace-wide and a per-project cap both apply', () => {
    // The tightest binds, which falls out of checking all of them.
    const budgets = [budget({ id: 'all' }), budget({ id: 'proj', dimensionValueId: 'p1' })]
    const applicable = applicableBudgets(budgets, { accountId: 'rent', dimensionValueId: 'p1' })
    expect(applicable.map((b) => b.id)).toEqual(['all', 'proj'])
  })

  it('does not apply a project budget to another project', () => {
    const budgets = [budget({ id: 'proj', dimensionValueId: 'p1' })]
    expect(applicableBudgets(budgets, { accountId: 'rent', dimensionValueId: 'p2' })).toEqual([])
  })

  it('EXCLUDES committed spend from the retrospective variance', () => {
    // A purchase order that was never received did not happen.
    const rows = varianceReport([
      { budget: budget(), periodStart: '2026-03-01', actualMinor: 1_200_000 },
    ])
    expect(rows[0]!.varianceMinor).toBe(200_000)
    expect(rows[0]!.variancePercent).toBe(20)
  })

  it('has no percentage against a zero budget', () => {
    const rows = varianceReport([
      { budget: budget({ amountMinor: 0 }), periodStart: '2026-03-01', actualMinor: 500 },
    ])
    expect(rows[0]!.variancePercent).toBeNull()
  })
})

// ══════════════════════════════════════════════ BACKDATED REPOST

describe('a backdated receipt changes what earlier sales cost', () => {
  const layer = (id: string, unitCost: number, qty: number, entryDate: string): CostLayer => ({
    id,
    productId: 'p1',
    warehouseId: null,
    remainingQty: qty,
    unitCost,
    entryDate,
    createdAt: `${entryDate}T00:00:00.000Z`,
  })

  const issue = (over: Partial<CostedIssue> = {}): CostedIssue => ({
    consumerType: 'invoice',
    consumerId: 'inv-1',
    consumerLine: 'l1',
    productId: 'p1',
    quantity: 1,
    entryDate: '2026-03-10',
    recordedCostMinor: 100_000,
    ...over,
  })

  it('FINDS the sales whose cost is now wrong', () => {
    // A receipt entered today but dated last month belongs BEFORE sales that
    // have already been costed and posted.
    const layers = [
      layer('backdated', 800, 10, '2026-03-01'),
      layer('later', 1000, 10, '2026-04-01'),
    ]
    const plan = planRepost(layers, [issue()], '2026-03-01')

    expect(plan.adjustments).toHaveLength(1)
    expect(plan.adjustments[0]!.recomputedCostMinor).toBe(80_000)
    expect(plan.adjustments[0]!.differenceMinor).toBe(-20_000)
  })

  it('omits documents whose cost did not change', () => {
    const layers = [layer('l1', 1000, 10, '2026-03-01')]
    expect(planRepost(layers, [issue()], '2026-03-01').adjustments).toEqual([])
  })

  it('leaves everything before the disturbance alone', () => {
    const layers = [layer('l1', 800, 10, '2026-03-01')]
    const plan = planRepost(layers, [issue({ entryDate: '2026-01-15' })], '2026-03-01')
    expect(plan.examined).toBe(0)
  })

  it('CONSUMES AS IT REPLAYS, so each sale sees what the last one left', () => {
    // A replay that does not spend the layers gives every document the same
    // first layer and produces adjustments that are all identical and all
    // wrong.
    const layers = [layer('cheap', 800, 1, '2026-03-01'), layer('dear', 2000, 10, '2026-03-02')]
    const plan = planRepost(
      layers,
      [
        issue({ consumerLine: 'a', recordedCostMinor: 0 }),
        issue({ consumerLine: 'b', recordedCostMinor: 0 }),
      ],
      '2026-03-01',
    )

    expect(plan.adjustments[0]!.recomputedCostMinor).toBe(80_000)
    expect(plan.adjustments[1]!.recomputedCostMinor).toBe(200_000)
  })

  it('is deterministic across runs', () => {
    const layers = [layer('l1', 900, 20, '2026-03-01')]
    const issues = [issue({ consumerLine: 'b' }), issue({ consumerLine: 'a' })]
    const first = planRepost(layers, issues, '2026-03-01')
    const second = planRepost(layers, [...issues].reverse(), '2026-03-01')
    expect(second.adjustments).toEqual(first.adjustments)
  })

  it('reports the net effect on cost of goods sold', () => {
    const layers = [layer('l1', 800, 10, '2026-03-01')]
    const plan = planRepost(layers, [issue(), issue({ consumerLine: 'l2' })], '2026-03-01')
    expect(plan.netAdjustmentMinor).toBe(-40_000)
  })
})

// ══════════════════════════════════════════════ LANDED COST

describe('landed cost', () => {
  const lines = [
    { layerId: 'a', quantityMinor: 10, valueMinor: 800_000 },
    { layerId: 'b', quantityMinor: 40, valueMinor: 200_000 },
  ]

  it('spreads a charge by value', () => {
    const allocation = allocateLandedCost(100_000, lines, 'value')
    expect(allocation.find((row) => row.layerId === 'a')!.allocatedMinor).toBe(80_000)
  })

  it('spreads by quantity when the charge is per item', () => {
    const allocation = allocateLandedCost(100_000, lines, 'quantity')
    expect(allocation.find((row) => row.layerId === 'b')!.allocatedMinor).toBe(80_000)
  })

  it('ALLOCATES THE CHARGE EXACTLY, remainder included', () => {
    // Dropping the remainder means the goods absorb less than was paid, and
    // the difference has to go somewhere nobody chose.
    const allocation = allocateLandedCost(100_001, lines, 'value')
    expect(allocation.reduce((sum, row) => sum + row.allocatedMinor, 0)).toBe(100_001)
  })

  it('raises the unit cost of the goods', () => {
    const allocation = allocateLandedCost(100_000, lines, 'value')
    // 800,000 + 80,000 over 10 units.
    expect(allocation.find((row) => row.layerId === 'a')!.newUnitCostMinor).toBe(88_000)
  })

  it('falls back to an equal split rather than dividing by zero', () => {
    const noWeights = [
      { layerId: 'a', quantityMinor: 1, valueMinor: 100 },
      { layerId: 'b', quantityMinor: 1, valueMinor: 100 },
    ]
    const allocation = allocateLandedCost(1000, noWeights, 'weight')
    expect(allocation.map((row) => row.allocatedMinor)).toEqual([500, 500])
  })
})

// ══════════════════════════════════════════════ REORDERING

describe('reordering', () => {
  const item = (over: Partial<Parameters<typeof suggestReorders>[0][number]> = {}) => ({
    productId: 'p1',
    productName: 'A35',
    onHand: 3,
    onOrder: 0,
    reorderLevel: 10,
    reorderQuantity: 50,
    ...over,
  })

  it('SUBTRACTS WHAT IS ALREADY ON ORDER', () => {
    // The classic reorder bug: the report fires every day until the goods
    // physically arrive, and a shop that trusts it takes four deliveries.
    expect(suggestReorders([item({ onHand: 3, onOrder: 50 })])).toEqual([])
  })

  it('suggests when available stock is at or below the level', () => {
    expect(suggestReorders([item()])).toHaveLength(1)
  })

  it('RANKS BY DAYS OF COVER, not by how far below the level it is', () => {
    // Ten units below the level is a week for one product and an hour for
    // another.
    const suggestions = suggestReorders([
      item({ productId: 'slow', onHand: 5, dailyDemand: 0.2, leadTimeDays: 7 }),
      item({ productId: 'fast', onHand: 5, dailyDemand: 5, leadTimeDays: 7 }),
    ])
    expect(suggestions[0]!.productId).toBe('fast')
    expect(suggestions[0]!.urgency).toBe('critical')
  })

  it('calls it critical when stock runs out before a delivery could arrive', () => {
    const [suggestion] = suggestReorders([item({ onHand: 6, dailyDemand: 2, leadTimeDays: 7 })])
    expect(suggestion!.urgency).toBe('critical')
  })

  it('reports days of cover as null when demand is unknown', () => {
    expect(suggestReorders([item()])[0]!.daysOfCover).toBeNull()
  })
})

// ══════════════════════════════════════════════ TIMESHEET BILLING

describe('recorded, billable and billed are three different numbers', () => {
  const config: ProjectBillingConfig = {
    projectId: 'proj-1',
    method: 'hourly',
    defaultRateMinor: 100_000, // 1,000 AFN/hour
  }

  const entry = (over: Partial<TimeEntry> = {}): TimeEntry => ({
    id: 'e1',
    projectId: 'proj-1',
    employeeId: 'emp-1',
    onDate: '2026-06-15',
    minutes: 120,
    billable: true,
    description: 'work',
    ...over,
  })

  it('keeps all three apart', () => {
    const entries = [
      entry({ id: 'a', minutes: 120, billable: true, invoiceId: 'inv-1' }),
      entry({ id: 'b', minutes: 180, billable: true }),
      entry({ id: 'c', minutes: 60, billable: false }),
    ]
    const totals = summariseTime(entries, config)

    expect(totals.recordedMinutes).toBe(360)
    expect(totals.billableMinutes).toBe(300)
    expect(totals.billedMinutes).toBe(120)
    expect(totals.unbilledMinutes).toBe(180)
  })

  it('A FIXED-PRICE PROJECT HAS NO BILLABLE TIME however entries are flagged', () => {
    // The project's method wins over a person ticking a box on a form.
    const totals = summariseTime([entry()], { ...config, method: 'fixed' })
    expect(totals.billableMinutes).toBe(0)
  })

  it('REFUSES an already-invoiced entry rather than skipping it', () => {
    // Skipping it produces an invoice for less than expected and no
    // explanation of where the hours went.
    expect(validateBilling([entry({ invoiceId: 'inv-1' })], config)).toContain(
      'TIME_ALREADY_INVOICED',
    )
  })

  it('refuses to bill an hour at a rate of zero', () => {
    // Not a discount — a rate somebody forgot to set, giving the work away.
    expect(validateBilling([entry({ rateMinor: 0 })], config)).toContain('TIME_RATE_MISSING')
  })

  it('refuses to exceed a project cap', () => {
    expect(
      validateBilling([entry({ minutes: 600 })], { ...config, budgetCapMinor: 500_000 }, 0),
    ).toContain('TIME_BUDGET_CAP_EXCEEDED')
  })

  it('accepts ordinary billable time', () => {
    expect(validateBilling([entry()], config)).toEqual([])
  })
})

describe('building invoice lines from time', () => {
  const config: ProjectBillingConfig = {
    projectId: 'proj-1',
    method: 'hourly',
    defaultRateMinor: 100_000,
  }

  it('ROUNDS ONCE on the summed minutes, not per entry', () => {
    // Eleven six-minute calls rounded individually give a different number
    // than one sixty-six-minute block.
    const entries = Array.from({ length: 11 }, (_, i) => ({
      id: `e${i}`,
      projectId: 'proj-1',
      employeeId: 'emp-1',
      onDate: '2026-06-15',
      minutes: 6,
      billable: true,
      description: 'call',
    }))

    const [line] = buildBillableLines(entries, config)
    expect(line!.minutes).toBe(66)
    expect(line!.amountMinor).toBe(110_000)
  })

  it('groups by employee and rate', () => {
    const entries = [
      {
        id: 'a',
        projectId: 'proj-1',
        employeeId: 'e1',
        onDate: '',
        minutes: 60,
        billable: true,
        description: '',
      },
      {
        id: 'b',
        projectId: 'proj-1',
        employeeId: 'e2',
        onDate: '',
        minutes: 60,
        billable: true,
        description: '',
      },
    ]
    expect(buildBillableLines(entries, config)).toHaveLength(2)
  })

  it('excludes what is already invoiced', () => {
    const entries = [
      {
        id: 'a',
        projectId: 'proj-1',
        employeeId: 'e1',
        onDate: '',
        minutes: 60,
        billable: true,
        description: '',
        invoiceId: 'inv-1',
      },
    ]
    expect(buildBillableLines(entries, config)).toEqual([])
  })

  it('produces the same lines every run', () => {
    const entries = [
      {
        id: 'b',
        projectId: 'proj-1',
        employeeId: 'z',
        onDate: '',
        minutes: 60,
        billable: true,
        description: '',
      },
      {
        id: 'a',
        projectId: 'proj-1',
        employeeId: 'a',
        onDate: '',
        minutes: 60,
        billable: true,
        description: '',
      },
    ]
    const first = buildBillableLines(entries, config)
    const second = buildBillableLines([...entries].reverse(), config)
    expect(second).toEqual(first)
  })
})

describe('project profitability', () => {
  it('VALUES LABOUR AT COST, not at the billing rate', () => {
    // Using the billing rate on both sides makes every project look like it
    // broke exactly even — the most common way an agency finds a loss at year
    // end.
    const result = profitability({
      projectId: 'p1',
      revenueMinor: 1_000_000,
      expenseMinor: 100_000,
      entries: [
        {
          id: 'a',
          projectId: 'p1',
          employeeId: 'e1',
          onDate: '',
          minutes: 600,
          billable: true,
          description: '',
        },
      ],
      costRateByEmployee: new Map([['e1', 40_000]]),
    })

    expect(result.labourCostMinor).toBe(400_000)
    expect(result.marginMinor).toBe(500_000)
    expect(result.marginPercent).toBe(50)
  })

  it('surfaces the hours that will never be billed', () => {
    const result = profitability({
      projectId: 'p1',
      revenueMinor: 0,
      expenseMinor: 0,
      entries: [
        {
          id: 'a',
          projectId: 'p1',
          employeeId: 'e1',
          onDate: '',
          minutes: 300,
          billable: false,
          description: '',
        },
      ],
      costRateByEmployee: new Map([['e1', 40_000]]),
    })
    expect(result.unbillableMinutes).toBe(300)
  })

  it('has no margin percentage on zero revenue', () => {
    const result = profitability({
      projectId: 'p1',
      revenueMinor: 0,
      expenseMinor: 0,
      entries: [],
      costRateByEmployee: new Map(),
    })
    expect(result.marginPercent).toBeNull()
  })
})
