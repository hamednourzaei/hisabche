// ============================================
// packages/validation/src/schemas/analysis-report.domain.ts
//
// The ASSEMBLY of the business-analysis reports: collections, customer risk,
// suppliers, break-even, working capital and cohorts.
//
// Every figure is produced by the domain module that owns it (collections,
// customer-risk, supplier-intelligence, break-even, working-capital, cohort).
// This file only lays rows out for them and shapes the answer — so the server
// (rows from Postgres) and the device (rows from SQLite) hand over the SAME
// rows to the SAME functions and cannot disagree about «late», «outstanding» or
// «profit».
//
// ⚠️ MONEY CROSSES INTO THE DOMAINS IN MINOR UNITS, where they ask for it
// (`amountMinor`), and comes back out in major units with the scale in the
// field name. `invoice_outstanding.total` is MAJOR.
// ============================================

import { breakEven, type BreakEvenResult } from './break-even.domain'
import { buildCohorts, type CohortRow } from './cohort.domain'
import {
  DEFAULT_REMINDER_SETTINGS,
  collectionsFor,
  type ReminderChannel,
  type ReminderTone,
} from './collections.domain'
import { customerRisk, type CustomerRisk, type PaymentBehaviour } from './customer-risk.domain'
import { customerHealth, loyaltyTier, type CustomerHealth, type LoyaltyTier } from './nps.domain'
import type { OpenInvoice } from './payments.domain'
import type { ProfitReport } from './profit-report.domain'
import {
  scoreSupplier,
  supplierConcentration,
  type ConcentrationFinding,
  type PurchaseRecord,
  type SupplierRisk,
} from './supplier-intelligence.domain'
import { workingCapital } from './working-capital.domain'

const toMinor = (major: unknown) => Math.round((Number(major) || 0) * 100)
const day = (value: unknown) => String(value ?? '').slice(0, 10)

/** One invoice as `invoice_outstanding` states it (a view on the server, a query on the device). */
export interface OutstandingRow {
  invoice_id: string
  invoice_number: string | null
  total: number | string | null
  allocated: number | string | null
  outstanding: number | string | null
  due_date: string | null
  invoice_date: string | null
  customer_id: string | null
  currency?: string | null | undefined
}

// ─── Collections (#51 #53 #66) ───────────────────────────────

export interface CollectionsWorklist {
  asOf: string
  /** How many invoices are open at all — so «nothing to chase» can be told from «nothing owed». */
  openInvoices: number
  /**
   * What is still owed on sale invoices, in major units, PER CURRENCY. There is
   * no single total: adding afghani to dollars is not a sum.
   */
  outstandingByCurrency: Array<{ currency: string; outstanding: number; invoices: number }>
  /** Who to remind today, firmest first. */
  actions: Array<{
    invoiceId: string
    invoiceNumber: string
    customerId: string | null
    customerName: string | null
    outstanding: number
    currency: string
    daysLate: number
    tone: ReminderTone
    channel: ReminderChannel
  }>
}

/**
 * Which open sale invoices are due a reminder today, and how firm — names not
 * yet filled in (`customerName` is null; read the names of `actions` and call
 * `withCustomerNames`). The schedule is the domain's stated default.
 */
export function collectionsWorklist(
  rows: readonly OutstandingRow[],
  asOf: string,
): CollectionsWorklist {
  const invoices = rows.map((row) => ({
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number ?? '',
    total: Number(row.total) || 0,
    allocated: Number(row.allocated) || 0,
    dueDate: day(row.due_date),
    invoiceDate: day(row.invoice_date),
    customerId: row.customer_id,
  })) satisfies Array<OpenInvoice & { customerId: string | null }>

  const verdict = collectionsFor(invoices, asOf, DEFAULT_REMINDER_SETTINGS)
  const actions = verdict.kind === 'remind' ? verdict.actions : []

  const currencyOf = new Map(rows.map((row) => [row.invoice_id, row.currency ?? '']))
  const byCurrency = new Map<string, { minor: number; invoices: number }>()
  for (const row of rows) {
    const entry = byCurrency.get(row.currency ?? '') ?? { minor: 0, invoices: 0 }
    entry.minor += toMinor(row.outstanding)
    entry.invoices += 1
    byCurrency.set(row.currency ?? '', entry)
  }

  return {
    asOf,
    openInvoices: rows.length,
    outstandingByCurrency: [...byCurrency.entries()]
      .map(([currency, entry]) => ({
        currency,
        outstanding: entry.minor / 100,
        invoices: entry.invoices,
      }))
      .sort((a, b) => b.invoices - a.invoices),
    actions: actions
      .map((action) => ({
        invoiceId: action.invoiceId,
        invoiceNumber: action.invoiceNumber,
        customerId: action.customerId,
        // null, not a placeholder: a walk-in sale has no customer to name.
        customerName: null,
        outstanding: action.outstandingMinor / 100,
        currency: currencyOf.get(action.invoiceId) ?? '',
        daysLate: action.daysLate,
        tone: action.tone,
        channel: action.channel,
      }))
      .sort((a, b) => b.daysLate - a.daysLate),
  }
}

