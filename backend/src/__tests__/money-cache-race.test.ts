// ============================================
// The cache-aside race on money figures, reproduced step by step against the
// real CacheService (Redis replaced by an in-memory one that connects).
//
//   A: miss → reads Postgres (unpaid)          ┐ A is slow
//   B: records the payment → commits → invalidates
//   A: writes what it read (UNPAID)            ┘
//   anyone: reads the cache → must NOT get «unpaid»
// ============================================

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()

vi.mock('ioredis', () => ({
  default: class {
    on(event: string, cb: () => void) {
      if (event === 'connect') setTimeout(cb, 0)
      return this
    }
    async get(key: string) {
      return store.get(key) ?? null
    }
    async mget(...keys: string[]) {
      return keys.map((k) => store.get(k) ?? null)
    }
    async set(key: string, value: string) {
      store.set(key, value)
      return 'OK'
    }
    async del(...keys: string[]) {
      let n = 0
      for (const k of keys) if (store.delete(k)) n++
      return n
    }
    async scan(_c: string, _m: string, pattern: string) {
      const prefix = pattern.replace(/\*$/, '')
      return [
        '0',
        [...store.keys()].filter((k) =>
          pattern.endsWith('*') ? k.startsWith(prefix) : k === pattern,
        ),
      ]
    }
    multi() {
      const ops: Array<() => void> = []
      const chain = {
        incr: (k: string) => {
          ops.push(() => store.set(k, String(Number(store.get(k) ?? '0') + 1)))
          return chain
        },
        expire: () => chain,
        exec: async () => ops.forEach((op) => op()),
      }
      return chain
    }
  },
}))

const { cacheService } = await import('../services/cache.service')
const { invalidateMoneyCaches } = await import('../utils/money-cache')

const WS = '3f19d3ca-b024-4565-b5e3-47a078585c72'
const KEY = `invoice:${WS}:/api/invoices/abc`

beforeAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  expect(cacheService.isShared).toBe(true)
})
// Entries go between tests; the generations stay — in Redis they only ever
// grow, and resetting them here would be a state production never reaches.
beforeEach(() => {
  for (const k of [...store.keys()]) if (!k.startsWith('money-gen:')) store.delete(k)
})

describe('⚠️ a read that started before a payment cannot cache the pre-payment figure', () => {
  it("invalidateMoneyCaches: the slow read's late write is never served", async () => {
    expect(await cacheService.get(KEY)).toBeNull() // A misses, goes to Postgres
    await invalidateMoneyCaches(WS) // B: payment committed
    await cacheService.set(KEY, { remaining: 3_000_000 }, 120) // A writes the OLD figure
    expect(await cacheService.get(KEY)).toBeNull()
  })

  it("the same through a route's own clearCache / a service's invalidate (not invalidateMoneyCaches)", async () => {
    expect(await cacheService.get(`products:${WS}:/api/products`)).toBeNull()
    await cacheService.delPattern(`products:${WS}:*`)
    await cacheService.set(`products:${WS}:/api/products`, { stock: 5 }, 120)
    expect(await cacheService.get(`products:${WS}:/api/products`)).toBeNull()
  })

  it('a key with the workspace in the THIRD segment is scoped the same way', async () => {
    const key = `customer:balance:${WS}:c1`
    expect(await cacheService.get(key)).toBeNull()
    await invalidateMoneyCaches(WS)
    await cacheService.set(key, { balance: 10 }, 60)
    expect(await cacheService.get(key)).toBeNull()
  })
})

describe('without a write in between, caching still works', () => {
  // Own keys: the race tests above end on a miss, and a miss is remembered
  // conservatively (see getMoney) — the next write to THAT key is spent.
  it('miss → set → hit', async () => {
    const key = `invoice:${WS}:/api/invoices/fresh-1`
    expect(await cacheService.get(key)).toBeNull()
    await cacheService.set(key, { remaining: 0 }, 120)
    expect(await cacheService.get(key)).toEqual({ remaining: 0 })
  })

  it('after a payment, the NEXT read caches the new figure and it is served', async () => {
    const key = `invoice:${WS}:/api/invoices/fresh-2`
    await invalidateMoneyCaches(WS)
    expect(await cacheService.get(key)).toBeNull()
    await cacheService.set(key, { remaining: 0 }, 120)
    expect(await cacheService.get(key)).toEqual({ remaining: 0 })
  })

  it("another workspace's money is not invalidated", async () => {
    const other = '11111111-1111-1111-1111-111111111111'
    const otherKey = `invoice:${other}:/api/invoices/zzz`
    await cacheService.get(otherKey)
    await cacheService.set(otherKey, { remaining: 7 }, 120)
    await invalidateMoneyCaches(WS)
    expect(await cacheService.get(otherKey)).toEqual({ remaining: 7 })
  })

  it('non-money keys are untouched by all of this', async () => {
    await cacheService.set('auth:abc', { user: 'u1' }, 60)
    await invalidateMoneyCaches(WS)
    expect(await cacheService.get('auth:abc')).toEqual({ user: 'u1' })
  })
})
