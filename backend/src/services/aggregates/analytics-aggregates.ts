// ============================================
// backend/src/services/aggregates/analytics-aggregates.ts
//
// Database-side aggregates for the dashboard, the sales summary, the
// inventory summary and the invoice-list summary.
// SQL: docs/perf-aggregates-analytics-migration.sql (v1) and
//      docs/dashboard-fx-01-migration.sql (v2: in the books currency).
//
// ⚠️ v2 FIRST. v1 adds every invoice's `total` as it is, whatever currency it
// is in — a 2,307,692.3 USD sale was «2.3 million» on the 7-day chart (owner,
// 18 Oct 2026). v2 converts each invoice at its own frozen rate and COUNTS
// the ones it cannot convert (another currency, no rate). v1 is read only
// while v2 is not installed — the headline then stays books-currency-only.
//
// Each `fetch…` returns `null` ONLY when the function is not installed — the
// caller then runs its original row-by-row path. Each `…FromAggregate` maps
// the jsonb onto EXACTLY the response shape that path returns, so no client
// changes.
// ============================================

import { z } from 'zod'

import { round2 } from '../accounting/accounting.domain'
import type { CurrencyBucket } from '../analytics.service'
import { callAggregate } from './aggregate-rpc'

/** Month-over-month growth, one decimal. Shared by both paths. */
export function growthPercent(current: number, previous: number): number {
  if (previous > 0) return Math.round(((current - previous) / previous) * 1000) / 10
  return current > 0 ? 100 : 0
}

// ─── Dashboard KPIs ─────────────────────────────────────────────────────────

const dashboardCurrencyRow = z.object({
  currency: z.string(),
  total_sales: z.number(),
  total_purchases: z.number(),
  customer_debt: z.number(),
  supplier_payable: z.number(),
  today_sales: z.number(),
  today_invoices: z.number(),
  monthly_revenue: z.number(),
  prev_month_revenue: z.number(),
  pending_payments: z.number(),
  pending_payments_count: z.number(),
  purchase_count: z.number(),
})

/** v2: every money figure in the books currency, at each invoice's own rate. */
const dashboardBooksRow = dashboardCurrencyRow.omit({ currency: true }).extend({
  unconverted_count: z.number(),
})

const dashboardSchema = z.object({
  currencies: z.array(dashboardCurrencyRow),
  books: dashboardBooksRow.optional(),
  active_customers: z.number(),
  low_stock_alerts: z.number(),
  warehouse_value: z.number(),
})

export type DashboardAggregate = z.infer<typeof dashboardSchema>

export async function fetchDashboardAggregate(
  workspaceId: string,
  todayStart: string,
  firstOfThisMonth: Date,
  firstOfPrevMonth: Date,
  booksCurrency: string,
): Promise<DashboardAggregate | null> {
  const args = {
    p_workspace_id: workspaceId,
    p_today_start: todayStart,
    p_month_start: firstOfThisMonth.toISOString(),
    p_prev_month_start: firstOfPrevMonth.toISOString(),
  }
  const converted = await callAggregate(
    'analytics_dashboard_kpis_v2',
    { ...args, p_books_currency: booksCurrency },
    dashboardSchema,
  )
  if (converted) return converted
  return callAggregate('analytics_dashboard_kpis', args, dashboardSchema)
}

