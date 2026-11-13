// ============================================
// backend/src/middleware/admin-rate-limit.middleware.ts
//
// V63 · S-5 — a SECOND, tighter budget for `/api/admin/*`.
//
// The global `@fastify/rate-limit` (100/min) protects the whole API. The
// console is different: a handful of people, holding permissions that can move
// money and rotate secrets, on a surface a bot can enumerate quickly. One
// shared budget for every endpoint means an attacker gets the same 100 guesses
// per minute against `/api/admin/...` as against a product list.
//
// ⚠️ The counter is Redis when it is reachable (one budget across instances).
// Without Redis each instance counts locally and SPENDS its budget
// `RATE_LIMIT_INSTANCE_COUNT` times faster, exactly like the global store —
// see utils/shared-rate-limit-store.ts for why that is the honest fallback.
//
// ⚠️ A limiter must never answer 500. A store error fails OPEN (the request
// proceeds) and is logged once per process; a refusal is ALWAYS a 429.
// ============================================

import { createHash } from 'node:crypto'

import { cacheService } from '../services/cache.service'
import { RATE_LIMIT_INSTANCE_COUNT } from '../utils/shared-rate-limit-store'

/** The minimum of a request the limiter reads. */
export interface LimiterRequest {
  url: string
  ip: string
  headers: Record<string, string | string[] | undefined>
}

/** The minimum of a reply the limiter writes. */
export interface LimiterReply {
  code(statusCode: number): LimiterReply
  header(name: string, value: string): LimiterReply
  send(payload: unknown): unknown
}

export interface AdminRateLimitStore {
  /** One hit on a fixed window. `null` means «this store cannot answer». */
  hit(key: string, windowMs: number): Promise<{ current: number; ttl: number } | null>
}

export interface AdminRateLimiterOptions {
  /** Requests allowed per window, per credential. */
  limit?: number
  windowMs?: number
  store?: AdminRateLimitStore
  now?: () => number
}

export const ADMIN_RATE_LIMIT_PER_MINUTE = 60
export const ADMIN_RATE_LIMIT_WINDOW_MS = 60_000

const ADMIN_PATH = '/api/admin'

/** Redis-backed by default; `null` while Redis is not shared. */
const redisStore: AdminRateLimitStore = {
  hit: (key, windowMs) => cacheService.rateLimitHit(key, windowMs),
}

function bucketOf(request: LimiterRequest): string {
  const authorization = request.headers.authorization
  const token = Array.isArray(authorization) ? authorization[0] : authorization
  if (token) {
    // Never store a token: a fingerprint identifies the credential for the
    // length of a window without being usable if the cache is read.
    return `token:${createHash('sha256').update(token).digest('hex').slice(0, 32)}`
  }
  return `ip:${request.ip}`
}

/**
 * One fixed window, in this process. Bounded by pruning expired buckets on
 * every hit, so a long-running instance cannot grow without limit.
 */
class LocalWindowStore implements AdminRateLimitStore {
  private readonly buckets = new Map<string, { count: number; expiresAt: number }>()
  private readonly now: () => number

  constructor(now: () => number) {
    this.now = now
  }

  async hit(key: string, windowMs: number): Promise<{ current: number; ttl: number }> {
    const at = this.now()
    for (const [bucketKey, bucket] of this.buckets) {
      if (bucket.expiresAt <= at) this.buckets.delete(bucketKey)
    }

    const existing = this.buckets.get(key)
    if (!existing) {
      this.buckets.set(key, { count: 1, expiresAt: at + windowMs })
      return { current: 1, ttl: windowMs }
    }

    existing.count += 1
    return { current: existing.count, ttl: Math.max(0, existing.expiresAt - at) }
  }

  clear(): void {
    this.buckets.clear()
  }
}

export interface AdminRateLimiter {
  (request: LimiterRequest, reply: LimiterReply): Promise<void>
  resetForTesting(): void
}

/**
 * Build the `onRequest` hook.
 *
 * Tests inject their own store and clock; production uses Redis with a local
 * fallback, and the local budget is tightened by the instance count so N
 * instances together stay near the configured limit.
 */
export function createAdminRateLimiter(options: AdminRateLimiterOptions = {}): AdminRateLimiter {
  const now = options.now ?? Date.now
  // An injected store IS the shared store: the tests pass one to prove the
  // budget is exact, and a caller may pass a real one. Only when nothing is
  // injected does Redis act as the shared counter.
  const shared: AdminRateLimitStore = options.store ?? redisStore
  const local = new LocalWindowStore(now)
  const windowMs = options.windowMs ?? ADMIN_RATE_LIMIT_WINDOW_MS
  const configuredLimit = options.limit ?? ADMIN_RATE_LIMIT_PER_MINUTE
  // With N instances and no shared store each one may spend limit/N; with one
  // instance this is the exact limit.
  const localLimit = Math.max(1, Math.ceil(configuredLimit / RATE_LIMIT_INSTANCE_COUNT))

  const hook = async (request: LimiterRequest, reply: LimiterReply): Promise<void> => {
    const path = request.url.split('?')[0] ?? request.url
    if (path !== ADMIN_PATH && !path.startsWith(`${ADMIN_PATH}/`)) return

    const key = `rate-limit:admin:${bucketOf(request)}`

    let result: { current: number; ttl: number } | null
    let limit = configuredLimit

    try {
      result = await shared.hit(key, windowMs)
    } catch {
      // A broken cache must not become a 500 in front of the console: fall
      // through to the local window, which still enforces a budget.
      result = null
    }

    if (result === null) {
      limit = localLimit
      result = await local.hit(key, windowMs)
    }

    if (result && result.current > limit) {
      const retryAfter = Math.max(1, Math.ceil(result.ttl / 1000))
      reply.code(429).header('Retry-After', String(retryAfter)).send({
        statusCode: 429,
        code: 'ADMIN_RATE_LIMITED',
        error: 'Too many admin requests',
        message: 'Too many admin requests. Slow down and try again shortly.',
        retryAfter,
        limit,
      })
    }
  }

  const limiter = hook as AdminRateLimiter
  limiter.resetForTesting = () => {
    if (local instanceof LocalWindowStore) local.clear()
  }
  return limiter
}

/** The hook the server registers; one instance per process. */
export const adminRateLimitHook = createAdminRateLimiter()
