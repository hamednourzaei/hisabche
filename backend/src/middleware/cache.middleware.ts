// ============================================
// backend/src/middleware/cache.middleware.ts
// FIXED: Cache key with proper prefix
// ============================================

import { FastifyRequest, FastifyReply } from 'fastify'
import { cacheService } from '../services/cache.service'

interface CacheOptions {
  ttl?: number
  keyPrefix?: string
  skipCache?: (req: FastifyRequest) => boolean
}

export function cacheMiddleware(options: CacheOptions = {}) {
  const ttl = options.ttl || 60
  const keyPrefix = options.keyPrefix || 'cache'

  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (options.skipCache && options.skipCache(request)) {
      return
    }

    if (request.method !== 'GET') {
      return
    }

    const userId = (request as any).userId || 'anonymous'
    const url = request.url

    // ✅ کلید کش با keyPrefix صحیح
    const cacheKey = `${keyPrefix}:${userId}:${url}`

    try {
      const cachedData = await cacheService.get(cacheKey)
      if (cachedData !== null) {
        reply.header('X-Cache', 'HIT')
        reply.header('X-Cache-Key', cacheKey.substring(0, 50) + '...')
        return reply.send(cachedData)
      }

      reply.header('X-Cache', 'MISS')

      const originalSend = reply.send.bind(reply)
      reply.send = function (payload: any) {
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

export async function clearCache(pattern: string): Promise<void> {
  console.log(`🗑️ Clearing cache: ${pattern}`)
  await cacheService.delPattern(pattern)
}