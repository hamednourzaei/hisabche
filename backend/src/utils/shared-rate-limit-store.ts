// ============================================
// backend/src/utils/shared-rate-limit-store.ts
//
// The @fastify/rate-limit store: ONE budget across every backend instance.
//
// ⚠️ The plugin's default store is a map inside the process. With N instances
// behind the load balancer each keeps its own count, so a limit of 30/min is
// really N × 30/min — for login and refresh that is a brute-force budget that
// grows with every instance added. Here the count lives in Redis
// (cacheService.rateLimitHit), where every instance increments the same key.
//
// While Redis is unreachable there is no shared count. Not limiting at all
// would open login wide; refusing every request would take the whole API down
// with the cache. So each instance counts locally and SPENDS its budget N
// times faster, N = RATE_LIMIT_INSTANCE_COUNT: N instances together then stay
// at about the configured limit. Keep that variable equal to the number of
// running instances (default 1 — one instance, exact).
// ============================================

import type { FastifyRateLimitStore } from '@fastify/rate-limit'

import { cacheService } from '../services/cache.service'

/** How many backend instances run. Only used while Redis is down (see above). */
export const RATE_LIMIT_INSTANCE_COUNT = instanceCount(process.env.RATE_LIMIT_INSTANCE_COUNT)

function instanceCount(raw: string | undefined): number {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

const LOCAL_MAX_KEYS = 5000

interface Hit {
  current: number
  ttl: number
}

type Callback = Parameters<FastifyRateLimitStore['incr']>[1]

interface StoreOptions {
  continueExceeding?: boolean | undefined
  exponentialBackoff?: boolean | undefined
  routeInfo?: { method?: string | undefined; url?: string | undefined } | undefined
}

export class SharedRateLimitStore implements FastifyRateLimitStore {
  private readonly prefix: string
  private readonly local: Map<string, { count: number; startedAt: number }>

  constructor(
    options: StoreOptions = {},
    prefix = 'ratelimit:',
    local = new Map<string, { count: number; startedAt: number }>(),
  ) {
    // A fixed window only. Silently ignoring these would weaken a limit that
    // someone configured to be stricter.
    if (options.continueExceeding || options.exponentialBackoff) {
      throw new Error(
        'SharedRateLimitStore does not support continueExceeding or exponentialBackoff',
      )
    }
    this.prefix = prefix
    this.local = local
  }

  incr(key: string, cb: Callback, timeWindow: number): void {
    const fullKey = this.prefix + key
    cacheService
      .rateLimitHit(fullKey, timeWindow)
      // Two-argument then: a throw inside cb must not call cb a second time.
      .then(
        (shared) => cb(null, shared ?? this.localHit(fullKey, timeWindow)),
        () => cb(null, this.localHit(fullKey, timeWindow)),
      )
  }

  // A route with its own limit counts in its own namespace, as the plugin's
  // stores do.
  //
  // ⚠️ The plugin's type says `child(RouteOptions)`, but at runtime it passes
  // the route's MERGED LIMIT PARAMS with the route under `routeInfo`
  // (@fastify/rate-limit index.js, onRoute → mergeParams(…, { routeInfo })) —
  // which is also where continueExceeding would arrive. Read that shape.
  child(routeOptions: Parameters<FastifyRateLimitStore['child']>[0]): SharedRateLimitStore {
    const params = routeOptions as unknown as StoreOptions
    const route = params.routeInfo
    return new SharedRateLimitStore(
      params,
      `${this.prefix}${route?.method ?? ''}${route?.url ?? ''}:`,
      this.local,
    )
  }

  private localHit(key: string, windowMs: number): Hit {
    const now = Date.now()
    let entry = this.local.get(key)
    if (!entry || entry.startedAt + windowMs <= now) {
      if (!entry && this.local.size >= LOCAL_MAX_KEYS) {
        const oldest = this.local.keys().next().value
        if (oldest !== undefined) this.local.delete(oldest)
      }
      entry = { count: 0, startedAt: now }
      this.local.set(key, entry)
    }
    entry.count++
    return {
      current: entry.count * RATE_LIMIT_INSTANCE_COUNT,
      ttl: entry.startedAt + windowMs - now,
    }
  }
}