/** The worklist with each customer named; an id with no name stays null. */
export function withCustomerNames(
  worklist: CollectionsWorklist,
  names: ReadonlyMap<string, string>,
): CollectionsWorklist {
  return {
    ...worklist,
    actions: worklist.actions.map((action) => ({
      ...action,
      customerName: action.customerId ? (names.get(action.customerId) ?? null) : null,
    })),
  }
}

// ─── Customer risk (#18) ─────────────────────────────────────

export interface CustomerAssessment extends CustomerRisk {
  /** How their buying has moved; `currency` is the one the trend is taken in. */
  health: CustomerHealth & { currency: string | null }
  /** A label on facts — no points, nothing to redeem. */
  loyalty: {
    tier: LoyaltyTier
    activeMonths: number
    purchases: number
    daysSinceLastPurchase: number | null
  }
}

/** The invoices that are paid in full: only these have a «settled on» day. */
export function settledInvoiceIds(rows: readonly OutstandingRow[]): string[] {
  return rows
    .filter((row) => toMinor(row.outstanding) <= 0 && toMinor(row.total) > 0)
    .map((row) => row.invoice_id)
}

/**
 * How one customer has actually paid, and what that says.
 *
 * «Settled on» is the day of the LAST allocation on an invoice with nothing left
 * to pay (`settledOn`: invoice id → day). An invoice that is not fully paid has
 * no settle date — it is unsettled, not «late so far», and the domain treats
 * the two apart.
 */
export function customerAssessment(input: {
  customerId: string
  rows: readonly OutstandingRow[]
  settledOn: ReadonlyMap<string, string>
  asOf: string
}): CustomerAssessment {
  const { customerId, rows, settledOn, asOf } = input
  const payments: PaymentBehaviour[] = rows.map((row) => ({
    invoiceId: row.invoice_id,
    issuedOn: day(row.invoice_date),
    dueOn: day(row.due_date) || day(row.invoice_date),
    settledOn: settledOn.get(row.invoice_id) ?? null,
    amountMinor: toMinor(row.total),
    outstandingMinor: Math.max(0, toMinor(row.outstanding)),
  }))

  const risk = customerRisk({
    customerId,
    payments,
    // The credit limit lives in the customer-profile core; null means «no limit
    // known» to the domain — it never means zero.
    creditLimitMinor: null,
    asOf,
  })

  return { ...risk, ...buyingPattern(customerId, rows, asOf) }
}

/**
 * How this customer has been BUYING (#108 health, #109 loyalty) — a reading of
 * the same invoices, not a points scheme.
 *
 * ⚠️ The spend trend is taken in ONE currency — the one most of the customer's
 * invoices are in — and that currency is named. Months with no purchase are in
 * the series as zero: a customer who stopped buying must read as shrinking.
 */
