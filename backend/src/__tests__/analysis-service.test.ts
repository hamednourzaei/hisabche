// ============================================
// analysis.service — what it READS and hands to the engines.
//
// The engines have their own tests. What can go wrong here is the reading: the
// wrong scale (major vs minor), a settle date invented for an unpaid invoice, a
// «received» date trusted on an order that never arrived, a customer name read
// across a workspace, an order date passed off as a promised date.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}

function from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let range: [number, number] | null = null

  const run = () => {
    const hit = (tables[table] ?? []).filter((row) => filters.every((f) => f(row)))
    return { data: range ? hit.slice(range[0], range[1] + 1) : hit, error: null }
  }
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
    gt: (column: string, value: number) => (
      filters.push((row) => Number(row[column]) > value),
      builder
    ),
    in: (column: string, values: unknown[]) => (
      filters.push((row) => values.includes(row[column])),
      builder
    ),
    not: (column: string, _op: string, value: unknown) => (
      filters.push((row) => (row[column] ?? null) !== value),
      builder
    ),
    order: () => builder,
    range: (start: number, end: number) => ((range = [start, end]), builder),
    maybeSingle: async () => ({ data: run().data[0] ?? null, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  }
  return builder
}

const { getProfitReport, getValuation } = vi.hoisted(() => ({
  getProfitReport: vi.fn(),
  getValuation: vi.fn(),
}))
vi.mock('../db', () => ({ supabase: { from: (table: string) => from(table) } }))
vi.mock('../services/accounting', () => ({
  AccountingService: class {
    getProfitReport = getProfitReport
  },
}))

vi.mock('../services/inventory-costing', () => ({ costing: { getValuation } }))

import { AnalysisService } from '../services/analysis/analysis.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ctx = { workspaceId: WS, userId: 'u', role: 'owner' } as never

const daysAgo = (days: number) => {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

const invoice = (id: string, overrides: Row = {}): Row => ({
  workspace_id: WS,
  invoice_id: id,
  invoice_number: `INV-${id}`,
  type: 'sale',
  customer_id: 'c1',
  currency: 'AFN',
  total: 1000,
  allocated: 0,
  outstanding: 1000,
  invoice_date: daysAgo(40),
  due_date: daysAgo(20),
  ...overrides,
})

let service: AnalysisService

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  tables.customers = [
    { id: 'c1', workspace_id: WS, full_name: 'احمد' },
    { id: 'c1', workspace_id: OTHER, full_name: 'someone else' },
  ]
  getProfitReport.mockReset()
  getValuation.mockReset()
  service = new AnalysisService()
})

describe('collections worklist', () => {
  it('lists overdue invoices, firmest first, with the customer named and money in major units', async () => {
    tables.invoice_outstanding = [
      invoice('a', { due_date: daysAgo(20), allocated: 749.5, outstanding: 250.5 }),
      invoice('b', { due_date: daysAgo(60) }),
      invoice('not-due', { due_date: daysAgo(1) }),
      invoice('paid', { outstanding: 0, allocated: 1000 }),
      invoice('purchase', { type: 'purchase' }),
      invoice('theirs', { workspace_id: OTHER }),
    ]
    const list = await service.collections(ctx)

    expect(list.actions.map((action) => action.invoiceId)).toEqual(['b', 'a'])
    expect(list.actions[1]).toMatchObject({
      outstanding: 250.5,
      customerName: 'احمد',
      daysLate: 20,
    })
    // Three open sale invoices in THIS workspace, whatever their lateness.
    expect(list.openInvoices).toBe(3)
    expect(list.outstandingByCurrency).toEqual([
      { currency: 'AFN', outstanding: 2250.5, invoices: 3 },
    ])
  })

  it('what is owed is stated per currency — afghani and dollars are never added together', async () => {
    tables.invoice_outstanding = [
      invoice('a'),
      invoice('b'),
      invoice('usd', { currency: 'USD', total: 70, outstanding: 70 }),
    ]
    const list = await service.collections(ctx)
    expect(list.outstandingByCurrency).toEqual([
      { currency: 'AFN', outstanding: 2000, invoices: 2 },
      { currency: 'USD', outstanding: 70, invoices: 1 },
    ])
    expect(list.actions.find((action) => action.invoiceId === 'usd')).toMatchObject({
      currency: 'USD',
      outstanding: 70,
    })
  })

  it('a walk-in sale has no customer name — null, not a placeholder', async () => {
    tables.invoice_outstanding = [invoice('walkin', { customer_id: null })]
    const list = await service.collections(ctx)
    expect(list.actions[0]).toMatchObject({ customerId: null, customerName: null })
  })

  it('nothing overdue is an empty list WITH the count of open invoices', async () => {
    tables.invoice_outstanding = [invoice('fresh', { due_date: daysAgo(0) })]
    const list = await service.collections(ctx)
    expect(list.actions).toEqual([])
    expect(list.openInvoices).toBe(1)
  })

  it('reads past the first thousand rows', async () => {
    tables.invoice_outstanding = Array.from({ length: 1205 }, (_, index) => invoice(`i${index}`))
    const list = await service.collections(ctx)
    expect(list.openInvoices).toBe(1205)
    expect(list.actions).toHaveLength(1205)
  })
})

