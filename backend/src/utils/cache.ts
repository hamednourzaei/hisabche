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

export const CacheKeys = {
  dashboard: (userId: string) => `dashboard:${userId}`,
  salesSummary: (userId: string, start: string, end: string) => `sales:${userId}:${start}:${end}`,
  invoices: (userId: string, page: number) => `invoices:${userId}:page:${page}`,
  customers: (userId: string) => `customers:${userId}`,
  products: (userId: string) => `products:${userId}`,
  insights: (userId: string) => `insights:${userId}`,
}

// ═══════════════════════════════════════════
// Cache Helper with TTL
// ═══════════════════════════════════════════

export async function withCacheKey<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
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