// ============================================
// backend/src/services/analytics/dashboard-visibility.domain.ts
//
// Which of the dashboard's figures a person may be told.
//
// `GET /api/analytics/dashboard` asked only for membership: anybody in the
// business — a storekeeper whose role has no invoices, a cashier with no
// customers page — received total sales, what customers owe and the value of
// the stock at COST. The pages were closed to them and the home screen read
// them the same numbers.
//
// A figure the person may not see is ZEROED and NAMED in `hidden`. Named, so
// the client leaves the card out — a zero on its own would be a claim («you
// sold nothing»), and it is not one.
//
// Pure: no database, no request. The route applies it AFTER the shared
// computation, and caches the result per member, not per workspace.
// ============================================

import type { Capability } from '../authorization'

/** The figure groups a dashboard card belongs to. */
export const DASHBOARD_FIGURE_GROUPS = ['sales', 'customers', 'stock', 'stockValue'] as const
export type DashboardFigureGroup = (typeof DASHBOARD_FIGURE_GROUPS)[number]

/** What each group needs. Every capability listed is required. */
export const DASHBOARD_GROUP_REQUIRES: Readonly<
  Record<DashboardFigureGroup, readonly Capability[]>
> = {
  sales: ['invoice.read'],
  customers: ['customer.read'],
  stock: ['inventory.read'],
  // Quantity × buy price: the shop's margin, the same thing the product page
  // keeps from a role without it.
  stockValue: ['inventory.cost.read'],
}

/** The numeric fields of the answer that belong to each group. */
export const DASHBOARD_GROUP_FIELDS: Readonly<Record<DashboardFigureGroup, readonly string[]>> = {
  sales: [
    'todaySales',
    'todayInvoices',
    'monthlyRevenue',
    'monthlyGrowth',
    'pendingPayments',
    'pendingPaymentsCount',
    'totalSales',
  ],
  customers: ['activeCustomers', 'customerGrowth', 'customerDebt'],
  stock: ['lowStockAlerts'],
  stockValue: ['warehouseValue'],
}

/** Groups this person may NOT be told. */
export function hiddenDashboardGroups(
  holds: (capability: Capability) => boolean,
): DashboardFigureGroup[] {
  return DASHBOARD_FIGURE_GROUPS.filter((group) =>
    DASHBOARD_GROUP_REQUIRES[group].some((capability) => !holds(capability)),
  )
}

/**
 * The answer with what the person may not see taken out.
 *
 * The per-currency breakdown is sales and customer money together: it goes
 * when either is hidden.
 */
export function maskDashboardKpis<T extends Record<string, unknown>>(
  kpis: T,
  hidden: readonly DashboardFigureGroup[],
): T & { hidden: DashboardFigureGroup[] } {
  const masked: Record<string, unknown> = { ...kpis }
  for (const group of hidden) {
    for (const field of DASHBOARD_GROUP_FIELDS[group]) masked[field] = 0
  }
  if (hidden.includes('sales') || hidden.includes('customers')) {
    masked.byCurrency = {}
    masked.currencies = []
    masked.mixedCurrency = false
  }
  return { ...(masked as T), hidden: [...hidden] }
}
