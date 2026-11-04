// ============================================
// backend/src/__tests__/workspace-profile.test.ts
//
// Owner decision D4 = B: the Business Profile lives on the WORKSPACE and decides which capabilities are on —
// as the second half of an authorization (permission AND capability).
//
// Proved here, with the real middleware and the real resolver (only the database is replaced):
//   · a workspace with no declared profile is never restricted (nobody is locked out by this change);
//   · a declared profile without the capability gets 403 CAPABILITY_NOT_ENABLED and the service is not called;
//   · a declared profile WITH it passes — and still needs the permission (the profile grants nothing);
//   · a failed read is an error, never «undeclared» (that would switch the check off);
//   · changing the profile is admin-only, validated, audited, and writes the profile columns only.
// ============================================

import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { business_types: string[] | null } | null
type DbError = { code: string; message: string } | null

const state: {
  row: Row
  readError: DbError
  writeError: DbError
  updated: Array<Record<string, unknown>>
  updateRows: Array<{ id: string }>
  /** Every table the route reached for, so a test can prove it touched nothing else. */
  tables: string[]
} = {
  row: null,
  readError: null,
  writeError: null,
  updated: [],
  updateRows: [{ id: 'ws-1' }],
  tables: [],
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => {
      state.tables.push(table)
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: state.row, error: state.readError }),
          }),
        }),
        update: (values: Record<string, unknown>) => ({
          eq: () => ({
            select: async () => {
              if (!state.writeError) state.updated.push(values)
              return { data: state.writeError ? null : state.updateRows, error: state.writeError }
            },
          }),
        }),
      }
    },
  },
}))

const holdsCapability = { value: true }
const productService = { createVariant: vi.fn(async () => ({ id: 'v-1' })) }
const unitsService = { replace: vi.fn(async () => ({ units: [] })) }
const warrantyService = { registerWarranty: vi.fn(async () => ({ id: 'w-1' })) }
const loggedEvents: Array<Record<string, unknown>> = []

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: async (request: { user?: unknown }) => {
    request.user = { id: 'u-1' }
  },
}))
vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (request: { tenancy?: unknown }) => {
    request.tenancy = { workspaceId: 'ws-1', userId: 'u-1', role: 'manager' }
  },
}))
vi.mock('../middleware/authorize.middleware', () => ({
  requireCapability:
    () =>
    async (
      _request: unknown,
      reply: { status: (n: number) => { send: (b: unknown) => unknown } },
    ) => {
      if (!holdsCapability.value) return reply.status(403).send({ error: 'FORBIDDEN_PERMISSION' })
      return undefined
    },
}))
vi.mock('../services/product/variant.service', () => ({
  VariantService: class {
    createVariant = productService.createVariant
    getVariants = async () => []
  },
}))
vi.mock('../services/inventory/product-units.service', () => ({
  ProductUnitsService: class {
    replace = unitsService.replace
    list = async () => []
  },
}))
vi.mock('../services/sales/warranty.service', () => ({
  WarrantyService: class {
    registerWarranty = warrantyService.registerWarranty
    getWarranties = async () => []
  },
}))
vi.mock('../services/event-log.service', () => ({
  logBusinessEvent: async (input: Record<string, unknown>) => {
    loggedEvents.push(input)
  },
}))

import { productUnitsRoutes } from '../routes/product-units.routes'
import { variantRoutes } from '../routes/variant.routes'
import { warrantyRoutes } from '../routes/warranty.routes'
import { workspaceProfileRoutes } from '../routes/workspace-profile.routes'
import { workspaceProfileOf } from '../services/workspace-profile'

beforeEach(() => {
  state.row = null
  state.readError = null
  state.writeError = null
  state.updated = []
  state.updateRows = [{ id: 'ws-1' }]
  state.tables = []
  holdsCapability.value = true
  productService.createVariant.mockClear()
  unitsService.replace.mockClear()
  warrantyService.registerWarranty.mockClear()
  loggedEvents.length = 0
})