describe('customer risk', () => {
  it('a settled invoice is settled on its LAST allocation; an open one has no settle date', async () => {
    tables.invoice_outstanding = [
      invoice('paid', {
        outstanding: 0,
        allocated: 1000,
        due_date: '2026-06-10',
        invoice_date: '2026-06-01',
      }),
      invoice('open'),
    ]
    tables.payment_allocations = [
      { workspace_id: WS, invoice_id: 'paid', created_at: '2026-06-12T08:00:00Z' },
      { workspace_id: WS, invoice_id: 'paid', created_at: '2026-06-25T08:00:00Z' },
      // A part-payment on the open invoice must not read as «settled».
      { workspace_id: WS, invoice_id: 'open', created_at: '2026-09-01T08:00:00Z' },
    ]
    const risk = await service.customerRisk(ctx, 'c1')
    expect(risk.facts).toMatchObject({ invoices: 2, settled: 1, unsettled: 1 })
    // 1,000 major is 100,000 minor — the scale the domain asks for.
    expect(risk.facts.outstandingMinor).toBe(100_000)
  })

  it('a customer of another workspace is «not found»', async () => {
    tables.customers = [{ id: 'c9', workspace_id: OTHER, full_name: 'x' }]
    await expect(service.customerRisk(ctx, 'c9')).rejects.toThrow('not found')
  })

  it('a customer who never bought is «unknown», with the reason — not «healthy»', async () => {
    tables.invoice_outstanding = []
    const risk = await service.customerRisk(ctx, 'c1')
    expect(risk.band).toBe('unknown')
    expect(risk.reason).toBe('NEVER_BOUGHT')
  })
})

describe('customer buying pattern (health, loyalty)', () => {
  const monthsAgo = (months: number, dayOfMonth = 10) => {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, dayOfMonth))
      .toISOString()
      .slice(0, 10)
  }

  it('a customer who stopped buying reads as shrinking — empty months are zero, not skipped', async () => {
    tables.invoice_outstanding = [
      invoice('a', { invoice_date: monthsAgo(5), total: 1000 }),
      invoice('b', { invoice_date: monthsAgo(4), total: 1000 }),
      invoice('c', { invoice_date: monthsAgo(3), total: 1000 }),
    ]
    const result = await service.customerRisk(ctx, 'c1')
    expect(result.health.monthsObserved).toBe(6)
    expect(result.health.band).toBe('shrinking')
    expect(result.health.currency).toBe('AFN')
    expect(result.loyalty).toMatchObject({ tier: 'regular', activeMonths: 3, purchases: 3 })
  })

  it('one purchase is «new», and too few months for a trend is «unknown» with the reason', async () => {
    tables.invoice_outstanding = [invoice('a', { invoice_date: monthsAgo(0, 1) })]
    const result = await service.customerRisk(ctx, 'c1')
    expect(result.loyalty.tier).toBe('new')
    expect(result.health).toMatchObject({ band: 'unknown', reason: 'NOT_ENOUGH_MONTHS' })
  })

  it('the trend is taken in the customer’s main currency only, and names it', async () => {
    tables.invoice_outstanding = [
      invoice('a', { invoice_date: monthsAgo(3), total: 1000 }),
      invoice('b', { invoice_date: monthsAgo(2), total: 1000 }),
      invoice('c', { invoice_date: monthsAgo(1), total: 1000 }),
      invoice('d', { invoice_date: monthsAgo(0, 1), total: 1000 }),
      // A dollar invoice must not be added to afghani spend as if it were 9,000,000 afghani.
      invoice('usd', { invoice_date: monthsAgo(0, 1), total: 9_000_000, currency: 'USD' }),
    ]
    const result = await service.customerRisk(ctx, 'c1')
    expect(result.health.currency).toBe('AFN')
    expect(result.health.band).toBe('steady')
  })

  it('a customer who never bought has no buying pattern to report', async () => {
    tables.invoice_outstanding = []
    const result = await service.customerRisk(ctx, 'c1')
    expect(result.health).toMatchObject({ band: 'unknown', reason: 'NEVER_BOUGHT', currency: null })
    expect(result.loyalty).toMatchObject({
      tier: 'unknown',
      purchases: 0,
      daysSinceLastPurchase: null,
    })
  })
})

