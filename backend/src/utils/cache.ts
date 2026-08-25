import { trackCache } from './request-metrics'
// ============================================
// backend/src/utils/cache.ts — Cache Keys + Helpers
// FIXED: memoryCache.get/set در pagination.ts async هستند
// (Redis-backed از طریق cacheService) — قبلاً بدون await صدا زده
// می‌شدند که باعث می‌شد `cached` همیشه یک Promise باشد، نه مقدار
// resolve‌شده (خطای build: Type 'T | null' is not assignable to 'T').
// ============================================

import { memoryCache } from './pagination'

// ═══════════════════════════════════════════
// Cache Keys Convention
// ═══════════════════════════════════════════

// Every key here holds data derived from the four SHARED business entities —
// invoices, customers, products, transactions — so every one is keyed by the
// WORKSPACE. The parameter is named `workspaceId` on purpose: it used to be
// `userId`, and a caller passing the wrong id was previously indistinguishable
// at the type level from a correct one.
//
// There is deliberately no user-scoped variant here. Genuinely private data
// (profile, billing) keys itself where it is used, and mixing the two
// conventions in one table is how a shared cache ends up user-keyed.
export const CacheKeys = {
  dashboard: (workspaceId: string) => `dashboard:${workspaceId}`,
  salesSummary: (workspaceId: string, start: string, end: string) =>
    `sales:${workspaceId}:${start}:${end}`,
  invoices: (workspaceId: string, page: number) => `invoices:${workspaceId}:page:${page}`,
  customers: (workspaceId: string) => `customers:${workspaceId}`,
  products: (workspaceId: string) => `products:${workspaceId}`,
  insights: (workspaceId: string) => `insights:${workspaceId}`,
}

// ═══════════════════════════════════════════
// Cache Helper with TTL
// ═══════════════════════════════════════════

export async function withCacheKey<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await memoryCache.get<T>(key)
  if (cached) {
    trackCache(true)
    console.log(`✅ Cache HIT: ${key}`)
    return cached
  }

  trackCache(false)
  console.log(`❌ Cache MISS: ${key}`)
  const data = await fetcher()
  await memoryCache.set(key, data, ttl)
  return data
}