async function app() {
  const server = Fastify()
  await server.register(variantRoutes)
  await server.register(productUnitsRoutes)
  await server.register(warrantyRoutes)
  await server.register(workspaceProfileRoutes)
  return server
}

const createVariant = async () =>
  (await app()).inject({
    method: 'POST',
    url: '/api/products/p-1/variants',
    payload: { sku: 'S-1', attributes: [{ name: 'size', value: 'M' }] },
  })

describe('workspaceProfileOf', () => {
  it('a workspace that never declared a profile is undeclared', async () => {
    state.row = { business_types: null }
    expect((await workspaceProfileOf('ws-1')).declared).toBe(false)
    state.row = { business_types: [] }
    expect((await workspaceProfileOf('ws-1')).declared).toBe(false)
  })

  it('a database without the migration is undeclared, not an error', async () => {
    state.readError = { code: '42703', message: 'column does not exist' }
    const result = await workspaceProfileOf('ws-1')
    expect(result.declared).toBe(false)
    expect(result.configurable).toBe(false)
  })

  it('any other read failure is an error — it must never read as «undeclared»', async () => {
    state.readError = { code: '08006', message: 'connection failure' }
    await expect(workspaceProfileOf('ws-1')).rejects.toThrow()
  })

  it('a stored profile resolves through the same resolver the screens use', async () => {
    state.row = { business_types: ['clothing'] }
    const result = await workspaceProfileOf('ws-1')
    expect(result.declared).toBe(true)
    expect(result.profile.capabilities).toEqual(['variants'])
    expect(result.profile.partialCapabilities).toEqual(['variants'])
  })
})

describe('requireProfileCapability on POST /api/products/:id/variants', () => {
  it('an undeclared workspace is never restricted', async () => {
    state.row = { business_types: null }
    const res = await createVariant()
    expect(res.statusCode).toBe(201)
    expect(productService.createVariant).toHaveBeenCalledTimes(1)
  })

  it('a declared profile without the capability gets 403 and the service is not called', async () => {
    state.row = { business_types: ['grocery'] }
    const res = await createVariant()
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({ code: 'CAPABILITY_NOT_ENABLED', capability: 'variants' })
    expect(productService.createVariant).not.toHaveBeenCalled()
  })

  it('a declared profile WITH the capability passes', async () => {
    state.row = { business_types: ['clothing'] }
    expect((await createVariant()).statusCode).toBe(201)
  })

  it('the capability does not replace the permission: no permission, no write', async () => {
    state.row = { business_types: ['clothing'] }
    holdsCapability.value = false
    const res = await createVariant()
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('FORBIDDEN_PERMISSION')
    expect(productService.createVariant).not.toHaveBeenCalled()
  })

  it('a failed profile read refuses the request instead of switching the check off', async () => {
    state.readError = { code: '08006', message: 'connection failure' }
    const res = await createVariant()
    expect(res.statusCode).toBeGreaterThanOrEqual(500)
    expect(productService.createVariant).not.toHaveBeenCalled()
  })
})

// ─── The other profile-guarded writes, table-driven (Phase D: every guarded route, four cases) ──────

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111'

const putUnits = async () =>
  (await app()).inject({
    method: 'PUT',
    url: `/api/products/${PRODUCT_ID}/units`,
    payload: { units: [] },
  })

const createWarranty = async () =>
  (await app()).inject({
    method: 'POST',
    url: '/api/warranties',
    payload: {
      invoiceId: '22222222-2222-2222-2222-222222222222',
      productId: PRODUCT_ID,
      startDate: '2026-01-01',
      warrantyMonths: 12,
    },
  })

