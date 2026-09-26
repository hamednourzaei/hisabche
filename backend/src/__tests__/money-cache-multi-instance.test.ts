// ============================================
// A money figure is never served from one instance's private memory.
//
// Two instances = the modules loaded twice (vi.resetModules), each with its
// own L1. They share one fake Redis. The scenario is the reported one: a
// payment is recorded on A, the invoice is read on B.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Part 1: MemoryCache (the L1 in front of Redis) ─────────────────────────

const redis = new Map<string, string>()

vi.mock('../services/cache.service', () => ({
  cacheService: {
    isShared: true,
    async get(key: string) {
      const v = redis.get(key)
      return v ? JSON.parse(v) : null
    },
    async set(key: string, value: unknown) {
      redis.set(key, JSON.stringify(value))
      return true
    },
    async delPattern(pattern: string) {
      const prefix = pattern.replace(/\*$/, '')
      for (const k of [...redis.keys()]) if (k.startsWith(prefix)) redis.delete(k)
      return 1
    },
  },
}))
vi.mock('../db', () => ({ supabase: {} }))

async function bootInstance() {
  vi.resetModules()
  const { memoryCache } = await import('../utils/pagination')
  return memoryCache
}

beforeEach(() => redis.clear())

describe('⚠️ a payment on instance A is visible on instance B at once', () => {
  it('money key: B reads the new balance straight after A invalidates', async () => {
    const a = await bootInstance()
    const b = await bootInstance()
    await a.set('invoices:ws1:list', { remaining: 3_000_000 })
    expect(await b.get('invoices:ws1:list')).toEqual({ remaining: 3_000_000 })

    // Payment recorded on A: the figure changes and A invalidates.
    await a.invalidate('invoices:ws1')
    await a.set('invoices:ws1:list', { remaining: 0 })

    expect(await b.get('invoices:ws1:list')).toEqual({ remaining: 0 })
  })

  it("(the defect this closes) a non-money key on B still answers from B's L1", async () => {
    const a = await bootInstance()
    const b = await bootInstance()
    await a.set('invites:ws1', ['old'])
    expect(await b.get('invites:ws1')).toEqual(['old'])
    await a.invalidate('invites:ws1')
    await a.set('invites:ws1', ['new'])
    // Up to 5 s stale: acceptable for an invite list, not for a balance.
    expect(await b.get('invites:ws1')).toEqual(['old'])
  })
})

// ─── Part 2: which keys count as money ──────────────────────────────────────

describe('isMoneyCacheKey', () => {
  it.each([
    'invoice:ws1:/api/invoices/1',
    'invoices:ws1:{}',
    'payments:ws1:x',
    'customer-balance:ws1:/api/customers/1/balance',
    'accounting:ws1:trial',
    'inventory:ws1:/api/inventory',
    'dashboard:ws1:/api/dashboard',
  ])('%s is money', async (key) => {
    const { isMoneyCacheKey } = await import('../utils/money-cache-keys')
    expect(isMoneyCacheKey(key)).toBe(true)
  })

  it.each(['auth:token:abc', 'invites:ws1', 'profile:u1:/api/me', 'invoicesX:ws1', 'invoices'])(
    '%s is not',
    async (key) => {
      const { isMoneyCacheKey } = await import('../utils/money-cache-keys')
      expect(isMoneyCacheKey(key)).toBe(false)
    },
  )

  it('covers every prefix invalidateMoneyCaches clears (one list, not two)', () => {
    const src = readFileSync(join(__dirname, '..', 'utils', 'money-cache.ts'), 'utf8')
    expect(src).toContain("from './money-cache-keys'")
    expect(src).not.toMatch(/const MONEY_CACHE_PREFIXES = \[/)
    expect(src).not.toMatch(/const MEMORY_PREFIXES = \[/)
  })
})

// ─── Part 3: the in-process fallback while Redis is down ────────────────────

describe('⚠️ Redis down: money is not cached at all; the rest still is', () => {
  it('the real CacheService, never connected', async () => {
    vi.resetModules()
    vi.doUnmock('../services/cache.service')
    vi.doMock('ioredis', () => ({
      // A client that never connects: no 'connect' event, so isConnected stays false.
      default: class {
        on() {
          return this
        }
      },
    }))
    const { cacheService } = await import('../services/cache.service')
    expect(cacheService.isShared).toBe(false)

    expect(await cacheService.set('invoice:ws1:/api/invoices/1', { remaining: 5 })).toBe(false)
    expect(await cacheService.get('invoice:ws1:/api/invoices/1')).toBeNull()

    expect(await cacheService.set('auth:token:abc', { user: 'u1' })).toBe(true)
    expect(await cacheService.get('auth:token:abc')).toEqual({ user: 'u1' })

    vi.doUnmock('ioredis')
  })
})