/** Every dashboard field except `customerGrowth`, which the service adds. */
export function dashboardKpisFromAggregate(agg: DashboardAggregate, booksCurrency: string) {
  // ⚠️ THE HEADLINE IS THE BOOKS CURRENCY ONLY. It used to add every
  // currency's total together: a sale of 80 USD made «فروش کل» and «بدهی
  // مشتریان» 80 AFN higher on the live site (14 Oct). Other currencies stay
  // in `byCurrency`, said as what they are — never silently added in.
  const inBooks = agg.currencies.filter((row) => (row.currency || booksCurrency) === booksCurrency)
  const sum = (pick: (row: z.infer<typeof dashboardCurrencyRow>) => number) =>
    inBooks.reduce((total, row) => total + pick(row), 0)

  const byCurrency: Record<string, CurrencyBucket> = {}
  for (const row of agg.currencies) {
    byCurrency[row.currency] = {
      totalSales: row.total_sales,
      totalPurchases: row.total_purchases,
      customerDebt: row.customer_debt,
      supplierPayable: row.supplier_payable,
      todaySales: row.today_sales,
      monthlyRevenue: row.monthly_revenue,
      pendingPayments: row.pending_payments,
    }
  }
  const currencies = Object.keys(byCurrency)

  // v2: the headline is every invoice in the books currency, converted at its
  // own rate; the ones that could not be are counted, not added at 1.
  const books = agg.books
  if (books) {
    return {
      monthlyRevenue: round2(books.monthly_revenue),
      monthlyGrowth: growthPercent(books.monthly_revenue, books.prev_month_revenue),
      pendingPayments: round2(books.pending_payments),
      pendingPaymentsCount: books.pending_payments_count,
      activeCustomers: agg.active_customers,
      lowStockAlerts: agg.low_stock_alerts,
      byCurrency,
      currencies,
      mixedCurrency: currencies.length > 1,
      convertedToBooks: true,
      unconvertedInvoices: books.unconverted_count,
      totalSales: round2(books.total_sales),
      customerDebt: round2(books.customer_debt),
      warehouseValue: round2(agg.warehouse_value),
      todaySales: round2(books.today_sales),
      todayInvoices: books.today_invoices,
      totalPurchases: round2(books.total_purchases),
      supplierPayable: round2(books.supplier_payable),
      purchaseCount: books.purchase_count,
    }
  }

  const monthlyRevenue = sum((r) => r.monthly_revenue)

  return {
    monthlyRevenue: round2(monthlyRevenue),
    monthlyGrowth: growthPercent(
      monthlyRevenue,
      sum((r) => r.prev_month_revenue),
    ),
    pendingPayments: round2(sum((r) => r.pending_payments)),
    pendingPaymentsCount: sum((r) => r.pending_payments_count),
    activeCustomers: agg.active_customers,
    lowStockAlerts: agg.low_stock_alerts,
    byCurrency,
    currencies,
    mixedCurrency: currencies.length > 1,
    convertedToBooks: false,
    unconvertedInvoices: 0,
    totalSales: round2(sum((r) => r.total_sales)),
    customerDebt: round2(sum((r) => r.customer_debt)),
    warehouseValue: round2(agg.warehouse_value),
    todaySales: round2(sum((r) => r.today_sales)),
    todayInvoices: sum((r) => r.today_invoices),
    totalPurchases: round2(sum((r) => r.total_purchases)),
    supplierPayable: round2(sum((r) => r.supplier_payable)),
    purchaseCount: sum((r) => r.purchase_count),
  }
}

// ─── Sales summary ──────────────────────────────────────────────────────────

const salesSchema = z.object({
  total_invoices: z.number(),
  /** v2 only: invoices in another currency with no rate, left out. */
  unconverted_count: z.number().optional(),
  total_revenue: z.number(),
  total_paid: z.number(),
  by_currency: z.record(z.number()),
  by_period: z.array(z.object({ period: z.string(), revenue: z.number(), count: z.number() })),
  top_customers: z.array(
    z.object({
      customer_id: z.string(),
      customer_name: z.string(),
      revenue: z.number(),
      invoice_count: z.number(),
    }),
  ),
  top_items: z.array(
    z.object({
      product_id: z.string().nullable(),
      product_name: z.string(),
      total_price: z.number(),
    }),
  ),
  chart: z.array(
    z.object({
      day: z.string(),
      value: z.number(),
      invoice_count: z.number(),
      customer_count: z.number(),
    }),
  ),
})

export type SalesAggregate = z.infer<typeof salesSchema>

