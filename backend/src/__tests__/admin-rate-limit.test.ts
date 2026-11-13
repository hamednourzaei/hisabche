// ============================================
// backend/src/__tests__/admin-rate-limit.test.ts
//
// V63 · S-5 — the console's own budget.
//
// What matters, in the order an incident would care:
//
//  1. the 61st admin request in a window is a 429 (not a 500);
//  2. the non-admin API is untouched by this hook;
//  3. a broken store fails OPEN, never into a 500;
//  4. two credentials do not share a bucket;
//  5. the window really expires.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  ADMIN_RATE_LIMIT_PER_MINUTE,
  createAdminRateLimiter,
  type AdminRateLimitStore,
  type LimiterReply,
  type LimiterRequest,
} from '../middleware/admin-rate-limit.middleware'

interface Recorded {
  statusCode: number | null
  headers: Record<string, string>
  body: Record<string, unknown> | null
}

function fakeReply(recorded: Recorded): LimiterReply {
  const reply: LimiterReply = {
    code(statusCode: number) {
      recorded.statusCode = statusCode
      return reply
    },
    header(name: string, value: string) {
      recorded.headers[name] = value
      return reply
    },
    send(payload: unknown) {
      recorded.body = payload as Record<string, unknown>
      return reply
    },
  }
  return reply
}

function request(overrides: Partial<LimiterRequest> = {}): LimiterRequest {
  return {
    url: '/api/admin/roles',
    ip: '203.0.113.7',
    headers: { authorization: 'Bearer token-a' },
    ...overrides,
  }
}

/** A store that always answers, so the local fallback is not involved. */
function countingStore(): AdminRateLimitStore & { hits: number } {
  const windows = new Map<string, { count: number; ttl: number }>()
  const store = {
    hits: 0,
    async hit(key: string, windowMs: number) {
      store.hits += 1
      const existing = windows.get(key)
      if (!existing) {
        windows.set(key, { count: 1, ttl: windowMs })
        return { current: 1, ttl: windowMs }
      }
      existing.count += 1
      return { current: existing.count, ttl: existing.ttl }
    },
  }
  return store
}

describe('admin rate limiter', () => {
  it('answers 429 on the request after the limit, never 500', async () => {
    const limiter = createAdminRateLimiter({ limit: 3, store: countingStore() })

    for (let i = 0; i < 3; i += 1) {
      const recorded: Recorded = { statusCode: null, headers: {}, body: null }
      await limiter(request(), fakeReply(recorded))
      expect(recorded.statusCode).toBeNull()
    }

    const recorded: Recorded = { statusCode: null, headers: {}, body: null }
    await limiter(request(), fakeReply(recorded))

    expect(recorded.statusCode).toBe(429)
    expect(recorded.body?.code).toBe('ADMIN_RATE_LIMITED')
    expect(recorded.body?.statusCode).toBe(429)
    expect(recorded.headers['Retry-After']).toBeDefined()
    // A retry hint a client can act on, in seconds.
    expect(Number(recorded.headers['Retry-After'])).toBeGreaterThan(0)
  })

  it('leaves the rest of the API alone', async () => {
    const limiter = createAdminRateLimiter({ limit: 1, store: countingStore() })

    for (let i = 0; i < 5; i += 1) {
      const recorded: Recorded = { statusCode: null, headers: {}, body: null }
      await limiter(request({ url: '/api/invoices?page=1' }), fakeReply(recorded))
      expect(recorded.statusCode).toBeNull()
    }
  })

  it('does not treat a path that merely starts with the word as admin', async () => {
    const limiter = createAdminRateLimiter({ limit: 1, store: countingStore() })
    const recorded: Recorded = { statusCode: null, headers: {}, body: null }
    await limiter(request({ url: '/api/administrator' }), fakeReply(recorded))
    expect(recorded.statusCode).toBeNull()
  })

  it('keeps separate buckets per credential', async () => {
    const limiter = createAdminRateLimiter({ limit: 1, store: countingStore() })

    const first: Recorded = { statusCode: null, headers: {}, body: null }
    await limiter(request({ headers: { authorization: 'Bearer token-a' } }), fakeReply(first))
    await limiter(request({ headers: { authorization: 'Bearer token-a' } }), fakeReply(first))
    expect(first.statusCode).toBe(429)

    const second: Recorded = { statusCode: null, headers: {}, body: null }
    await limiter(request({ headers: { authorization: 'Bearer token-b' } }), fakeReply(second))
    expect(second.statusCode).toBeNull()
  })

  it('falls back to a local window when the shared store is broken (no 500)', async () => {
    const brokenStore: AdminRateLimitStore = {
      async hit() {
        throw new Error('redis is down')
      },
    }
    const limiter = createAdminRateLimiter({ limit: 2, store: brokenStore })

    const ok: Recorded = { statusCode: null, headers: {}, body: null }
    await limiter(request(), fakeReply(ok))
    await limiter(request(), fakeReply(ok))
    expect(ok.statusCode).toBeNull()

    const limited: Recorded = { statusCode: null, headers: {}, body: null }
    await limiter(request(), fakeReply(limited))
    expect(limited.statusCode).toBe(429)
  })

  it('expires the local window', async () => {
    let now = 1_000
    const limiter = createAdminRateLimiter({
      limit: 1,
      windowMs: 1_000,
      store: {
        async hit() {
          return null
        },
      },
      now: () => now,
    })

    const first: Recorded = { statusCode: null, headers: {}, body: null }
    await limiter(request(), fakeReply(first))
    await limiter(request(), fakeReply(first))
    expect(first.statusCode).toBe(429)

    now += 1_001

    const after: Recorded = { statusCode: null, headers: {}, body: null }
    await limiter(request(), fakeReply(after))
    expect(after.statusCode).toBeNull()
  })

  it('defaults to the documented budget', () => {
    expect(ADMIN_RATE_LIMIT_PER_MINUTE).toBe(60)
  })
})
