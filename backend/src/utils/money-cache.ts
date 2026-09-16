// ============================================
// backend/src/utils/money-cache.ts
//
// One place that knows which cached responses change when money moves.
//
// ⚠️ THERE ARE TWO CACHES, AND BOTH HOLD MONEY FIGURES.
//   • `cacheMiddleware` (Redis, in-memory fallback) caches whole GET responses
//     under `${keyPrefix}:${workspaceId}:${url}` — see cache.middleware.ts.
//   • `memoryCache` (utils/pagination) caches service reads, e.g.
//     `invoices:${workspaceId}:${filters}` in invoice.service.
//
// Reported: an unpaid invoice got a full 3,000,000 payment; the list said
// «پرداخت شده» but the invoice page still showed «باقی‌مانده ۳٬۰۰۰٬۰۰۰» and
// «۰ ≠ ۳٬۰۰۰٬۰۰۰» until a hard refresh. PaymentsService cleared only
// `memoryCache`; `GET /api/invoices/:id` is cached for 120 s under the
// `invoice:` prefix, which nothing cleared after a payment. The invoice routes
// also cleared `dashboard:v2:<ws>` and `insights:<ws>` — patterns that match
// no key the middleware writes (`dashboard:<ws>:<url>`), so those were no-ops.
//
// Guarded by __tests__/money-cache-invalidation.test.ts: every cacheMiddleware
// prefix whose response carries an invoice, payment, balance or ledger figure
// must be listed here.
// ============================================

import { cacheService } from '../services/cache.service'
import { memoryCache } from './pagination'

/** `cacheMiddleware` key prefixes whose responses change when an invoice or payment changes. */
export const MONEY_CACHE_PREFIXES = [
  'invoice',
  'invoices',
  'payments',
  'aging',
  'customer',
  'customers',
  'customer-balance',
  'customer-debt',
  'transactions',
  'transaction-balance',
  'journal',
  'accounts',
  'trial-balance',
  'balance-sheet',
  'income-statement',
  'cash-flow',
  'dashboard',
  'sales',
  'financial',
  'insights',
  'inventory',
  'inventory-valuation',
  'low-stock',
  'product',
  'products',
  'warehouse-stock',
  'warehouses',
] as const

/** `memoryCache` prefixes written by services for the same figures. */
const MEMORY_PREFIXES = ['payments', 'invoices', 'accounting'] as const

export async function invalidateMoneyCaches(workspaceId: string): Promise<void> {
  await Promise.all([
    ...MONEY_CACHE_PREFIXES.map((prefix) => cacheService.delPattern(`${prefix}:${workspaceId}:*`)),
    ...MEMORY_PREFIXES.map((prefix) => memoryCache.invalidate(`${prefix}:${workspaceId}`)),
  ])
}
