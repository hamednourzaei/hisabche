// ============================================
// packages/local-engine/src/routes/dashboard.ts
//
// Dashboard KPIs and sales analytics computed from local SQLite tables.
// Follows the same decomposition rules and response shapes as analytics.service.ts.
// ============================================

import {
  grantStatusesFromRows,
  round2,
  type LedgerAllocationFact,
  type PackageLedgerRowFact,
} from '@hisabche/validation'

import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

function parseAttributes(raw: unknown): Array<{ name: string; value: string }> {
  let list: unknown = raw
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(list)) return []
  return list
    .filter(
      (entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null,
    )
    .map((entry) => ({ name: String(entry.name ?? ''), value: String(entry.value ?? '') }))
}

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
      // V53 OD-3: a sale the server refused for credit (or refused again after an approver's attempt) is not a
      // final sale. It stays visible on the invoice list, but it is not revenue, not a receivable and not
      // «today's sales» until the server accepts it.
      `SELECT total, paid_amount, status, date, type, currency FROM invoice
       WHERE workspace_id = ? AND deleted_at IS NULL
         AND (credit_status IS NULL OR credit_status = 'validated')`,
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
      // Same rule as the dashboard: an unapproved credit sale is not revenue yet (V53 OD-3).
      `SELECT total, paid_amount, status, date, type, currency FROM invoice
       WHERE workspace_id = ? AND deleted_at IS NULL AND type = 'sale'
         AND (credit_status IS NULL OR credit_status = 'validated')
       ORDER BY date ASC`,
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
      // ⚠️ The rounding is the shared money rule, not a local one.
      averageInvoiceValue: totalInvoices > 0 ? round2(totalRevenue / totalInvoices) : 0,
      totalPaid,
      totalUnpaid: Math.max(0, totalRevenue - totalPaid),
      byCurrency,
      // D10: sales the device wrote and the server has not seen yet. They are
      // already in these books — the local engine wrote them — so the KPI
      // counts them; this number is what the label beside it says out loud.
      pendingInvoiceCount:
        db.get<{ count: number }>(
          `SELECT COUNT(*) AS count FROM sync_queue
           WHERE entity = 'invoice' AND operation = 'create' AND workspace_id = ?`,
          [ws],
        )?.count ?? 0,
      convertedToBooks: false,
      unconvertedInvoices: 0,
      byPeriod: [],
      topProducts: [],
      topCustomers: [],
      chartData,
    }
  })

  // ─── GET /analytics/dashboard/low-stock-variants ─────────────
  router.get('/analytics/dashboard/low-stock-variants', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const rows = db.all<{
      id: string
      template_product_id: string
      sku: string
      attributes: string
      product_name: string | null
      min_stock_level: number | null
      current_stock: number | null
    }>(
      `SELECT v.id, v.template_product_id, v.sku, v.attributes,
              p.name AS product_name,
              p.min_stock_level AS min_stock_level,
              COALESCE((
                SELECT SUM(m.quantity) FROM inventory_movement m
                WHERE m.workspace_id = v.workspace_id AND m.variant_id = v.id
                  AND m.deleted_at IS NULL
              ), 0) AS current_stock
       FROM product_variants v
       LEFT JOIN product p ON p.id = v.template_product_id AND p.workspace_id = v.workspace_id
       WHERE v.workspace_id = ? AND v.is_active = 1 AND v.deleted_at IS NULL`,
      [ctx.workspaceId],
    )
    const items = rows
      .filter(
        (v) => (v.min_stock_level ?? 0) > 0 && (v.current_stock ?? 0) <= (v.min_stock_level ?? 0),
      )
      .map((v) => ({
        variantId: v.id,
        templateProductId: v.template_product_id,
        productName: v.product_name ?? '',
        sku: v.sku,
        attributes: parseAttributes(v.attributes),
        currentStock: v.current_stock ?? 0,
        minStock: v.min_stock_level ?? 0,
      }))
      .sort((a, b) => a.currentStock - b.currentStock)
    return {
      items,
      totalLowStock: items.length,
      variantsCount: rows.length,
      hidden: false,
      unavailable: false,
    }
  })

  // ─── GET /analytics/dashboard/today-sessions ─────────────────
  router.get('/analytics/dashboard/today-sessions', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const today = new Date().toISOString().slice(0, 10)
    const rows = db.all<{
      id: string
      customer_id: string
      customer_name: string
      service_offering_id: string
      service_name: string
      practitioner_id: string | null
      practitioner_name: string
      status: string
      start_time: string | null
      end_time: string | null
      settlement_method: string
    }>(
      `SELECT s.id, s.customer_id, COALESCE(c.full_name, '') AS customer_name,
              s.service_offering_id, COALESCE(p.name, '') AS service_name,
              s.practitioner_id, COALESCE(e.full_name, '') AS practitioner_name,
              s.status, s.start_time, s.end_time, s.settlement_method
       FROM service_delivery_sessions s
       LEFT JOIN customer c ON c.id = s.customer_id AND c.workspace_id = s.workspace_id
       LEFT JOIN product p ON p.id = s.service_offering_id AND p.workspace_id = s.workspace_id
       LEFT JOIN employee e ON e.id = s.practitioner_id AND e.workspace_id = s.workspace_id
       WHERE s.workspace_id = ? AND s.session_date = ? AND s.deleted_at IS NULL
       ORDER BY s.start_time ASC`,
      [ctx.workspaceId, today],
    )
    const byStatus: Record<string, number> = {}
    const byPractitioner: Record<string, number> = {}
    for (const s of rows) {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1
      if (s.practitioner_id) {
        byPractitioner[s.practitioner_id] = (byPractitioner[s.practitioner_id] || 0) + 1
      }
    }
    const deposits = db.all<{ currency: string; amount: number }>(
      `SELECT COALESCE(currency, ?) AS currency, SUM(amount_minor) AS amount
       FROM order_deposits
       WHERE workspace_id = ? AND applied_invoice_id IS NULL AND deleted_at IS NULL
       GROUP BY COALESCE(currency, ?)`,
      [ctx.baseCurrency, ctx.workspaceId, ctx.baseCurrency],
    )
    return {
      date: today,
      sessions: rows.map((s) => ({
        id: s.id,
        customerId: s.customer_id,
        customerName: s.customer_name,
        serviceId: s.service_offering_id,
        serviceName: s.service_name,
        practitionerId: s.practitioner_id,
        practitionerName: s.practitioner_id ? s.practitioner_name : null,
        status: s.status,
        time: s.start_time ?? '',
        endTime: s.end_time ?? '',
        settlementMethod: s.settlement_method,
      })),
      byStatus,
      byPractitioner,
      totalSessions: rows.length,
      depositsHeld: deposits
        .map((row) => ({ currency: row.currency, amountMinor: row.amount ?? 0 }))
        .sort((a, b) => (a.currency < b.currency ? -1 : 1)),
      hidden: false,
      unavailable: false,
    }
  })

  // ─── GET /analytics/dashboard/package-credits-low ────────────
  router.get('/analytics/dashboard/package-credits-low', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const today = new Date().toISOString().slice(0, 10)
    const rows = db.all<{
      id: string
      customer_id: string
      customer_name: string
      package_product_id: string
      package_name: string
      entry_type: string
      quantity: number
      reference_entry_id: string | null
      effective_date: string
      deferred_amount: number | null
      term_months: number | null
    }>(
      `SELECT l.id, l.customer_id, COALESCE(c.full_name, '') AS customer_name,
              l.package_product_id, COALESCE(p.name, '') AS package_name,
              l.entry_type, l.quantity, l.reference_entry_id, l.effective_date,
              l.deferred_amount, l.term_months
       FROM package_credit_ledger l
       LEFT JOIN customer c ON c.id = l.customer_id AND c.workspace_id = l.workspace_id
       LEFT JOIN product p ON p.id = l.package_product_id AND p.workspace_id = l.workspace_id
       WHERE l.workspace_id = ? AND l.deleted_at IS NULL`,
      [ctx.workspaceId],
    )
    const allocationRows = db.all<{
      entry_id: string
      grant_entry_id: string | null
      kind: 'CONSUME' | 'REVERSAL'
      quantity: number
      released_amount: number
      effective_date: string
    }>(
      `SELECT entry_id, grant_entry_id, kind, quantity, released_amount, effective_date
       FROM package_credit_allocations WHERE workspace_id = ?`,
      [ctx.workspaceId],
    )
    const allocations: LedgerAllocationFact[] = allocationRows.map((row) => ({
      entryId: row.entry_id,
      grantId: row.grant_entry_id,
      kind: row.kind,
      quantity: row.quantity,
      releasedAmount: row.released_amount,
      effectiveDate: row.effective_date,
    }))

    const groups = new Map<
      string,
      {
        customerId: string
        customerName: string
        packageProductId: string
        packageName: string
        facts: PackageLedgerRowFact[]
      }
    >()
    for (const row of rows) {
      const key = `${row.customer_id}::${row.package_product_id}`
      const fact: PackageLedgerRowFact = {
        id: row.id,
        entryType: row.entry_type,
        quantity: Number(row.quantity),
        referenceEntryId: row.reference_entry_id,
        effectiveDate: row.effective_date,
        deferredAmount: row.deferred_amount == null ? null : Number(row.deferred_amount),
        termMonths: row.term_months ?? null,
      }
      const group = groups.get(key)
      if (group) group.facts.push(fact)
      else
        groups.set(key, {
          customerId: row.customer_id,
          customerName: row.customer_name,
          packageProductId: row.package_product_id,
          packageName: row.package_name,
          facts: [fact],
        })
    }

    const items: Array<{
      customerId: string
      customerName: string
      packageProductId: string
      packageName: string
      totalCredits: number
      remainingCredits: number
    }> = []

    for (const group of groups.values()) {
      // ⚠️ The allocation arithmetic lives in ONE place: the shared rule the server reads too.
      const statuses = grantStatusesFromRows({
        rows: group.facts,
        allocations,
        // Suspension changes usability, not what is left.
        suspensions: [],
        today,
      })
      if (statuses.length === 0) continue
      const remainingCredits = statuses.reduce((sum, status) => sum + status.remaining, 0)
      if (remainingCredits > 2) continue
      const totalCredits =
        group.facts
          .filter((row) => row.entryType === 'GRANT')
          .reduce((sum, row) => sum + row.quantity, 0) +
        group.facts
          .filter((row) => row.entryType === 'ADJUSTMENT' && row.referenceEntryId)
          .reduce((sum, row) => sum + row.quantity, 0)
      items.push({
        customerId: group.customerId,
        customerName: group.customerName,
        packageProductId: group.packageProductId,
        packageName: group.packageName,
        totalCredits,
        remainingCredits,
      })
    }

    items.sort((a, b) => a.remainingCredits - b.remainingCredits)
    return {
      items,
      lowCount: items.length,
      // No GRANT row at all ≠ every package healthy.
      packagesCount: rows.filter((row) => row.entry_type === 'GRANT').length,
      hidden: false,
      unavailable: false,
    }
  })

  // ─── GET /analytics/dashboard/open-repair-tickets ────────────
  router.get('/analytics/dashboard/open-repair-tickets', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const rows = db.all<{
      id: string
      number: number
      customer_id: string
      customer_name: string
      device_label: string
      problem: string
      status: string
      technician_employee_id: string | null
      technician_name: string
      created_at: string
    }>(
      `SELECT t.id, t.number, t.customer_id, COALESCE(c.full_name, '') AS customer_name,
              t.device_label, t.problem, t.status, t.technician_employee_id,
              COALESCE(e.full_name, '') AS technician_name, t.created_at
       FROM repair_tickets t
       LEFT JOIN customer c ON c.id = t.customer_id AND c.workspace_id = t.workspace_id
       LEFT JOIN employee e ON e.id = t.technician_employee_id AND e.workspace_id = t.workspace_id
       WHERE t.workspace_id = ? AND t.status NOT IN ('delivered', 'cancelled')
       ORDER BY t.created_at ASC`,
      [ctx.workspaceId],
    )
    const byStatus: Record<string, number> = {}
    for (const t of rows) byStatus[t.status] = (byStatus[t.status] || 0) + 1
    // Every ticket the shop ever wrote, so the empty card says «none yet».
    const totalTickets =
      db.get<{ count: number }>(
        'SELECT COUNT(*) AS count FROM repair_tickets WHERE workspace_id = ?',
        [ctx.workspaceId],
      )?.count ?? 0
    return {
      items: rows.map((t) => ({
        id: t.id,
        number: String(t.number),
        customerId: t.customer_id,
        customerName: t.customer_name,
        deviceLabel: t.device_label,
        problem: t.problem,
        status: t.status,
        technicianId: t.technician_employee_id,
        technicianName: t.technician_employee_id ? t.technician_name : null,
        createdAt: t.created_at,
      })),
      byStatus,
      totalOpen: rows.length,
      totalTickets,
      hidden: false,
      unavailable: false,
    }
  })
}
