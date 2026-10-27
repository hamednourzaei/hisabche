// ============================================
// An UNSET list filter is NO filter — over real HTTP (`fastify.inject`).
//
// «در انبار ۱۰ گرم طلا دارم و فاکتور می‌گوید کالایی پیدا نشد» (26 Oct 2026): the
// device turned an unset `isActive` into `''`, the route read `'' === 'true'` as
// false, and the list became «inactive products only». The same shape was one
// `=== 'true'` away on the server (suppliers), and `z.coerce.boolean()` reads the
// text 'false' as TRUE (activity feed).
//
// The ROUTES run for real; the services stand in and record the filters they
// were handed — which is exactly what must not be wrong.
// ============================================

import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const { seen } = vi.hoisted(() => ({
  seen: {
    product: [] as Array<{ tenancy: unknown; filters: Record<string, unknown> }>,
    customer: [] as Array<{ tenancy: unknown; filters: Record<string, unknown> }>,
    supplier: [] as Array<{ tenancy: unknown; filters: Record<string, unknown> }>,
    activity: [] as Array<Record<string, unknown>>,
  },
}))

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: async (request: { userId?: string }) => {
    request.userId = 'u1'
  },
}))
vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (request: { tenancy?: unknown }) => {
    request.tenancy = { workspaceId: WS, userId: 'u1', role: 'owner' }
  },
}))
vi.mock('../middleware/authorize.middleware', () => ({
  requireCapability: () => async () => undefined,
}))
vi.mock('../middleware/cache.middleware', () => ({
  cacheMiddleware: () => async () => undefined,
  clearCache: async () => undefined,
}))
vi.mock('../utils/money-cache', () => ({ invalidateMoneyCaches: () => undefined }))
vi.mock('../services/product.service', () => ({
  ProductService: class {
    list(tenancy: unknown, filters: Record<string, unknown>) {
      seen.product.push({ tenancy, filters })
      return { products: [], total: 0 }
    }
  },
}))
vi.mock('../services/inventory/stock-history.service', () => ({
  StockHistoryService: class {},
}))
vi.mock('../services/customer.service', () => ({
  CustomerService: class {
    list(tenancy: unknown, filters: Record<string, unknown>) {
      seen.customer.push({ tenancy, filters })
      return { customers: [], total: 0 }
    }
  },
}))
vi.mock('../services/supplier', () => ({
  SupplierService: class {
    list(tenancy: unknown, filters: Record<string, unknown>) {
      seen.supplier.push({ tenancy, filters })
      return { suppliers: [], total: 0 }
    }
  },
}))
vi.mock('../services/activity.service', () => ({
  ActivityReadsNotConfiguredError: class extends Error {},
  ActivityService: class {
    getActivities(_tenancy: unknown, filters: Record<string, unknown>) {
      seen.activity.push(filters)
      return { activities: [], total: 0 }
    }
  },
}))

const { productRoutes } = await import('../routes/product.routes')
const { customerRoutes } = await import('../routes/customer.routes')
const { supplierRoutes } = await import('../routes/supplier.routes')
const { activityRoutes } = await import('../routes/activity.routes')

let app: FastifyInstance

beforeEach(async () => {
  seen.product.length = 0
  seen.customer.length = 0
  seen.supplier.length = 0
  seen.activity.length = 0
  app = Fastify()
  await app.register(productRoutes)
  await app.register(customerRoutes)
  await app.register(supplierRoutes, { prefix: '/api/suppliers' })
  await app.register(activityRoutes)
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

const get = (url: string) => app.inject({ method: 'GET', url })

/** Every spelling of «nobody set this» a client can put on a URL. */
const UNSET = ['', '=', '=undefined', '=null', '=NULL', '= ']

describe('GET /api/products — unset is no filter, false is false', () => {
  for (const suffix of ['', ...UNSET.slice(1).map((u) => `?isActive${u}`)]) {
    it(`"${suffix || '(no query)'}" → no isActive filter`, async () => {
      const res = await get(`/api/products${suffix}`)
      expect(res.statusCode).toBe(200)
      expect(seen.product).toHaveLength(1)
      expect(seen.product[0]!.filters.isActive).toBeUndefined()
    })
  }

  it('lowStock and includeSummary follow the same rule', async () => {
    await get('/api/products?lowStock=&includeSummary=undefined&isActive=')
    const filters = seen.product[0]!.filters
    expect(filters.lowStock).toBeUndefined()
    expect(filters.includeSummary).toBeUndefined()
    expect(filters.isActive).toBeUndefined()
  })

  it('explicit false means «inactive only»; explicit true means «active only»', async () => {
    await get('/api/products?isActive=false&lowStock=false')
    await get('/api/products?isActive=true&lowStock=true&includeSummary=true')
    expect(seen.product[0]!.filters).toMatchObject({ isActive: false, lowStock: false })
    expect(seen.product[1]!.filters).toMatchObject({
      isActive: true,
      lowStock: true,
      includeSummary: true,
    })
  })

  it('an unset warehouse is not a scope; a real one still is; the workspace is never optional', async () => {
    await get('/api/products?warehouseId=')
    await get('/api/products?warehouseId=33333333-3333-4333-8333-333333333333')
    expect(seen.product[0]!.filters.warehouseId).toBeUndefined()
    expect(seen.product[1]!.filters.warehouseId).toBe('33333333-3333-4333-8333-333333333333')
    // Security scope comes from the authenticated context, whatever the query says.
    for (const call of seen.product) {
      expect(call.tenancy).toMatchObject({ workspaceId: WS })
    }
  })
})

describe('GET /api/customers', () => {
  it('unset isActive / hasBalance are no filter', async () => {
    await get('/api/customers?isActive=&hasBalance=null')
    expect(seen.customer[0]!.filters.isActive).toBeUndefined()
    expect(seen.customer[0]!.filters.hasBalance).toBeUndefined()
  })

  it('explicit values still filter', async () => {
    await get('/api/customers?isActive=false&hasBalance=true')
    expect(seen.customer[0]!.filters).toMatchObject({ isActive: false, hasBalance: true })
    expect(seen.customer[0]!.tenancy).toMatchObject({ workspaceId: WS })
  })
})

describe('GET /api/suppliers — the one that read «' + "'' === 'true'" + '» as false', () => {
  for (const suffix of ['?isActive=', '?isActive=undefined', '?isActive=null', '']) {
    it(`"${suffix || '(no query)'}" → every supplier`, async () => {
      const res = await get(`/api/suppliers${suffix}`)
      expect(res.statusCode).toBe(200)
      expect('isActive' in seen.supplier[0]!.filters).toBe(false)
    })
  }

  it('explicit false is «inactive only», explicit true is «active only»', async () => {
    await get('/api/suppliers?isActive=false')
    await get('/api/suppliers?isActive=true')
    expect(seen.supplier[0]!.filters).toMatchObject({ isActive: false })
    expect(seen.supplier[1]!.filters).toMatchObject({ isActive: true })
    expect(seen.supplier[0]!.tenancy).toMatchObject({ workspaceId: WS })
  })
})

describe('GET /api/v1/activities — `z.coerce.boolean()` read the text «false» as TRUE', () => {
  it('unset unread is no filter; false is «read ones»; true is «unread ones»', async () => {
    await get('/api/v1/activities')
    await get('/api/v1/activities?unread=')
    await get('/api/v1/activities?unread=false')
    await get('/api/v1/activities?unread=true')
    expect(seen.activity.map((f) => f.unread)).toEqual([undefined, undefined, false, true])
  })
})
