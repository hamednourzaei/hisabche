// ============================================
// backend/src/services/analysis/analysis.service.ts
//
// The read side of five Business-OS engines that had arithmetic and no caller:
//
//   collections worklist   collections.domain        (#51 #53 #66)
//   customer risk          customer-risk.domain      (#3 #9 #13 #18)
//   supplier risk          supplier-intelligence     (#10 #15 #19)
//   break-even             break-even.domain         (#133)
//   cohorts                cohort.domain             (#130)
//   working capital        working-capital.domain    (#38)
//
// ⚠️ THIS FILE COMPUTES NOTHING. Every figure is produced by the domain module
// that owns it; this file only reads the rows those modules need — from tables
// and views that already exist — and hands them over. No new table, no
// migration, and no second copy of «outstanding», «late» or «profit».
//
// ⚠️ EVERY READ THAT FEEDS A DECISION IS UNCAPPED (`selectAllPages`). A
// worklist built from the first 1,000 open invoices would silently hide the
// 1,001st debtor — the customer nobody is chasing.
//
// ⚠️ MONEY CROSSES INTO THE DOMAINS IN MINOR UNITS, where they ask for it
// (`amountMinor`), and comes back out to the client in major units with the
// scale stated in the field name. `invoice_outstanding.total` is MAJOR.
// ============================================

import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import { AccountingService } from '../accounting'
import { breakEven, type BreakEvenResult } from '../analytics/break-even.domain'
import { buildCohorts, type CohortRow } from '../analytics/cohort.domain'
import {
  DEFAULT_REMINDER_SETTINGS,
  collectionsFor,
  type ReminderChannel,
  type ReminderTone,
} from '../collections/collections.domain'
import {
  customerRisk,
  type CustomerRisk,
  type PaymentBehaviour,
} from '../customers/customer-risk.domain'
import {
  customerHealth,
  loyaltyTier,
  type CustomerHealth,
  type LoyaltyTier,
} from '../customers/nps.domain'
import { workingCapital } from '../financing/working-capital.domain'
import { costing } from '../inventory-costing'
import type { OpenInvoice } from '../payments/payments.domain'
import {
  scoreSupplier,
  supplierConcentration,
  type ConcentrationFinding,
  type PurchaseRecord,
  type SupplierRisk,
} from '../supplier/supplier-intelligence.domain'
import type { TenancyContext } from '../tenancy.service'

const toMinor = (major: unknown) => Math.round((Number(major) || 0) * 100)
const day = (value: unknown) => String(value ?? '').slice(0, 10)
const today = () => new Date().toISOString().slice(0, 10)

interface OutstandingRow {
  invoice_id: string
  invoice_number: string | null
  total: number | string | null
  allocated: number | string | null
  outstanding: number | string | null
  due_date: string | null
  invoice_date: string | null
  customer_id: string | null
  currency?: string | null
}

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

export interface SupplierAnalysis {
  asOf: string
  suppliers: Array<SupplierRisk & { name: string }>
  concentration: ConcentrationFinding[]
  /** Orders with no promised date: counted in spend, excluded from punctuality. */
  ordersWithoutPromisedDate: number
  orders: number
}

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
  purchases: number
  /** Currencies that have documents in the range and are not in these figures. */
  otherCurrencies: string[]
}

export class AnalysisService {
  private readonly accounting = new AccountingService()

  // ─── Collections (#51 #53 #66) ───────────────────────────────

