// ============================================
// backend/src/utils/pagination.ts
// Hisabche v2.1 — Keyset Pagination + Shared Cache
// FIXED: memoryCache از یک Map محلی (per-process) به Redis
// واقعی (از طریق cacheService) تغییر کرد.
//
// چرا: با چند instance همزمان (لازم برای مقیاس ۵۰k کاربر)،
// یک Map در حافظه‌ی هر پروسه جدا بود — یعنی invalidate شدن
// کش در یک instance، در instance های دیگر اثر نداشت، و همین
// باعث می‌شد کاربر گاهی داده‌ی قدیمی ببیند بسته به این‌که
// درخواستش به کدام instance می‌رفت.
// حالا همه‌ی instance ها یک Redis مشترک (همان که
// cache.service.ts برای cacheMiddleware استفاده می‌کند) را
// می‌بینند، پس invalidate در همه‌جا هم‌زمان اثر می‌کند.
//
// امضای get/set/invalidate عمداً دست‌نخورده مانده تا هیچ فایل
// دیگری (activity.service.ts، event.service.ts،
// notification.service.ts، index.ts) نیاز به تغییر نداشته باشد.
// ============================================

import { supabase } from '../db'
import { cacheService } from '../services/cache.service'

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
// Shared Cache (Redis-backed)
// ═══════════════════════════════════════════
// ✅ FIX: قبلاً یک Map محلی در حافظه‌ی پروسه بود — حالا wrapper
// نازکی روی cacheService (Redis) است. TTL پیش‌فرض همان ۳۰ ثانیه‌ی
// قبلی حفظ شده تا رفتار فعلی سرویس‌های مصرف‌کننده تغییر نکند.

const DEFAULT_TTL_SECONDS = 30

class MemoryCache {
  async get<T>(key: string): Promise<T | null> {
    return cacheService.get<T>(key)
  }

  async set<T>(key: string, data: T, ttlSeconds?: number): Promise<void> {
    await cacheService.set(key, data, ttlSeconds ?? DEFAULT_TTL_SECONDS)
  }

  // ✅ FIX: قبلاً با پیمایش دستی روی Map و key.includes(pattern)
  // کار می‌کرد. الان از delPattern واقعی Redis (که با SCAN،
  // نه KEYS، پیاده شده — همان چیزی که در cache.service.ts دیدیم)
  // استفاده می‌کند. ورودی این متد در فراخوانی‌های فعلی پروژه گاهی
  // یک substring ساده است (نه glob pattern با *) — چون
  // cacheService.delPattern از MATCH با glob استفاده می‌کند، اگر
  // ورودی خودش * نداشته باشد، به صورت خودکار با *...* پوشانده
  // می‌شود تا رفتار قبلی (شامل‌بودن substring) حفظ شود.
  async invalidate(pattern: string): Promise<void> {
    const globPattern = pattern.includes('*') ? pattern : `*${pattern}*`
    await cacheService.delPattern(globPattern)
  }

  async clear(): Promise<void> {
    await cacheService.flush()
  }
}

export const memoryCache = new MemoryCache()

// ═══════════════════════════════════════════
// Cache Helper
// ═══════════════════════════════════════════

export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await memoryCache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  const data = await fetcher()
  await memoryCache.set(key, data, ttlSeconds)
  return data
}