export async function fetchSalesAggregate(
  workspaceId: string,
  startDate: string,
  endExclusive: string,
  chartFrom: Date,
  booksCurrency: string,
): Promise<SalesAggregate | null> {
  const args = {
    p_workspace_id: workspaceId,
    p_start: startDate,
    p_end_exclusive: endExclusive,
    p_chart_from: chartFrom.toISOString(),
  }
  const converted = await callAggregate(
    'analytics_sales_summary_v2',
    { ...args, p_books_currency: booksCurrency },
    salesSchema,
  )
  if (converted) return converted
  return callAggregate('analytics_sales_summary', args, salesSchema)
}

/** Only for a non-empty aggregate — the empty case keeps its own diagnostic path. */
export function salesSummaryFromAggregate(agg: SalesAggregate) {
  return {
    totalRevenue: round2(agg.total_revenue),
    totalInvoices: agg.total_invoices,
    averageInvoiceValue: round2(agg.total_revenue / agg.total_invoices),
    totalPaid: round2(agg.total_paid),
    totalUnpaid: round2(agg.total_revenue - agg.total_paid),
    byCurrency: agg.by_currency,
    convertedToBooks: agg.unconverted_count !== undefined,
    unconvertedInvoices: agg.unconverted_count ?? 0,
    byPeriod: agg.by_period.map((p) => ({
      period: p.period,
      revenue: round2(p.revenue),
      count: p.count,
    })),
    topProducts: agg.top_items.map((p) => ({
      productId: p.product_id,
      productName: p.product_name,
      quantity: 0,
      revenue: round2(p.total_price),
    })),
    topCustomers: agg.top_customers.map((c) => ({
      customerId: c.customer_id,
      customerName: c.customer_name,
      revenue: round2(c.revenue),
      invoiceCount: c.invoice_count,
    })),
    chartData: agg.chart.map((d) => ({
      label: d.day,
      value: d.value,
      date: d.day,
      invoiceCount: d.invoice_count,
      customerCount: d.customer_count,
    })),
  }
}

// ─── Inventory summary ──────────────────────────────────────────────────────

const inventorySchema = z.object({
  total_products: z.number(),
  total_stock_value: z.number(),
  low_stock_products: z.number(),
  out_of_stock_products: z.number(),
  by_category: z.array(
    z.object({ category: z.string(), count: z.number(), total_value: z.number() }),
  ),
})

export type InventoryAggregate = z.infer<typeof inventorySchema>

export function fetchInventoryAggregate(workspaceId: string): Promise<InventoryAggregate | null> {
  return callAggregate(
    'analytics_inventory_summary',
    { p_workspace_id: workspaceId },
    inventorySchema,
  )
}

/** Every inventory field except `topMovements`, which the service reads. */
export function inventoryFiguresFromAggregate(agg: InventoryAggregate) {
  return {
    totalProducts: agg.total_products,
    totalStockValue: round2(agg.total_stock_value),
    lowStockProducts: agg.low_stock_products,
    outOfStockProducts: agg.out_of_stock_products,
    byCategory: agg.by_category.map((c) => ({
      category: c.category,
      count: c.count,
      totalValue: round2(c.total_value),
    })),
  }
}

// ─── Invoice-list summary ───────────────────────────────────────────────────

const invoiceSummarySchema = z.object({
  today_sales: z.number(),
  today_purchases: z.number(),
  total_debt: z.number(),
  total_payable: z.number(),
  low_stock_count: z.number(),
})

export async function fetchInvoiceSummaryAggregate(
  workspaceId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<{
  todaySales: number
  totalDebt: number
  lowStockCount: number
  todayPurchases: number
  totalPayable: number
} | null> {
  const agg = await callAggregate(
    'invoices_summary_kpis',
    {
      p_workspace_id: workspaceId,
      p_day_start: dayStart.toISOString(),
      p_day_end: dayEnd.toISOString(),
    },
    invoiceSummarySchema,
  )
  if (!agg) return null
  return {
    todaySales: agg.today_sales,
    totalDebt: agg.total_debt,
    lowStockCount: agg.low_stock_count,
    todayPurchases: agg.today_purchases,
    totalPayable: agg.total_payable,
  }
}