function buyingPattern(
  customerId: string,
  rows: readonly OutstandingRow[],
  asOf: string,
): Pick<CustomerAssessment, 'health' | 'loyalty'> {
  const dated = rows.filter((row) => day(row.invoice_date) !== '')
  const months = [...new Set(dated.map((row) => day(row.invoice_date).slice(0, 7)))].sort()
  const last =
    dated
      .map((row) => day(row.invoice_date))
      .sort()
      .at(-1) ?? null
  const daysSinceLastPurchase =
    last === null
      ? null
      : Math.max(
          0,
          Math.round(
            (Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 86_400_000,
          ),
        )

  const perCurrency = new Map<string, number>()
  for (const row of dated)
    perCurrency.set(row.currency ?? '', (perCurrency.get(row.currency ?? '') ?? 0) + 1)
  const currency = [...perCurrency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const series: Array<{ month: string; amountMinor: number }> = []
  if (months.length > 0) {
    const spend = new Map<string, number>()
    for (const row of dated) {
      if ((row.currency ?? '') !== currency) continue
      const month = day(row.invoice_date).slice(0, 7)
      spend.set(month, (spend.get(month) ?? 0) + toMinor(row.total))
    }
    let [year, month] = (months[0] as string).split('-').map(Number) as [number, number]
    const end = asOf.slice(0, 7)
    for (let guard = 0; guard < 600; guard++) {
      const key = `${year}-${String(month).padStart(2, '0')}`
      if (key > end) break
      series.push({ month: key, amountMinor: spend.get(key) ?? 0 })
      month += 1
      if (month > 12) {
        month = 1
        year += 1
      }
    }
  }

  return {
    health: {
      ...customerHealth({
        customerId,
        monthlySpend: series,
        daysSinceLastPurchase,
        monthsObserved: series.length,
      }),
      currency,
    },
    loyalty: {
      tier: loyaltyTier({
        activeMonths: months.length,
        daysSinceLastPurchase,
        repeatPurchases: Math.max(0, dated.length - 1),
      }).tier,
      activeMonths: months.length,
      purchases: dated.length,
      daysSinceLastPurchase,
    },
  }
}

// ─── Suppliers (#10 #15 #19) ─────────────────────────────────

export interface SupplierAnalysis {
  asOf: string
  suppliers: Array<SupplierRisk & { name: string }>
  concentration: ConcentrationFinding[]
  /** Orders with no promised date: counted in spend, excluded from punctuality. */
  ordersWithoutPromisedDate: number
  orders: number
}

export interface SupplierOrderRow {
  id: string
  supplier_id: string | null
  order_date: string | null
  expected_delivery_date: string | null
  status: string | null
  received_at: string | null
}

export interface SupplierOrderItemRow {
  product_id: string
  quantity: number | string
  total_price: number | string
}

/**
 * Each supplier's punctuality and price, and where the spend is concentrated.
 *
 * ⚠️ «LATE» IS MEASURED AGAINST THE PROMISED DATE. Only orders that carry an
 * expected delivery date are scored for punctuality — the rest still count
 * towards spend and concentration, and their number is reported.
 *
 * ⚠️ `received_at` IS TRUSTED ONLY ON A RECEIVED ORDER.
 */
export function supplierAnalysis(input: {
  asOf: string
  suppliers: ReadonlyArray<{ id: string; name: string; is_active: boolean | number | null }>
  orders: readonly SupplierOrderRow[]
  items: ReadonlyMap<string, readonly SupplierOrderItemRow[]>
}): SupplierAnalysis {
  const { asOf } = input
  const live = input.orders.filter((order) => order.supplier_id && order.status !== 'cancelled')

  const all: PurchaseRecord[] = []
  const scorable: PurchaseRecord[] = []
  let withoutPromise = 0

  for (const order of live) {
    const promised = day(order.expected_delivery_date)
    const received = order.status === 'received' ? day(order.received_at) || null : null
    if (!promised) withoutPromise += 1

    for (const item of input.items.get(order.id) ?? []) {
      const record: PurchaseRecord = {
        supplierId: order.supplier_id as string,
        productId: item.product_id,
        orderedDate: promised || day(order.order_date),
        receivedDate: received,
        amountMinor: toMinor(item.total_price),
        // No price list exists; the paid price is its own reference, so the
        // price signal reads «no premium» rather than inventing one.
        listPriceMinor: toMinor(item.total_price),
        quantity: Number(item.quantity) || 0,
      }
      all.push(record)
      if (promised) scorable.push(record)
    }
  }

  const facts = input.suppliers.map((supplier) => ({
    supplierId: supplier.id,
    name: supplier.name,
    active: supplier.is_active !== false && supplier.is_active !== 0,
  }))

  return {
    asOf,
    suppliers: facts
      .map((supplier) => ({ ...scoreSupplier(supplier, scorable, asOf), name: supplier.name }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
    concentration: supplierConcentration(all, facts),
    ordersWithoutPromisedDate: withoutPromise,
    orders: live.length,
  }
}

// ─── Break-even (#133) ───────────────────────────────────────

/**
 * How many units of each product cover the fixed costs of the period. The
 * profit report is the accounting core's own; fixed costs are the salaries it
 * already counts plus whatever the person states as «other». With no other
 * figure the result is a LOWER bound, and says so.
 */
export function breakEvenAnalysis(
  report: ProfitReport,
  otherFixedCosts: number | null,
): BreakEvenResult & { from: string; to: string; currency: string } {
  const result = breakEven(report, { salaries: report.totals.salaries, other: otherFixedCosts })
  return { ...result, from: report.from, to: report.to, currency: report.currency }
}

// ─── Working capital (#38) ───────────────────────────────────

export interface WorkingCapitalAnalysis {
  from: string
  to: string
  currency: string
  daysInPeriod: number
  /** Null = cannot be computed (no sales / purchases / cost in the period). Never zero. */
  dso: number | null
  dpo: number | null
  dio: number | null
  /** DSO + DIO − DPO. Negative is good: suppliers finance the business. */
  cashConversionCycle: number | null
  operatingCycle: number | null
  receivables: number
  payables: number
  inventoryAtCost: number
  /** Receivables + stock at cost − payables. Cash is NOT in this figure. */
  netWorkingCapital: number
  revenue: number
  costOfGoodsSold: number
  /** False when part of what was sold has no recorded cost: `costOfGoodsSold` is then a part. */
  costOfGoodsSoldKnown: boolean
  purchases: number
  /** Currencies that have documents in the range and are not in these figures. */
  otherCurrencies: string[]
}

/**
 * How many days of trading are tied up in customer debts, stock and supplier
 * debts — for ONE currency and one period.
 *
 * ⚠️ CASH IS NOT AN INPUT. There is no single cash-and-bank balance to read, so
 * the quick ratio is not computed and is not in the answer.
 * ⚠️ With part of the cost of sales unrecorded, days of stock — and every cycle
 * built on it — are not known, and are not shown as a number.
 */
export function workingCapitalAnalysis(input: {
  from: string
  to: string
  currency: string
  report: ProfitReport
  /** The currency's sale invoices (all of them — receivables are everything still owed). */
  sales: readonly OutstandingRow[]
  purchases: readonly OutstandingRow[]
  /** The costing core's whole valuation of stock, in minor units. */
  inventoryMinor: number
}): WorkingCapitalAnalysis {
  const { report, from, to } = input
  const inRange = (row: OutstandingRow) => {
    const date = day(row.invoice_date)
    return date >= from && date <= to
  }
  const owed = (rows: readonly OutstandingRow[]) =>
    rows.reduce((sum, row) => sum + Math.max(0, toMinor(row.outstanding)), 0)

  const receivablesMinor = owed(input.sales)
  const payablesMinor = owed(input.purchases)
  const purchasesMinor = input.purchases
    .filter(inRange)
    .reduce((sum, row) => sum + toMinor(row.total), 0)
  const daysInPeriod =
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1

  const costKnown = report.totals.grossProfit !== null
  const metrics = workingCapital({
    revenueMinor: toMinor(report.totals.revenue),
    costOfGoodsSoldMinor: toMinor(report.totals.cost),
    purchasesMinor,
    receivablesMinor,
    payablesMinor,
    inventoryMinor: input.inventoryMinor,
    cashMinor: 0,
    daysInPeriod,
  })

  return {
    from,
    to,
    currency: input.currency,
    daysInPeriod,
    dso: metrics.dso,
    dpo: metrics.dpo,
    dio: costKnown ? metrics.dio : null,
    cashConversionCycle: costKnown ? metrics.cashConversionCycle : null,
    operatingCycle: costKnown ? metrics.operatingCycle : null,
    costOfGoodsSoldKnown: costKnown,
    receivables: receivablesMinor / 100,
    payables: payablesMinor / 100,
    inventoryAtCost: input.inventoryMinor / 100,
    netWorkingCapital: metrics.netWorkingCapitalMinor / 100,
    revenue: report.totals.revenue,
    costOfGoodsSold: report.totals.cost,
    purchases: purchasesMinor / 100,
    otherCurrencies: report.otherCurrencies.map((other) => other.currency),
  }
}

// ─── Cohorts (#130) ──────────────────────────────────────────

/** Customers grouped by the month of their first purchase, and who came back. */
export function cohortReport(
  rows: readonly OutstandingRow[],
  asOf: string,
): { asOf: string; cohorts: CohortRow[] } {
  const customerOf = new Map<string, string | null>()
  const invoices: OpenInvoice[] = rows.map((row) => {
    customerOf.set(row.invoice_id, row.customer_id)
    return {
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number ?? '',
      total: Number(row.total) || 0,
      allocated: Number(row.allocated) || 0,
      dueDate: day(row.due_date),
      invoiceDate: day(row.invoice_date),
    }
  })
  return {
    asOf,
    cohorts: buildCohorts(invoices, (invoice) => customerOf.get(invoice.invoiceId) ?? null, asOf),
  }
}
