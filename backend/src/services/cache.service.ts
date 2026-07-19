// ============================================
// backend/src/services/cache.service.ts — Optimized v2.1
// FIXED: Redis constructor, added monitoring, better error handling
// ============================================

import Redis from 'ioredis'

// ✅ Environment variables with defaults
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const CACHE_DEFAULT_TTL = parseInt(process.env.CACHE_DEFAULT_TTL || '60', 10)
const CACHE_LONG_TTL = parseInt(process.env.CACHE_LONG_TTL || '300', 10)
const CACHE_SHORT_TTL = parseInt(process.env.CACHE_SHORT_TTL || '30', 10)

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

  constructor() {
    // ✅ FIX: سازنده صحیح Redis
    if (REDIS_URL.startsWith('redis://') || REDIS_URL.startsWith('rediss://')) {
      // ✅ اگر URL کامل است
      this.client = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
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
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
        enableReadyCheck: true,
        connectTimeout: 10000,
      })
    }

    this.client.on('error', (err) => {
      console.error('❌ Redis Error:', err.message)
      this.isConnected = false
    })

    this.client.on('connect', () => {
      console.log('✅ Redis connected')
      this.isConnected = true
    })

    this.client.on('close', () => {
      console.log('⚠️ Redis connection closed')
      this.isConnected = false
    })

    this.client.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...')
    })
  }

  // ─── Get cache ──────────────────────────────────────────────
  async get<T>(key: string): Promise<T | null> {
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
      return null
    }
  }

  // ─── Set cache with TTL ────────────────────────────────────
  async set<T>(key: string, value: T, ttl: number = this.defaultTTL): Promise<boolean> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl)
      this.stats.sets++
      return true
    } catch (err) {
      this.stats.errors++
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(`❌ Cache set error [${key}]:`, errorMessage)
      return false
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
    try {
      const result = await this.client.del(key)
      this.stats.deletes++
      return result > 0
    } catch (err) {
      this.stats.errors++
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(`❌ Cache del error [${key}]:`, errorMessage)
      return false
    }
  }

  // ─── Delete by pattern ─────────────────────────────────────
  // ✅ FIX: استفاده از SCAN به جای KEYS (برای Production)
  async delPattern(pattern: string): Promise<number> {
    try {
      let deletedCount = 0
      let cursor = '0'
      
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        )
        cursor = nextCursor
        
        if (keys.length > 0) {
          const deleted = await this.client.del(...keys)
          deletedCount += deleted
        }
      } while (cursor !== '0')
      
      this.stats.deletes += deletedCount
      return deletedCount
    } catch (err) {
      this.stats.errors++
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(`❌ Cache delPattern error [${pattern}]:`, errorMessage)
      return 0
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

  // ─── Get or Set with function ─────────────────────────────
  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
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
  SHORT: CACHE_SHORT_TTL,      // 30 seconds
  DEFAULT: CACHE_DEFAULT_TTL,  // 60 seconds
  LONG: CACHE_LONG_TTL,        // 300 seconds (5 minutes)
  VERY_LONG: 600,              // 600 seconds (10 minutes)
  HOUR: 3600,                  // 1 hour
  DAY: 86400,                  // 24 hours
} as const

// ✅ Export types
export type { CacheStats }