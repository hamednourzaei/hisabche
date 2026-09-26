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
import { MEMORY_MONEY_PREFIXES, MONEY_CACHE_PREFIXES } from './money-cache-keys'

// The lists live in a leaf module so cache.service can consult them too.
export { MONEY_CACHE_PREFIXES } from './money-cache-keys'

export async function invalidateMoneyCaches(workspaceId: string): Promise<void> {
  // FIRST: from this instant no money entry of this workspace is served, on
  // any instance — including one a slower read is about to write
  // (cacheService.getMoney). The deletes below only reclaim the memory.
  await cacheService.bumpMoneyGeneration(workspaceId)
  await Promise.all([
    ...MONEY_CACHE_PREFIXES.map((prefix) => cacheService.delPattern(`${prefix}:${workspaceId}:*`)),
    ...MEMORY_MONEY_PREFIXES.map((prefix) => memoryCache.invalidate(`${prefix}:${workspaceId}`)),
  ])
}
