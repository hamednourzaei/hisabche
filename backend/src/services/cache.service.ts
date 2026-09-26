// ============================================
// backend/src/services/cache.service.ts — Optimized v2.1
// FIXED: Redis constructor, added monitoring, better error handling
// ============================================

import Redis from 'ioredis'

import { isMoneyCacheKey } from '../utils/money-cache-keys'

// ✅ Environment variables with defaults
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const CACHE_DEFAULT_TTL = parseInt(process.env.CACHE_DEFAULT_TTL || '60', 10)
const CACHE_LONG_TTL = parseInt(process.env.CACHE_LONG_TTL || '300', 10)
const CACHE_SHORT_TTL = parseInt(process.env.CACHE_SHORT_TTL || '30', 10)

// ============================================
// ✅ FIX: In-memory fallback cache — قبلاً وقتی Redis غیرقابل‌دسترس
// بود (مثلاً REDIS_URL روی هاست داخلی production که از dev لوکال
// resolve نمی‌شود)، get/set به‌صورت خاموش fail می‌شدند و null/false
// برمی‌گرداندند. این یعنی کش auth در auth.middleware.ts هیچ‌وقت hit
// نمی‌خورد و supabase.auth.getUser() — یک درخواست واقعی به سرور Auth
// سوپابیس — روی *هر* درخواست بک‌اند (نه فقط هر ناوبری) اجرا می‌شد.
// این fallback با همان امضای get/set/delPattern (شامل TTL و
// glob pattern با *) جایگزین موقت Redis می‌شود تا کش — و درنتیجه
// نرخ درخواست به Supabase Auth — مستقل از دسترس‌پذیری Redis درست کار کند.
// ============================================
const fallbackStore = new Map<string, { value: string; expiresAt: number }>()
const FALLBACK_MAX_ENTRIES = 5000

function fallbackPrune(key: string): void {
  const entry = fallbackStore.get(key)
  if (entry && entry.expiresAt <= Date.now()) fallbackStore.delete(key)
}

function fallbackGet(key: string): string | null {
  fallbackPrune(key)
  return fallbackStore.get(key)?.value ?? null
}

function fallbackSet(key: string, value: string, ttlSeconds: number): void {
  if (!fallbackStore.has(key) && fallbackStore.size >= FALLBACK_MAX_ENTRIES) {
    const oldestKey = fallbackStore.keys().next().value
    if (oldestKey !== undefined) fallbackStore.delete(oldestKey)
  }
  fallbackStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
}

function fallbackDel(key: string): boolean {
  return fallbackStore.delete(key)
}

function fallbackDelPattern(pattern: string): number {
  const regex = new RegExp(
    `^${pattern
      .split('*')
      .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')}$`,
  )
  let deleted = 0
  for (const key of fallbackStore.keys()) {
    if (regex.test(key)) {
      fallbackStore.delete(key)
      deleted++
    }
  }
  return deleted
}