const GUARDED_ROUTES = [
  {
    label: 'PUT /api/products/:id/units',
    capability: 'multi_unit',
    // grocery carries multi_unit; clothing does not.
    allowed: 'grocery',
    denied: 'clothing',
    run: putUnits,
    okStatus: 200,
    calls: () => unitsService.replace.mock.calls.length,
  },
  {
    label: 'POST /api/warranties',
    capability: 'serialized_items',
    // electronics carries serialized_items; grocery does not.
    allowed: 'electronics',
    denied: 'grocery',
    run: createWarranty,
    okStatus: 201,
    calls: () => warrantyService.registerWarranty.mock.calls.length,
  },
] as const

describe.each(GUARDED_ROUTES)('requireProfileCapability on $label', (route) => {
  it('an undeclared workspace is never restricted', async () => {
    state.row = { business_types: null }
    const res = await route.run()
    expect(res.statusCode).toBe(route.okStatus)
    expect(route.calls()).toBe(1)
  })

  it('a declared profile without the capability gets 403 and the write does not happen', async () => {
    state.row = { business_types: [route.denied] }
    const res = await route.run()
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({
      code: 'CAPABILITY_NOT_ENABLED',
      capability: route.capability,
    })
    expect(route.calls()).toBe(0)
  })

  it('a declared profile WITH the capability passes', async () => {
    state.row = { business_types: [route.allowed] }
    const res = await route.run()
    expect(res.statusCode).toBe(route.okStatus)
    expect(route.calls()).toBe(1)
  })

  it('the profile never replaces the permission: no permission, no write', async () => {
    state.row = { business_types: [route.allowed] }
    holdsCapability.value = false
    const res = await route.run()
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('FORBIDDEN_PERMISSION')
    expect(route.calls()).toBe(0)
  })
})

describe('PUT /api/workspace/profile', () => {
  const put = async (payload: Record<string, unknown>) =>
    (await app()).inject({ method: 'PUT', url: '/api/workspace/profile', payload })

  it('stores the canonical trades, audits the change, and writes the profile columns only', async () => {
    state.row = { business_types: null }
    const res = await put({ businessTypes: ['Clothing', 'clothing'] })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ declared: true, businessTypes: ['clothing'] })
    expect(Object.keys(state.updated[0]!).sort()).toEqual([
      'business_profile_updated_at',
      'business_profile_updated_by',
      'business_types',
    ])
    expect(loggedEvents[0]).toMatchObject({
      entityType: 'workspace_profile',
      action: 'profile_changed',
      workspaceId: 'ws-1',
    })
  })

  it('touches the profile columns and NOTHING else — no roles, grants or history', async () => {
    // D4 = B: the profile is a workspace setting. If changing it also rewrote a role, a permission grant or
    // an invoice, a shop would change the meaning of its own past. The mock records every table the route
    // reached for, so this is a statement about the real code path, not about the intent.
    state.row = { business_types: ['grocery'] }
    const res = await put({ businessTypes: ['clothing'] })
    expect(res.statusCode).toBe(200)
    expect([...new Set(state.tables)]).toEqual(['workspaces'])
  })

  it('needs the workspace-management permission', async () => {
    holdsCapability.value = false
    const res = await put({ businessTypes: ['clothing'] })
    expect(res.statusCode).toBe(403)
    expect(state.updated).toEqual([])
  })

  it('refuses a trade the registry does not know, and an empty list', async () => {
    expect((await put({ businessTypes: ['spaceship'] })).statusCode).toBe(400)
    expect((await put({ businessTypes: [] })).statusCode).toBe(400)
    expect(state.updated).toEqual([])
  })

  it('says so when the migration has not run, and stores nothing', async () => {
    state.writeError = { code: '42703', message: 'column does not exist' }
    const res = await put({ businessTypes: ['clothing'] })
    expect(res.statusCode).toBe(409)
    expect(JSON.stringify(res.json())).toContain('WORKSPACE_PROFILE_NOT_CONFIGURED')
  })

  it('GET tells a member what is on and what is only partial', async () => {
    state.row = { business_types: ['clothing'] }
    const res = await (await app()).inject({ method: 'GET', url: '/api/workspace/profile' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      declared: true,
      capabilities: ['variants'],
      partialCapabilities: ['variants'],
    })
  })
})
