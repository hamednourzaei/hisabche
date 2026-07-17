// ============================================
// backend/src/services/cache.service.ts
// Redis Cache Service
// ============================================

import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

class CacheService {
  private client: Redis
  private defaultTTL: number = 60 // 60 seconds

  constructor() {
    // ✅ اصلاح: استفاده از سازنده صحیح
    this.client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      enableReadyCheck: true,
      lazyConnect: false,
    })

    this.client.on('error', (err) => {
      console.error('❌ Redis Error:', err)
    })

    this.client.on('connect', () => {
      console.log('✅ Redis connected')
    })
  }

  // Get cache
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key)
      return data ? JSON.parse(data) : null
    } catch (err) {
      console.error('❌ Cache get error:', err)
      return null
    }
  }

  // Set cache with TTL (seconds)
  async set<T>(key: string, value: T, ttl: number = this.defaultTTL): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl)
    } catch (err) {
      console.error('❌ Cache set error:', err)
    }
  }

  // Delete cache
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key)
    } catch (err) {
      console.error('❌ Cache del error:', err)
    }
  }

  // Delete by pattern (e.g., "user:*")
  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern)
      if (keys.length > 0) {
        await this.client.del(...keys)
      }
    } catch (err) {
      console.error('❌ Cache delPattern error:', err)
    }
  }

  // Flush all cache
  async flush(): Promise<void> {
    try {
      await this.client.flushall()
    } catch (err) {
      console.error('❌ Cache flush error:', err)
    }
  }

  // Close connection
  async close(): Promise<void> {
    try {
      await this.client.quit()
    } catch (err) {
      console.error('❌ Cache close error:', err)
    }
  }
}

export const cacheService = new CacheService()