  /**
   * Which open sale invoices are due a reminder today, and how firm.
   *
   * The schedule is the domain's stated default (3 / 15 / 45 / 75 days). There
   * is no per-workspace reminder setting and no record of reminders already
   * sent, so every invoice is judged against the FIRST step it has reached and
   * nothing is sent from here: this is a list for a person to act on.
   */
  async collections(ctx: TenancyContext): Promise<CollectionsWorklist> {
    const asOf = today()
    const { data, error } = await selectAllPages<
      OutstandingRow,
      { message: string; code?: string }
    >((from, to) =>
      supabase
        .from('invoice_outstanding')
        .select(
          'invoice_id, invoice_number, total, allocated, outstanding, due_date, invoice_date, customer_id, currency',
        )
        .eq('workspace_id', ctx.workspaceId)
        .eq('type', 'sale')
        .gt('outstanding', 0)
        .order('invoice_id', { ascending: true })
        .range(from, to),
    )
    if (error) throw new DatabaseError('Failed to read open invoices', error)

    const rows = data ?? []
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
    const names = await this.customerNames(
      ctx.workspaceId,
      actions.map((action) => action.customerId).filter((id): id is string => !!id),
    )

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
          customerName: action.customerId ? (names.get(action.customerId) ?? null) : null,
          outstanding: action.outstandingMinor / 100,
          currency: currencyOf.get(action.invoiceId) ?? '',
          daysLate: action.daysLate,
          tone: action.tone,
          channel: action.channel,
        }))
        .sort((a, b) => b.daysLate - a.daysLate),
    }
  }

  // ─── Customer risk (#18) ─────────────────────────────────────

  /**
   * How one customer has actually paid, and what that says.
   *
   * «Settled on» is the day of the LAST allocation on an invoice with nothing
   * left to pay. An invoice that is not fully paid has no settle date — it is
   * not «late so far», it is unsettled, and the domain treats the two apart.
   */
  async customerRisk(ctx: TenancyContext, customerId: string): Promise<CustomerAssessment> {
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', customerId)
      .maybeSingle()
    if (customerError) throw new DatabaseError('Failed to read the customer', customerError)
    if (!customer) throw new NotFoundError('Customer')

    const { data, error } = await selectAllPages<
      OutstandingRow,
      { message: string; code?: string }
    >((from, to) =>
      supabase
        .from('invoice_outstanding')
        .select(
          'invoice_id, invoice_number, total, allocated, outstanding, due_date, invoice_date, customer_id, currency',
        )
        .eq('workspace_id', ctx.workspaceId)
        .eq('type', 'sale')
        .eq('customer_id', customerId)
        .order('invoice_id', { ascending: true })
        .range(from, to),
    )
    if (error) throw new DatabaseError('Failed to read the customer invoices', error)

    const rows = data ?? []
    const settledIds = rows
      .filter((row) => toMinor(row.outstanding) <= 0 && toMinor(row.total) > 0)
      .map((row) => row.invoice_id)
    const settledOn = await this.lastAllocationDay(ctx.workspaceId, settledIds)

    const payments: PaymentBehaviour[] = rows.map((row) => ({
      invoiceId: row.invoice_id,
      issuedOn: day(row.invoice_date),
      dueOn: day(row.due_date) || day(row.invoice_date),
      settledOn: settledOn.get(row.invoice_id) ?? null,
      amountMinor: toMinor(row.total),
      outstandingMinor: Math.max(0, toMinor(row.outstanding)),
    }))

    const asOf = today()
    const risk = customerRisk({
      customerId,
      payments,
      // Not read here: the credit limit lives in the customer-profile core, and
      // null means «no limit known» to the domain — it never means zero.
      creditLimitMinor: null,
      asOf,
    })

    return { ...risk, ...this.buyingPattern(customerId, rows, asOf) }
  }

  /**
   * How this customer has been BUYING (#108 health, #109 loyalty) — a reading of
   * the same invoices, not a points scheme: nothing accrues and nothing can be
   * redeemed.
   *
   * ⚠️ The spend trend is taken in ONE currency — the one most of the
   * customer's invoices are in — and that currency is named in the answer.
   * Months with no purchase are in the series as zero: a customer who stopped
   * buying must read as shrinking, not as «steady over the months they bought».
   */
  private buyingPattern(
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

  /** invoiceId → the day its last payment was allocated. */
  private async lastAllocationDay(
    workspaceId: string,
    invoiceIds: readonly string[],
  ): Promise<Map<string, string>> {
    const latest = new Map<string, string>()
    const CHUNK = 200
    for (let index = 0; index < invoiceIds.length; index += CHUNK) {
      const chunk = invoiceIds.slice(index, index + CHUNK)
      const { data, error } = await selectAllPages<
        { invoice_id: string; created_at: string },
        { message: string; code?: string }
      >((from, to) =>
        supabase
          .from('payment_allocations')
          .select('invoice_id, created_at')
          .eq('workspace_id', workspaceId)
          .in('invoice_id', chunk)
          .order('created_at', { ascending: true })
          .range(from, to),
      )
      if (error) throw new DatabaseError('Failed to read payment allocations', error)
      // Ascending, so the last write per invoice wins.
      for (const row of data ?? []) latest.set(row.invoice_id, day(row.created_at))
    }
    return latest
  }

  // ─── Suppliers (#10 #15 #19) ─────────────────────────────────

  /**
   * Each supplier's punctuality and price, and where the spend is concentrated.
   *
   * ⚠️ «LATE» IS MEASURED AGAINST THE PROMISED DATE. The domain compares the
   * received date with the date it is given; handing it the ORDER date would
   * turn every normal lead time into lateness. So only orders that carry an
   * expected delivery date are scored for punctuality — the rest still count
   * towards spend and concentration, and their number is reported.
   *
   * ⚠️ `received_at` IS TRUSTED ONLY ON A RECEIVED ORDER. The column defaults
   * to now(), so an order that never arrived carries a «received» timestamp
   * from the moment it was created.
   */
  async suppliers(ctx: TenancyContext): Promise<SupplierAnalysis> {
    const asOf = today()

    const { data: suppliers, error: supplierError } = await selectAllPages<
      { id: string; name: string; is_active: boolean | null },
      { message: string; code?: string }
    >((from, to) =>
      supabase
        .from('suppliers')
        .select('id, name, is_active')
        .eq('workspace_id', ctx.workspaceId)
        .order('id', { ascending: true })
        .range(from, to),
    )
    if (supplierError) throw new DatabaseError('Failed to read suppliers', supplierError)

    const { data: orders, error: orderError } = await selectAllPages<
      {
        id: string
        supplier_id: string | null
        order_date: string | null
        expected_delivery_date: string | null
        status: string | null
        received_at: string | null
      },
      { message: string; code?: string }
    >((from, to) =>
      supabase
        .from('purchase_orders')
        .select('id, supplier_id, order_date, expected_delivery_date, status, received_at')
        .eq('workspace_id', ctx.workspaceId)
        .order('id', { ascending: true })
        .range(from, to),
    )
    if (orderError) throw new DatabaseError('Failed to read purchase orders', orderError)

    const live = (orders ?? []).filter((order) => order.supplier_id && order.status !== 'cancelled')
    const items = await this.orderItems(
      ctx.workspaceId,
      live.map((order) => order.id),
    )

    const all: PurchaseRecord[] = []
    const scorable: PurchaseRecord[] = []
    let withoutPromise = 0

    for (const order of live) {
      const promised = day(order.expected_delivery_date)
      const received = order.status === 'received' ? day(order.received_at) || null : null
      if (!promised) withoutPromise += 1

      for (const item of items.get(order.id) ?? []) {
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

    const facts = (suppliers ?? []).map((supplier) => ({
      supplierId: supplier.id,
      name: supplier.name,
      active: supplier.is_active !== false,
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

  private async orderItems(workspaceId: string, orderIds: readonly string[]) {
    const byOrder = new Map<
      string,
      Array<{ product_id: string; quantity: number | string; total_price: number | string }>
    >()
    const CHUNK = 200
    for (let index = 0; index < orderIds.length; index += CHUNK) {
      const chunk = orderIds.slice(index, index + CHUNK)
      const { data, error } = await selectAllPages<
        {
          purchase_order_id: string
          product_id: string
          quantity: number | string
          total_price: number | string
        },
        { message: string; code?: string }
      >((from, to) =>
        supabase
          .from('purchase_order_items')
          .select('purchase_order_id, product_id, quantity, total_price')
          .eq('workspace_id', workspaceId)
          .in('purchase_order_id', chunk)
          .order('id', { ascending: true })
          .range(from, to),
      )
      if (error) throw new DatabaseError('Failed to read purchase order lines', error)
      for (const row of data ?? []) {
        byOrder.set(row.purchase_order_id, [...(byOrder.get(row.purchase_order_id) ?? []), row])
      }
    }
    return byOrder
  }

  // ─── Break-even (#133) ───────────────────────────────────────

  /**
   * How many units of each product cover the fixed costs of the period.
   *
   * The profit report is the accounting core's own (`getProfitReport`); fixed
   * costs are the salaries it already counts plus whatever the person states as
   * «other». With no other figure the result is a LOWER bound, and says so.
   */
  async breakEven(
    ctx: TenancyContext,
    input: { from: string; to: string; currency: string; otherFixedCosts: number | null },
  ): Promise<BreakEvenResult & { from: string; to: string; currency: string }> {
    const report = await this.accounting.getProfitReport(ctx, input.from, input.to, input.currency)
    const result = breakEven(report, {
      salaries: report.totals.salaries,
      other: input.otherFixedCosts,
    })
    return { ...result, from: report.from, to: report.to, currency: report.currency }
  }

  // ─── Working capital (#38) ───────────────────────────────────

  /**
   * How many days of trading are tied up in customer debts, stock and supplier
   * debts — for ONE currency and one period.
   *
   * Every input is a figure the product already has: revenue and cost of goods
   * sold from the accounting core's profit report, receivables and payables
   * from `invoice_outstanding`, stock at cost from the costing core.
   *
   * ⚠️ CASH IS NOT AN INPUT. There is no single cash-and-bank balance to read,
   * so the quick ratio is not computed and is not in the answer — a ratio built
   * on an invented zero would say the business cannot pay its suppliers.
   *
   * ⚠️ Stock value is the costing core's whole valuation. It is stated only
   * when the workspace has stock at all; the client labels it as cost.
   */
  async workingCapital(
    ctx: TenancyContext,
    input: { from: string; to: string; currency: string },
  ): Promise<WorkingCapitalAnalysis> {
    const [report, sales, purchases, valuation] = await Promise.all([
      this.accounting.getProfitReport(ctx, input.from, input.to, input.currency),
      this.invoicesIn(ctx.workspaceId, 'sale', input.currency),
      this.invoicesIn(ctx.workspaceId, 'purchase', input.currency),
      costing.getValuation(ctx),
    ])

    const inRange = (row: OutstandingRow) => {
      const date = day(row.invoice_date)
      return date >= input.from && date <= input.to
    }
    const owed = (rows: OutstandingRow[]) =>
      rows.reduce((sum, row) => sum + Math.max(0, toMinor(row.outstanding)), 0)

    const receivablesMinor = owed(sales)
    const payablesMinor = owed(purchases)
    const purchasesMinor = purchases
      .filter(inRange)
      .reduce((sum, row) => sum + toMinor(row.total), 0)
    const inventoryMinor = valuation.reduce((sum, row) => sum + toMinor(row.value), 0)
    const daysInPeriod =
      Math.round(
        (Date.parse(`${input.to}T00:00:00Z`) - Date.parse(`${input.from}T00:00:00Z`)) / 86_400_000,
      ) + 1

    const metrics = workingCapital({
      revenueMinor: toMinor(report.totals.revenue),
      costOfGoodsSoldMinor: toMinor(report.totals.cost),
      purchasesMinor,
      receivablesMinor,
      payablesMinor,
      inventoryMinor,
      cashMinor: 0,
      daysInPeriod,
    })

    return {
      from: input.from,
      to: input.to,
      currency: input.currency,
      daysInPeriod,
      dso: metrics.dso,
      dpo: metrics.dpo,
      dio: metrics.dio,
      cashConversionCycle: metrics.cashConversionCycle,
      operatingCycle: metrics.operatingCycle,
      receivables: receivablesMinor / 100,
      payables: payablesMinor / 100,
      inventoryAtCost: inventoryMinor / 100,
      netWorkingCapital: metrics.netWorkingCapitalMinor / 100,
      revenue: report.totals.revenue,
      costOfGoodsSold: report.totals.cost,
      purchases: purchasesMinor / 100,
      otherCurrencies: report.otherCurrencies.map((other) => other.currency),
    }
  }

  private async invoicesIn(workspaceId: string, type: 'sale' | 'purchase', currency: string) {
    const { data, error } = await selectAllPages<
      OutstandingRow,
      { message: string; code?: string }
    >((from, to) =>
      supabase
        .from('invoice_outstanding')
        .select(
          'invoice_id, invoice_number, total, allocated, outstanding, due_date, invoice_date, customer_id, currency',
        )
        .eq('workspace_id', workspaceId)
        .eq('type', type)
        .eq('currency', currency)
        .order('invoice_id', { ascending: true })
        .range(from, to),
    )
    if (error) throw new DatabaseError('Failed to read invoices for working capital', error)
    return data ?? []
  }

  // ─── Cohorts (#130) ──────────────────────────────────────────

  /** Customers grouped by the month of their first purchase, and who came back. */
  async cohorts(ctx: TenancyContext): Promise<{ asOf: string; cohorts: CohortRow[] }> {
    const asOf = today()
    const { data, error } = await selectAllPages<
      OutstandingRow,
      { message: string; code?: string }
    >((from, to) =>
      supabase
        .from('invoice_outstanding')
        .select(
          'invoice_id, invoice_number, total, allocated, outstanding, due_date, invoice_date, customer_id',
        )
        .eq('workspace_id', ctx.workspaceId)
        .eq('type', 'sale')
        .not('customer_id', 'is', null)
        .order('invoice_id', { ascending: true })
        .range(from, to),
    )
    if (error) throw new DatabaseError('Failed to read sales for cohorts', error)

    const customerOf = new Map<string, string | null>()
    const invoices: OpenInvoice[] = (data ?? []).map((row) => {
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

  private async customerNames(workspaceId: string, ids: readonly string[]) {
    const unique = [...new Set(ids)]
    const names = new Map<string, string>()
    const CHUNK = 200
    for (let index = 0; index < unique.length; index += CHUNK) {
      const { data, error } = await supabase
        .from('customers')
        .select('id, full_name')
        // The workspace filter is re-applied here: these ids came from a view,
        // and a name must never be read across the tenancy boundary.
        .eq('workspace_id', workspaceId)
        .in('id', unique.slice(index, index + CHUNK))
      if (error) throw new DatabaseError('Failed to read customer names', error)
      for (const row of data ?? []) names.set(row.id as string, row.full_name as string)
    }
    return names
  }
}

export const analysisService = new AnalysisService()