describe('suppliers', () => {
  const order = (id: string, overrides: Row = {}): Row => ({
    id,
    workspace_id: WS,
    supplier_id: 's1',
    order_date: '2026-08-01',
    expected_delivery_date: '2026-08-10',
    status: 'received',
    received_at: '2026-08-10T10:00:00',
    ...overrides,
  })
  const line = (orderId: string, total = 500): Row => ({
    id: `l-${orderId}`,
    workspace_id: WS,
    purchase_order_id: orderId,
    product_id: 'p1',
    quantity: 5,
    total_price: total,
  })

  beforeEach(() => {
    tables.suppliers = [{ id: 's1', workspace_id: WS, name: 'تأمین‌کننده', is_active: true }]
  })

  it('an order that never arrived is NOT received, whatever its received_at default says', async () => {
    tables.purchase_orders = [
      order('o1'),
      order('o2'),
      // `received_at` defaults to now() on insert; the status is the truth.
      order('o3', { status: 'ordered', received_at: '2026-08-01T00:00:00' }),
    ]
    tables.purchase_order_items = ['o1', 'o2', 'o3'].map((id) => line(id))
    const result = await service.suppliers(ctx)
    expect(result.suppliers[0]!.evidence).toMatchObject({
      purchases: 3,
      received: 2,
      neverReceived: 1,
    })
  })

  it('an order with no promised date is not scored for punctuality — and is counted as such', async () => {
    tables.purchase_orders = [
      order('o1'),
      order('o2'),
      order('o3'),
      // Ordered in January, received in August: a seven-month lead time that
      // would read as seven months late if the order date were the promise.
      order('late-looking', { order_date: '2026-01-01', expected_delivery_date: null }),
    ]
    tables.purchase_order_items = ['o1', 'o2', 'o3', 'late-looking'].map((id) => line(id))
    const result = await service.suppliers(ctx)
    expect(result.ordersWithoutPromisedDate).toBe(1)
    expect(result.orders).toBe(4)
    expect(result.suppliers[0]!.evidence.purchases).toBe(3)
    expect(result.suppliers[0]!.evidence.averageDaysLate ?? 0).toBeLessThan(1)
  })

  it('spend through one supplier is reported as concentration, from every order', async () => {
    tables.suppliers!.push({ id: 's2', workspace_id: WS, name: 'دیگری', is_active: true })
    tables.purchase_orders = [order('o1'), order('o2', { supplier_id: 's2' })]
    tables.purchase_order_items = [line('o1', 9000), line('o2', 1000)]
    const result = await service.suppliers(ctx)
    expect(result.concentration).toMatchObject([
      { kind: 'SUPPLIER_CONCENTRATION', subjectId: 's1', sharePercent: 90 },
    ])
  })

  it('a cancelled order and another workspace’s order are not counted', async () => {
    tables.purchase_orders = [
      order('o1'),
      order('gone', { status: 'cancelled' }),
      order('theirs', { workspace_id: OTHER }),
    ]
    tables.purchase_order_items = [line('o1'), line('gone'), line('theirs')]
    expect((await service.suppliers(ctx)).orders).toBe(1)
  })
})

describe('break-even', () => {
  it('uses the accounting core’s profit report and its salaries; «other» absent is passed as null', async () => {
    getProfitReport.mockResolvedValue({
      from: '2026-09-01',
      to: '2026-09-30',
      currency: 'AFN',
      products: [],
      totals: {
        revenue: 0,
        cost: 0,
        grossProfit: 0,
        salaries: 4000,
        netProfit: 0,
        netMarginPercent: null,
        invoiceCount: 0,
        payrollCount: 0,
      },
      otherCurrencies: [],
    })
    const result = await service.breakEven(ctx, {
      from: '2026-09-01',
      to: '2026-09-30',
      currency: 'AFN',
      otherFixedCosts: null,
    })
    expect(getProfitReport).toHaveBeenCalledWith(ctx, '2026-09-01', '2026-09-30', 'AFN')
    expect(result.fixedCostsTotal).toBe(4000)
    // With no «other» figure the total is a floor, and says so.
    expect(result.isLowerBound).toBe(true)
    expect(result.currency).toBe('AFN')
  })
})

