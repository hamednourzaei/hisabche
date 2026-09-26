// ============================================
// One rate-limit budget across every backend instance.
//
// Two "instances" = two Fastify apps, each with its own module state (the
// plugin's default store would be a Map in each). They share one fake Redis,
// as two Render instances share the real one. Driven through the real
// @fastify/rate-limit plugin with server.inject — not by calling the store.
// ============================================

import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const redis = new Map<string, { count: number; expiresAt: number }>()
let redisUp = true

vi.mock('../services/cache.service', () => ({
  cacheService: {
    async rateLimitHit(key: string, windowMs: number) {
      if (!redisUp) return null
      const now = Date.now()
      let entry = redis.get(key)
      if (!entry || entry.expiresAt <= now) {
        entry = { count: 0, expiresAt: now + windowMs }
        redis.set(key, entry)
      }
      entry.count++
      return { current: entry.count, ttl: entry.expiresAt - now }
    },
  },
}))

async function bootInstance(opts: { instances?: string } = {}) {
  vi.resetModules()
  if (opts.instances === undefined) delete process.env.RATE_LIMIT_INSTANCE_COUNT
  else process.env.RATE_LIMIT_INSTANCE_COUNT = opts.instances
  const { SharedRateLimitStore } = await import('../utils/shared-rate-limit-store')
  const app = Fastify()
  await app.register(rateLimit, { store: SharedRateLimitStore, max: 100, timeWindow: '1 minute' })
  app.post(
    '/api/auth/login',
    {
      config: {
        rateLimit: { max: 3, timeWindow: '1 minute', keyGenerator: () => 'same-attacker' },
      },
    },
    async () => ({ ok: true }),
  )
  app.get(
    '/api/other',
    {
      config: {
        rateLimit: { max: 3, timeWindow: '1 minute', keyGenerator: () => 'same-attacker' },
      },
    },
    async () => ({ ok: true }),
  )
  await app.ready()
  return app
}

const login = (app: Awaited<ReturnType<typeof bootInstance>>) =>
  app.inject({ method: 'POST', url: '/api/auth/login' }).then((r) => r.statusCode)

beforeEach(() => {
  redis.clear()
  redisUp = true
})

describe('⚠️ Redis up: N instances share ONE budget', () => {
  it('3 attempts/min means 3 in total across two instances, not 3 each', async () => {
    const a = await bootInstance()
    const b = await bootInstance()
    expect([await login(a), await login(b), await login(a)]).toEqual([200, 200, 200])
    // The 4th — on either instance — is refused.
    expect(await login(b)).toBe(429)
    expect(await login(a)).toBe(429)
  })

  it('a route with its own limit keeps its own count', async () => {
    const a = await bootInstance()
    for (let i = 0; i < 3; i++) await login(a)
    expect((await a.inject({ method: 'GET', url: '/api/other' })).statusCode).toBe(200)
  })
})

describe('Redis down: still limited, never wide open, never an outage', () => {
  it('one instance (default): the configured limit, exactly', async () => {
    redisUp = false
    const a = await bootInstance()
    expect([await login(a), await login(a), await login(a), await login(a)]).toEqual([
      200, 200, 200, 429,
    ])
  })

  it('RATE_LIMIT_INSTANCE_COUNT=3: each instance spends its budget 3× faster, so three stay near the limit', async () => {
    redisUp = false
    const a = await bootInstance({ instances: '3' })
    // 1×3 = 3 ≤ 3 allowed; 2×3 = 6 > 3 refused.
    expect([await login(a), await login(a)]).toEqual([200, 429])
  })

  it('a nonsense instance count falls back to 1, not to "no limit"', async () => {
    redisUp = false
    const a = await bootInstance({ instances: 'abc' })
    expect([await login(a), await login(a), await login(a), await login(a)]).toEqual([
      200, 200, 200, 429,
    ])
  })
})

describe('configuration', () => {
  it('refuses options it would otherwise silently ignore', async () => {
    const { SharedRateLimitStore } = await import('../utils/shared-rate-limit-store')
    expect(() => new SharedRateLimitStore({ continueExceeding: true })).toThrow(/not support/)
  })

  it('the server registers the shared store', () => {
    const src = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8')
    expect(src).toMatch(/register\(rateLimit, \{[\s\S]{0,200}store: SharedRateLimitStore/)
  })
})
