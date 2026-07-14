// ============================================
// backend/src/utils/pagination.ts
// Hisabche v2.0 — Keyset Pagination + Memory Cache
// ============================================

import { supabase } from '../db'

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface PaginationParams {
  limit?: number
  cursor?: string // base64 encoded last id
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    hasMore: boolean
    nextCursor: string | undefined
    total: number | undefined
  }
}

// ═══════════════════════════════════════════
// Keyset Pagination (Cursor-based)
// ═══════════════════════════════════════════

export async function keysetPaginate<T>(
  table: string,
  columns: string,
  userId: string,
  params: PaginationParams = {}
): Promise<PaginatedResponse<T>> {
  const { limit = 20, cursor } = params
  
  let query = supabase
    .from(table)
    .select(columns, { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit + 1) // +1 برای تشخیص hasMore

  if (cursor) {
    const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8')
    query = query.lt('created_at', decodedCursor)
  }

  const { data, error, count } = await query

  if (error) throw error

  const hasMore = (data?.length || 0) > limit
  const items = hasMore ? data!.slice(0, limit) : (data || [])

  // ✅ Fix: Cast to any برای دسترسی به created_at
  const lastItem = items.length > 0 ? (items[items.length - 1] as any) : null
  const nextCursor = hasMore && lastItem && lastItem.created_at
    ? Buffer.from(lastItem.created_at).toString('base64')
    : undefined

  return {
    data: items as T[],
    pagination: {
      hasMore,
      nextCursor,
      total: count !== null ? count : undefined,
    }
  }
}

// ═══════════════════════════════════════════
// Simple In-Memory Cache
// ═══════════════════════════════════════════

interface CacheEntry<T> {
  data: T
  expiry: number
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>()
  private defaultTTL = 30_000 // 30 seconds

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data as T
  }

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + (ttl || this.defaultTTL),
    })
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  clear(): void {
    this.cache.clear()
  }
}

export const memoryCache = new MemoryCache()

// ═══════════════════════════════════════════
// Cache Helper
// ═══════════════════════════════════════════

export function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = memoryCache.get<T>(key)
  if (cached) {
    return Promise.resolve(cached)
  }

  return fetcher().then(data => {
    memoryCache.set(key, data, ttl)
    return data
  })
}