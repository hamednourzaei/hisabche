// ============================================
// backend/src/utils/cache.ts — Cache Keys + Helpers
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
  const cached = memoryCache.get<T>(key)
  if (cached) {
    console.log(`✅ Cache HIT: ${key}`)
    return cached
  }
  
  console.log(`❌ Cache MISS: ${key}`)
  const data = await fetcher()
  memoryCache.set(key, data, ttl)
  return data
}