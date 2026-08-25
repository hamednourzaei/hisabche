// ============================================
// backend/src/middleware/cache.middleware.ts
// FIXED: Cache key with proper prefix
// ============================================

import { FastifyRequest, FastifyReply } from 'fastify'
import { cacheService } from '../services/cache.service'

/**
 * What the cached response belongs to.
 *
 * 'workspace' — shared business data (invoices, customers, products,
 *               transactions). The key is the workspace id, and there is NO
 *               fallback: without a resolved workspace the route is misordered
 *               or unguarded, and the cache refuses to serve rather than
 *               silently narrowing to the caller's own rows.
 * 'user'      — genuinely user-private responses: profile, billing, the list
 *               of workspaces you belong to. Never one of the four shared
 *               entities.
 *
 * Required, with no default. A default would be a fallback wearing different
 * clothes: whichever value it took would be silently wrong for half the
 * routes, and the wrong half would fail open.
 */
export type CacheScope = 'workspace' | 'user'

interface CacheOptions {
  scope: CacheScope
  ttl?: number
  keyPrefix?: string
  skipCache?: (req: FastifyRequest) => boolean
}

export function cacheMiddleware(options: CacheOptions) {
  const ttl = options.ttl || 60
  const keyPrefix = options.keyPrefix || 'cache'
  const scopeKind = options.scope

  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (options.skipCache && options.skipCache(request)) {
      return
    }

    if (request.method !== 'GET') {
      return
    }

    // The cache identity. A workspace-scoped route is keyed by the workspace
    // so the members of one shop share a single cached response — that is what
    // makes it a shared book rather than three private ones.
    //
    // There is deliberately NO fallback to the user id. A user-scoped key on
    // shared business data is not a harmless narrowing: it caches, per member,
    // a response that was computed for the whole workspace, and it hides the
    // real defect — a route that never resolved a workspace at all. Missing
    // workspace context is a bug, so it fails closed and loudly.
    let scope: string

    if (scopeKind === 'workspace') {
      const workspaceId = request.tenancy?.workspaceId
      if (!workspaceId) {
        // Reachable only by misordering the preHandlers: requireWorkspaceContext
        // already answers 401/403 for a caller with no workspace, so getting
        // here means this middleware ran before it.
        request.log.error(
          { url: request.url },
          'cacheMiddleware(scope: workspace) ran without a resolved tenancy — check preHandler order',
        )
        return reply
          .status(500)
          .send({ error: 'Internal Server Error', code: 'NO_TENANCY_CONTEXT' })
      }
      scope = workspaceId
    } else {
      const userId = request.userId
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
      }
      scope = userId
    }

    const url = request.url

    // ✅ کلید کش با keyPrefix صحیح
    const cacheKey = `${keyPrefix}:${scope}:${url}`

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