// A key without a TTL (PTTL -1) would never reset — give it the window again.
const RATE_LIMIT_HIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {current, ttl}
`

// ✅ Stats for monitoring
interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  errors: number
}

class CacheService {
  private client: Redis
  private defaultTTL: number = CACHE_DEFAULT_TTL
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  }
  private isConnected: boolean = false
  /**
   * True once the current outage has been reported.
   *
   * Redis retries forever by design — if the server restarts, we want to
   * reconnect. But every attempt fired three log lines, and against an
   * unreachable host (REDIS_URL pointing at Render's internal hostname, which
   * never resolves from a dev machine) that floods the console until the
   * server output is unreadable. Report an outage once, then stay quiet until
   * the connection actually comes back.
   */
  private outageReported: boolean = false

  constructor() {
    // ✅ FIX: سازنده صحیح Redis
    if (REDIS_URL.startsWith('redis://') || REDIS_URL.startsWith('rediss://')) {
      // ✅ اگر URL کامل است
      this.client = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => Math.min(times * 200, 30_000),
        enableReadyCheck: true,
        lazyConnect: false,
        connectTimeout: 10000,
      })
    } else {
      // ✅ اگر فقط host است
      this.client = new Redis({
        host: REDIS_URL,
        port: 6379,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => Math.min(times * 200, 30_000),
        enableReadyCheck: true,
        connectTimeout: 10000,
      })
    }

    this.client.on('error', (err) => {
      this.isConnected = false

      if (this.outageReported) return
      this.outageReported = true

      console.error(
        `❌ Redis unavailable (${err.message}) — falling back to the in-memory cache. ` +
          `Retrying quietly in the background; this will log again once it reconnects.`,
      )
    })

    this.client.on('connect', () => {
      // Only announce a recovery if we had actually reported an outage,
      // otherwise a normal startup prints nothing of interest.
      if (this.outageReported) console.log('✅ Redis reconnected')
      else console.log('✅ Redis connected')

      this.outageReported = false
      this.isConnected = true
    })

    this.client.on('close', () => {
      this.isConnected = false
    })
  }

  // ─── Get cache ──────────────────────────────────────────────
  /**
   * Whether a value written here is visible to EVERY backend instance. False
   * while Redis is unreachable: the fallback store is a Map inside this process.
   */
  get isShared(): boolean {
    return this.isConnected
  }

  // ⚠️ MONEY KEYS NEVER TOUCH THE IN-PROCESS FALLBACK (utils/money-cache-keys):
  // without Redis another instance's invalidation cannot reach this copy, so
  // it is a miss and the caller reads the database.
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      if (isMoneyCacheKey(key)) return null
      const cached = fallbackGet(key)
      return cached ? (JSON.parse(cached) as T) : null
    }
    try {
      const data = await this.client.get(key)
      if (data) {
        this.stats.hits++
        return JSON.parse(data) as T
      }
      this.stats.misses++
      return null
    } catch (err) {
      this.stats.errors++
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(`❌ Cache get error [${key}]:`, errorMessage)
      if (isMoneyCacheKey(key)) return null
      const cached = fallbackGet(key)
      return cached ? (JSON.parse(cached) as T) : null
    }
  }

  // ─── Set cache with TTL ────────────────────────────────────
  async set<T>(key: string, value: T, ttl: number = this.defaultTTL): Promise<boolean> {
    if (!this.isConnected) {
      if (isMoneyCacheKey(key)) return false
      fallbackSet(key, JSON.stringify(value), ttl)
      return true
    }
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl)
      this.stats.sets++
      return true
    } catch (err) {
      this.stats.errors++
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(`❌ Cache set error [${key}]:`, errorMessage)
      if (isMoneyCacheKey(key)) return false
      fallbackSet(key, JSON.stringify(value), ttl)
      return true
    }
  }

  // ─── Set with specific TTL types ──────────────────────────
  async setShort<T>(key: string, value: T): Promise<boolean> {
    return this.set(key, value, CACHE_SHORT_TTL)
  }

  async setLong<T>(key: string, value: T): Promise<boolean> {
    return this.set(key, value, CACHE_LONG_TTL)
  }

  // ─── Delete cache ──────────────────────────────────────────
  async del(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return fallbackDel(key)
    }
    try {
      const result = await this.client.del(key)
      this.stats.deletes++
      fallbackDel(key)
      return result > 0
    } catch (err) {
      this.stats.errors++
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(`❌ Cache del error [${key}]:`, errorMessage)
      return fallbackDel(key)
    }
  }

  // ─── Delete by pattern ─────────────────────────────────────
  // ✅ FIX: استفاده از SCAN به جای KEYS (برای Production)
  async delPattern(pattern: string): Promise<number> {
    if (!this.isConnected) {
      return fallbackDelPattern(pattern)
    }
    try {
      let deletedCount = 0
      let cursor = '0'

      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
        cursor = nextCursor

        if (keys.length > 0) {
          const deleted = await this.client.del(...keys)
          deletedCount += deleted
        }
      } while (cursor !== '0')

      this.stats.deletes += deletedCount
      fallbackDelPattern(pattern)
      return deletedCount
    } catch (err) {
      this.stats.errors++
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(`❌ Cache delPattern error [${pattern}]:`, errorMessage)
      return fallbackDelPattern(pattern)
    }
  }

  // ─── Check if key exists ──────────────────────────────────
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key)
      return result === 1
    } catch (err) {
      this.stats.errors++
      console.error(`❌ Cache exists error [${key}]:`, err)
      return false
    }
  }

  // ─── Get TTL of a key ─────────────────────────────────────
  async getTTL(key: string): Promise<number> {
    try {
      return await this.client.ttl(key)
    } catch (err) {
      this.stats.errors++
      console.error(`❌ Cache ttl error [${key}]:`, err)
      return -2 // key does not exist
    }
  }

  // ─── Increment counter ─────────────────────────────────────
  async incr(key: string, by: number = 1): Promise<number | null> {
    try {
      return await this.client.incrby(key, by)
    } catch (err) {
      this.stats.errors++
      console.error(`❌ Cache incr error [${key}]:`, err)
      return null
    }
  }

  // ─── Rate-limit counter shared by every instance ──────────
  /**
   * One hit on a fixed-window counter in Redis: INCR, and the window starts on
   * the first hit. Atomic in one script, so N instances count into ONE budget.
   * `null` while Redis is not shared — the caller owns the fallback
   * (utils/shared-rate-limit-store.ts).
   */
  async rateLimitHit(
    key: string,
    windowMs: number,
  ): Promise<{ current: number; ttl: number } | null> {
    if (!this.isConnected) return null
    try {
      const [current, ttl] = (await this.client.eval(RATE_LIMIT_HIT_LUA, 1, key, windowMs)) as [
        number,
        number,
      ]
      return { current, ttl }
    } catch (err) {
      this.stats.errors++
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(`❌ Rate-limit counter error [${key}]:`, errorMessage)
      return null
    }
  }

  // ─── Get or Set with function ─────────────────────────────
  async getOrSet<T>(key: string, fn: () => Promise<T>, ttl: number = this.defaultTTL): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const result = await fn()
    await this.set(key, result, ttl)
    return result
  }

  // ─── Flush all cache ──────────────────────────────────────
  async flush(): Promise<boolean> {
    fallbackStore.clear()
    if (!this.isConnected) return true
    try {
      await this.client.flushall()
      this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0, errors: 0 }
      return true
    } catch (err) {
      this.stats.errors++
      console.error('❌ Cache flush error:', err)
      return false
    }
  }

  // ─── Get Stats ─────────────────────────────────────────────
  getStats(): CacheStats & { connected: boolean; hitRate: number } {
    const total = this.stats.hits + this.stats.misses
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0
    return {
      ...this.stats,
      connected: this.isConnected,
      hitRate: Math.round(hitRate * 100) / 100,
    }
  }

  // ─── Reset Stats ───────────────────────────────────────────
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0, errors: 0 }
  }

  // ─── Health Check ──────────────────────────────────────────
  async healthCheck(): Promise<{ connected: boolean; latency: number; error?: string }> {
    const start = Date.now()
    try {
      await this.client.ping()
      const latency = Date.now() - start
      return { connected: true, latency }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      return { connected: false, latency: -1, error: errorMessage }
    }
  }

  // ─── Close connection ──────────────────────────────────────
  async close(): Promise<void> {
    try {
      await this.client.quit()
      this.isConnected = false
    } catch (err) {
      console.error('❌ Cache close error:', err)
    }
  }

  // ─── Get raw Redis client (for advanced operations) ──────
  getClient(): Redis {
    return this.client
  }
}

// ✅ Export singleton
export const cacheService = new CacheService()

// ✅ Export TTL constants for use in other services
export const TTL = {
  SHORT: CACHE_SHORT_TTL, // 30 seconds
  DEFAULT: CACHE_DEFAULT_TTL, // 60 seconds
  LONG: CACHE_LONG_TTL, // 300 seconds (5 minutes)
  VERY_LONG: 600, // 600 seconds (10 minutes)
  HOUR: 3600, // 1 hour
  DAY: 86400, // 24 hours
} as const

// ✅ Export types
export type { CacheStats }
