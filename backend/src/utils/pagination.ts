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
  params: PaginationParams = {},
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
  const items = hasMore ? data!.slice(0, limit) : data || []

  // ✅ Fix: Cast to any برای دسترسی به created_at
  const lastItem = items.length > 0 ? (items[items.length - 1] as any) : null
  const nextCursor =
    hasMore && lastItem && lastItem.created_at
      ? Buffer.from(lastItem.created_at).toString('base64')
      : undefined

  return {
    data: items as T[],
    pagination: {
      hasMore,
      nextCursor,
      total: count !== null ? count : undefined,
    },
  }
}

// ═══════════════════════════════════════════
// Shared Cache (Redis-backed)
// ═══════════════════════════════════════════
// ✅ FIX: قبلاً یک Map محلی در حافظه‌ی پروسه بود — حالا wrapper
// نازکی روی cacheService (Redis) است. TTL پیش‌فرض همان ۳۰ ثانیه‌ی
// قبلی حفظ شده تا رفتار فعلی سرویس‌های مصرف‌کننده تغییر نکند.

const DEFAULT_TTL_SECONDS = 30

// ✅ L1 — کش درون‌پروسه‌ای جلوی Redis.
// اندازه‌گیری پروداکشن نشان داد یک «Cache HIT» کامل ۱۹۵ms طول می‌کشد، چون هر
// درخواست دست‌کم دو رفت‌وبرگشت Redis دارد (یکی auth، یکی داده) و Redis خارج
// از پروسه است. L1 این رفت‌وبرگشت‌ها را برای کلیدهای داغ حذف می‌کند. TTL
// عمداً کوتاه است تا در حالت چند-instance کهنگی داده حداکثر چند ثانیه باشد؛
// Redis همچنان منبع حقیقت مشترک می‌ماند.
const L1_TTL_MS = 5_000
const L1_MAX_ENTRIES = 500
const l1 = new Map<string, { value: unknown; expiresAt: number }>()

function l1Get<T>(key: string): T | null {
  const hit = l1.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    l1.delete(key)
    return null
  }
  return hit.value as T
}

function l1Set(key: string, value: unknown): void {
  if (l1.size >= L1_MAX_ENTRIES) {
    const oldest = l1.keys().next().value
    if (oldest !== undefined) l1.delete(oldest)
  }
  l1.set(key, { value, expiresAt: Date.now() + L1_TTL_MS })
}

class MemoryCache {
  async get<T>(key: string): Promise<T | null> {
    const local = l1Get<T>(key)
    if (local !== null) return local
    const remote = await cacheService.get<T>(key)
    if (remote !== null && remote !== undefined) l1Set(key, remote)
    return remote
  }

  async set<T>(key: string, data: T, ttlSeconds?: number): Promise<void> {
    l1Set(key, data)
    await cacheService.set(key, data, ttlSeconds ?? DEFAULT_TTL_SECONDS)
  }

  // ─── Authorization decisions ─────────────────────────────────────────────
  //
  // ⚠️ NEVER FROM THIS PROCESS'S MEMORY. The L1 above lives in each instance
  // and invalidate() clears only the instance that called it — so after an
  // owner revoked access, another instance could keep authorizing it for up to
  // L1_TTL_MS. And while Redis is down cacheService falls back to a Map inside
  // the process, which is the same problem for the whole TTL.
  //
  // So a value that DECIDES access is read and written only through the shared
  // store, and only while it is actually shared; otherwise it is not cached at
  // all and the caller reads the database. Revocation is then effective on
  // every instance as soon as the writer's invalidate() returns.
  async getShared<T>(key: string): Promise<T | null> {
    if (!cacheService.isShared) return null
    return cacheService.get<T>(key)
  }

  async setShared<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    if (!cacheService.isShared) return
    await cacheService.set(key, data, ttlSeconds)
  }

  // D5 — a bare key invalidates its PREFIX family (`key*`), never an
  // arbitrary SUBSTRING (`*key*`).
  //
  // The previous wrapper turned every invalidate into `*…key…*`: it matched
  // unrelated keys that merely contained the fragment, and it made each key
  // trivially self-matching, which hid the fact that SIBLING keys carrying the
  // same subject (e.g. `usage:<uid>:<feature>` next to `usage:<uid>`) were
  // never being cleared together. Prefix matching clears the family and
  // nothing else; callers wanting a narrower or wider sweep pass their own
  // glob (several services already pass explicit `…:*` patterns).
  //
  // The L1 is small and short-lived (5s TTL), so it is cleared wholesale —
  // preserving the original behaviour — rather than pattern-matched.
  async invalidate(pattern: string): Promise<void> {
    l1.clear()
    const globPattern = pattern.includes('*') ? pattern : `${pattern}*`
    await cacheService.delPattern(globPattern)
  }

  async clear(): Promise<void> {
    l1.clear()
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
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await memoryCache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  const data = await fetcher()
  await memoryCache.set(key, data, ttlSeconds)
  return data
}
