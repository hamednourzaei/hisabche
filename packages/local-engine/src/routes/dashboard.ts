// ============================================
// packages/local-engine/src/routes/dashboard.ts
//
// Dashboard KPIs and sales analytics computed from local SQLite tables.
// Follows the same decomposition rules and response shapes as analytics.service.ts.
// ============================================

import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface InvoiceKpiRow {
  total: number
  paid_amount: number
  status: string
  date: string
  type: string
  currency: string
}

interface ProductKpiRow {
  buy_price: number
  quantity: number
  min_stock_level: number
}

interface CurrencyBucket {
  totalSales: number
  totalPurchases: number
  customerDebt: number
  supplierPayable: number
  todaySales: number
  monthlyRevenue: number
  pendingPayments: number
}

function emptyBucket(): CurrencyBucket {
  return {
    totalSales: 0,
    totalPurchases: 0,
    customerDebt: 0,
    supplierPayable: 0,
    todaySales: 0,
    monthlyRevenue: 0,
    pendingPayments: 0,
  }
}

function isOutstanding(status: string): boolean {
  return ['draft', 'issued', 'sent', 'partially_paid', 'unpaid', 'overdue'].includes(status)
}

export function registerDashboardRoutes(router: Router): void {
  // ─── GET /analytics/dashboard ────────────────────────────────
  router.get('/analytics/dashboard', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const ws = ctx.workspaceId
    const booksCurrency = ctx.baseCurrency

    const products = db.all<ProductKpiRow>(
      'SELECT buy_price, quantity, min_stock_level FROM product WHERE workspace_id = ? AND deleted_at IS NULL AND is_active = 1',
      [ws],
    )

    const lowStockAlerts = products.filter(
      (p) => Number(p.quantity) <= Number(p.min_stock_level),
    ).length
    const warehouseValue = products.reduce(
      (sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.buy_price) || 0),
      0,
    )

    const custCount = db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM customer WHERE workspace_id = ? AND deleted_at IS NULL AND is_active = 1',
      [ws],
    )
    const activeCustomers = custCount?.count ?? 0

    const invoices = db.all<InvoiceKpiRow>(
      'SELECT total, paid_amount, status, date, type, currency FROM invoice WHERE workspace_id = ? AND deleted_at IS NULL',
      [ws],
    )

    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const firstOfMonthStr = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10)

    const byCurrency: Record<string, CurrencyBucket> = {}

    let todaySales = 0
    let todayInvoices = 0
    let monthlyRevenue = 0
    let pendingPayments = 0
    let pendingPaymentsCount = 0
    let totalSales = 0
    let customerDebt = 0

    for (const inv of invoices) {
      const code = inv.currency || booksCurrency
      if (!byCurrency[code]) {
        byCurrency[code] = emptyBucket()
      }
      const b = byCurrency[code]!

      const isPurchase = inv.type === 'purchase'
      const total = Number(inv.total) || 0
      const paid = Number(inv.paid_amount) || 0
      const invDate = String(inv.date || '').slice(0, 10)
      const outstanding = isOutstanding(inv.status)
      const debt = outstanding ? Math.max(0, total - paid) : 0

      if (isPurchase) {
        b.totalPurchases += total
        b.supplierPayable += debt
      } else {
        b.totalSales += total
        b.customerDebt += debt
        b.pendingPayments += debt

        if (invDate >= todayStr) {
          b.todaySales += total
        }
        if (invDate >= firstOfMonthStr) {
          b.monthlyRevenue += total
        }

        // Headline figures for base books currency
        if (code === booksCurrency) {
          totalSales += total
          customerDebt += debt
          if (debt > 0) {
            pendingPayments += debt
            pendingPaymentsCount += 1
          }
          if (invDate >= todayStr) {
            todaySales += total
            todayInvoices += 1
          }
          if (invDate >= firstOfMonthStr) {
            monthlyRevenue += total
          }
        }
      }
    }

    // Ensure booksCurrency is present in byCurrency
    if (!byCurrency[booksCurrency]) {
      byCurrency[booksCurrency] = emptyBucket()
    }

    return {
      todaySales,
      todayInvoices,
      monthlyRevenue,
      monthlyGrowth: 0,
      pendingPayments,
      pendingPaymentsCount,
      activeCustomers,
      customerGrowth: 0,
      lowStockAlerts,
      totalSales,
      customerDebt,
      warehouseValue,
      byCurrency,
    }
  })

  // ─── GET /analytics/sales ────────────────────────────────────
  router.get('/analytics/sales', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const ws = ctx.workspaceId
    const booksCurrency = ctx.baseCurrency

    const invoices = db.all<InvoiceKpiRow>(
      "SELECT total, paid_amount, status, date, type, currency FROM invoice WHERE workspace_id = ? AND deleted_at IS NULL AND type = 'sale' ORDER BY date ASC",
      [ws],
    )

    let totalRevenue = 0
    let totalInvoices = 0
    let totalPaid = 0
    const byCurrency: Record<string, number> = {}

    // Grouping by date for chartData
    const dateMap = new Map<string, { value: number; count: number }>()

    for (const inv of invoices) {
      const code = inv.currency || booksCurrency
      const total = Number(inv.total) || 0
      const paid = Number(inv.paid_amount) || 0
      const d = String(inv.date || '').slice(0, 10)

      byCurrency[code] = (byCurrency[code] || 0) + total

      if (code === booksCurrency) {
        totalRevenue += total
        totalInvoices += 1
        totalPaid += paid

        const entry = dateMap.get(d) || { value: 0, count: 0 }
        entry.value += total
        entry.count += 1
        dateMap.set(d, entry)
      }
    }

    const chartData = Array.from(dateMap.entries()).map(([date, data]) => ({
      label: date,
      date,
      value: data.value,
      invoiceCount: data.count,
      customerCount: data.count,
    }))

    return {
      totalRevenue,
      totalInvoices,
      averageInvoiceValue: totalInvoices > 0 ? Math.round(totalRevenue / totalInvoices) : 0,
      totalPaid,
      totalUnpaid: Math.max(0, totalRevenue - totalPaid),
      byCurrency,
      convertedToBooks: false,
      unconvertedInvoices: 0,
      byPeriod: [],
      topProducts: [],
      topCustomers: [],
      chartData,
    }
  })
}
