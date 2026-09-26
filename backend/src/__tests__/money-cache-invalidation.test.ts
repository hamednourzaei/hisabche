// Reported: after a full payment the invoice page still showed the whole amount
// as «باقی‌مانده» until a hard refresh. GET /api/invoices/:id is cached by
// cacheMiddleware under `invoice:<workspace>:<url>`; recording a payment cleared
// only `invoices:*`/service caches, and the invoice routes' own clears used key
// shapes (`invoice:<ws>:<id>`, `dashboard:v2:<ws>`) the middleware never writes.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// A Redis that connects. Money keys are cached ONLY in a shared store (never in
// the in-process fallback — utils/money-cache-keys), so without one there would
// be nothing to invalidate and every "is gone" below would pass vacuously.
vi.mock('ioredis', () => {
  const store = new Map<string, string>()
  return {
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
      async set(key: string, value: string) {
        store.set(key, value)
        return 'OK'
      }
      async scan(_cursor: string, _match: string, pattern: string) {
        // Every pattern invalidateMoneyCaches sends is `<prefix>:<ws>:*`.
        if (!pattern.endsWith('*') || pattern.indexOf('*') !== pattern.length - 1) {
          throw new Error(`fake redis: unsupported pattern ${pattern}`)
        }
        const prefix = pattern.slice(0, -1)
        return ['0', [...store.keys()].filter((k) => k.startsWith(prefix))]
      }
      async del(...keys: string[]) {
        let n = 0
        for (const k of keys) if (store.delete(k)) n++
        return n
      }
    },
  }
})

import { cacheService } from '../services/cache.service'
import { MONEY_CACHE_PREFIXES, invalidateMoneyCaches } from '../utils/money-cache'

const SRC = join(__dirname, '..')
const WS = '3f19d3ca-b024-4565-b5e3-47a078585c72'
const OTHER_WS = '11111111-1111-1111-1111-111111111111'

/** The exact key cacheMiddleware writes: `${keyPrefix}:${workspaceId}:${request.url}`. */
const middlewareKey = (prefix: string, ws: string, url: string) => `${prefix}:${ws}:${url}`

describe('invalidateMoneyCaches clears the keys the route cache really writes', () => {
  beforeAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(cacheService.isShared).toBe(true)
  })

  beforeEach(async () => {
    await cacheService.set(
      middlewareKey('invoice', WS, '/api/invoices/abc'),
      { paidAmount: 0 },
      120,
    )
    await cacheService.set(
      middlewareKey('customer-balance', WS, '/api/customers/c1/balance'),
      1,
      60,
    )
    await cacheService.set(middlewareKey('dashboard', WS, '/api/analytics/dashboard'), 1, 30)
    await cacheService.set(middlewareKey('invoice', OTHER_WS, '/api/invoices/zzz'), 1, 120)
  })

  it('the invoice detail response is gone after a payment', async () => {
    expect(await cacheService.get(middlewareKey('invoice', WS, '/api/invoices/abc'))).not.toBeNull()
    await invalidateMoneyCaches(WS)
    expect(await cacheService.get(middlewareKey('invoice', WS, '/api/invoices/abc'))).toBeNull()
    expect(
      await cacheService.get(middlewareKey('customer-balance', WS, '/api/customers/c1/balance')),
    ).toBeNull()
    expect(
      await cacheService.get(middlewareKey('dashboard', WS, '/api/analytics/dashboard')),
    ).toBeNull()
  })

  it('another workspace keeps its cache', async () => {
    await invalidateMoneyCaches(WS)
    expect(
      await cacheService.get(middlewareKey('invoice', OTHER_WS, '/api/invoices/zzz')),
    ).not.toBeNull()
  })
})

describe('every money-bearing route cache is covered', () => {
  const routeDir = join(SRC, 'routes')
  const prefixes = new Map<string, string>()
  for (const file of readdirSync(routeDir)) {
    const src = readFileSync(join(routeDir, file), 'utf8')
    for (const m of src.matchAll(/keyPrefix: '([^']+)'/g)) prefixes.set(m[1]!, file)
  }

  // Route files whose cached responses carry invoice, payment, balance,
  // ledger or stock figures that a payment or an invoice change moves.
  const MONEY_ROUTES = new Set([
    'invoice.routes.ts',
    'payments.routes.ts',
    'customer.routes.ts',
    'accounting.routes.ts',
    'transaction.routes.ts',
    'analytics.routes.ts',
    'ai.routes.ts',
    'inventory-costing.routes.ts',
    'product.routes.ts',
    'warehouse.routes.ts',
  ])

  it('lists each prefix from those routes', () => {
    const missing = [...prefixes]
      .filter(([, file]) => MONEY_ROUTES.has(file))
      .map(([prefix]) => prefix)
      .filter((prefix) => !(MONEY_CACHE_PREFIXES as readonly string[]).includes(prefix))
    expect(missing).toEqual([])
  })

  it('invoice and payment writes use the shared invalidation, not hand-written keys', () => {
    const invoiceRoutes = readFileSync(join(routeDir, 'invoice.routes.ts'), 'utf8')
    expect(invoiceRoutes).not.toMatch(/clearCache\(`(invoice|invoices|dashboard:v2|insights):/)
    expect(invoiceRoutes).toContain('invalidateMoneyCaches(workspaceId)')
    const payments = readFileSync(join(SRC, 'services/payments/payments.service.ts'), 'utf8')
    expect(payments).toContain('invalidateMoneyCaches(workspaceId)')
  })
})
