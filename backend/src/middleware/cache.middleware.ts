// ============================================
// backend/src/middleware/cache.middleware.ts
// Cache Middleware for Fastify
// ============================================

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'
import { cacheService } from '../services/cache.service'

interface CacheOptions {
  ttl?: number // seconds
  keyPrefix?: string
  skipCache?: (req: FastifyRequest) => boolean
}

export function cacheMiddleware(options: CacheOptions = {}) {
  const ttl = options.ttl || 60
  const keyPrefix = options.keyPrefix || 'cache'

  return async function (request: FastifyRequest, reply: FastifyReply) {
    // Skip cache if specified
    if (options.skipCache && options.skipCache(request)) {
      return
    }

    // Generate cache key from URL + query + params + user ID (if authenticated)
    const userId = (request as any).userId || 'anonymous'
    const url = request.url
    const method = request.method

    // Only cache GET requests
    if (method !== 'GET') {
      return
    }

    const cacheKey = `${keyPrefix}:${userId}:${url}`

    try {
      // Try to get from cache
      const cachedData = await cacheService.get(cacheKey)
      if (cachedData !== null) {
        reply.header('X-Cache', 'HIT')
        return reply.send(cachedData)
      }

      // Cache MISS - store original send function
      reply.header('X-Cache', 'MISS')

      // Override reply.send to cache the response
      const originalSend = reply.send.bind(reply)
      reply.send = function (payload: any) {
        // Cache the response (only if status is 200)
        if (reply.statusCode === 200) {
          cacheService.set(cacheKey, payload, ttl).catch(() => {})
        }
        return originalSend(payload)
      }
    } catch (err) {
      console.error('❌ Cache middleware error:', err)
    }
  }
}

// Helper to clear cache by pattern
export async function clearCache(pattern: string): Promise<void> {
  await cacheService.delPattern(pattern)
}