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

import {
  breakEvenAnalysis,
  cohortReport,
  collectionsWorklist,
  customerAssessment,
  settledInvoiceIds,
  supplierAnalysis,
  withCustomerNames,
  workingCapitalAnalysis,
  type CollectionsWorklist,
  type CustomerAssessment,
  type OutstandingRow,
  type SupplierAnalysis,
  type SupplierOrderItemRow,
  type WorkingCapitalAnalysis,
} from '@hisabche/validation'

import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import { AccountingService } from '../accounting'
import type { BreakEvenResult } from '../analytics/break-even.domain'
import type { CohortRow } from '../analytics/cohort.domain'
import { costing } from '../inventory-costing'
import type { TenancyContext } from '../tenancy.service'

export type { CollectionsWorklist, CustomerAssessment, SupplierAnalysis, WorkingCapitalAnalysis }

const toMinor = (major: unknown) => Math.round((Number(major) || 0) * 100)
const day = (value: unknown) => String(value ?? '').slice(0, 10)
const today = () => new Date().toISOString().slice(0, 10)

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

    const base = collectionsWorklist(data ?? [], asOf)
    const names = await this.customerNames(
      ctx.workspaceId,
      base.actions.map((action) => action.customerId).filter((id): id is string => !!id),
    )
    return withCustomerNames(base, names)
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
    const settledOn = await this.lastAllocationDay(ctx.workspaceId, settledInvoiceIds(rows))
    return customerAssessment({ customerId, rows, settledOn, asOf: today() })
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

    return supplierAnalysis({
      asOf,
      suppliers: suppliers ?? [],
      orders: orders ?? [],
      items,
    })
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
    return breakEvenAnalysis(report, input.otherFixedCosts)
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

    return workingCapitalAnalysis({
      from: input.from,
      to: input.to,
      currency: input.currency,
      report,
      sales,
      purchases,
      inventoryMinor: valuation.reduce((sum, row) => sum + toMinor(row.value), 0),
    })
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

    return cohortReport(data ?? [], asOf)
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