describe('cohorts', () => {
  it('groups customers by the month of their first purchase and ignores walk-in sales', async () => {
    tables.invoice_outstanding = [
      invoice('a', { customer_id: 'c1', invoice_date: '2026-07-05' }),
      invoice('b', { customer_id: 'c1', invoice_date: '2026-08-05' }),
      invoice('c', { customer_id: 'c2', invoice_date: '2026-08-09' }),
      invoice('walkin', { customer_id: null, invoice_date: '2026-07-01' }),
    ]
    const { cohorts } = await service.cohorts(ctx)
    expect(cohorts.map((row) => [row.cohort, row.size])).toEqual([
      ['2026-07', 1],
      ['2026-08', 1],
    ])
  })
})

describe('working capital', () => {
  const report = (revenue: number, cost: number) => ({
    from: '2026-09-01',
    to: '2026-09-30',
    currency: 'AFN',
    products: [],
    totals: {
      revenue,
      cost,
      grossProfit: revenue - cost,
      salaries: 0,
      netProfit: 0,
      netMarginPercent: null,
      invoiceCount: 0,
      payrollCount: 0,
    },
    otherCurrencies: [{ currency: 'USD', invoices: 2, payrolls: 0 }],
  })

  it('reads each leg from where it lives, in ONE currency, over the actual days', async () => {
    getProfitReport.mockResolvedValue(report(30_000, 15_000))
    getValuation.mockResolvedValue([
      { productId: 'p', productName: 'x', onHand: 1, value: 5000, averageCost: 5000 },
    ])
    tables.invoice_outstanding = [
      invoice('s1', { outstanding: 10_000, total: 10_000, invoice_date: '2026-09-05' }),
      // Another currency is not a receivable in this one.
      invoice('s-usd', { currency: 'USD', outstanding: 999, total: 999 }),
      invoice('p1', {
        type: 'purchase',
        total: 20_000,
        outstanding: 4000,
        invoice_date: '2026-09-10',
      }),
      // Bought before the range: still owed (a payable), but not a purchase OF the range.
      invoice('p-old', {
        type: 'purchase',
        total: 8000,
        outstanding: 1000,
        invoice_date: '2026-06-01',
      }),
      invoice('theirs', { workspace_id: OTHER, outstanding: 77_000 }),
    ]
    const result = await service.workingCapital(ctx, {
      from: '2026-09-01',
      to: '2026-09-30',
      currency: 'AFN',
    })

    expect(result.daysInPeriod).toBe(30)
    expect(result).toMatchObject({
      receivables: 10_000,
      payables: 5000,
      purchases: 20_000,
      inventoryAtCost: 5000,
    })
    // 10,000 × 30 ÷ 30,000 = 10 days; 5,000 × 30 ÷ 20,000 = 7.5; 5,000 × 30 ÷ 15,000 = 10.
    expect(result).toMatchObject({ dso: 10, dpo: 7.5, dio: 10, cashConversionCycle: 12.5 })
    expect(result.netWorkingCapital).toBe(10_000)
    expect(result.otherCurrencies).toEqual(['USD'])
  })

  it('no sales in the period is «cannot be computed», not zero days — and there is no quick ratio', async () => {
    getProfitReport.mockResolvedValue(report(0, 0))
    getValuation.mockResolvedValue([])
    tables.invoice_outstanding = [invoice('s1', { outstanding: 500, total: 500 })]
    const result = await service.workingCapital(ctx, {
      from: '2026-09-01',
      to: '2026-09-30',
      currency: 'AFN',
    })
    expect(result).toMatchObject({ dso: null, dpo: null, dio: null, cashConversionCycle: null })
    expect(result).not.toHaveProperty('quickRatio')
  })

  it('an over-paid invoice is not a negative receivable', async () => {
    getProfitReport.mockResolvedValue(report(1000, 500))
    getValuation.mockResolvedValue([])
    tables.invoice_outstanding = [
      invoice('s1', { outstanding: 300, total: 300 }),
      invoice('over', { outstanding: -200, total: 100, allocated: 300 }),
    ]
    const result = await service.workingCapital(ctx, {
      from: '2026-09-01',
      to: '2026-09-30',
      currency: 'AFN',
    })
    expect(result.receivables).toBe(300)
  })
})
