// ============================================
// backend/src/utils/money-cache-keys.ts
//
// Which cache keys hold money figures. A LEAF: it imports nothing, because
// cache.service needs it and money-cache.ts imports cache.service — a shared
// constant taken from either would close a module cycle (راهنمای سشن §۸,
// no-service-import-cycles.test.ts).
//
// ⚠️ A money figure is cached ONLY where every instance sees the same copy and
// the same invalidation: Redis. Not in a process's L1, and not in the
// in-memory fallback while Redis is down — there, instance A's
// invalidateMoneyCaches() cannot reach instance B, and B would keep showing a
// paid invoice as unpaid, or a stock level from before a sale, for the whole
// TTL. Such a read goes to the database instead: slower, never wrong.
// ============================================

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
export const MEMORY_MONEY_PREFIXES = ['payments', 'invoices', 'accounting'] as const

const MONEY_PREFIXES: ReadonlySet<string> = new Set<string>([
  ...MONEY_CACHE_PREFIXES,
  ...MEMORY_MONEY_PREFIXES,
])

/** A key is `<prefix>:<scope>:…`; it holds money figures when its prefix is listed above. */
export function isMoneyCacheKey(key: string): boolean {
  const colon = key.indexOf(':')
  return colon > 0 && MONEY_PREFIXES.has(key.slice(0, colon))
}
