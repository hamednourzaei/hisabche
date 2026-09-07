// ============================================
// T4 — /manufacturing returned 500, and the fallback that stops it.
//
// THE DEFECT: `boms.product_id` and `work_orders.product_id` were declared as
// bare `uuid` columns with no FOREIGN KEY. PostgREST builds embeds from the FK
// graph, so `product:products(...)` could not resolve and it answered PGRST200
// — which the service turned into a 500 and the whole page died on.
//
// What is pinned here:
//
//   1. PGRST200 falls back instead of throwing.
//   2. A DIFFERENT error still throws. A fallback that swallows every failure
//      would hide a real outage behind a half-empty page.
//   3. ⚠️ THE FALLBACK FILTERS `products` BY WORKSPACE ITSELF. The embed
//      inherited the parent's filter; a hand-written join does not. Fetching
//      by `id IN (…)` alone would return another tenant's product name.
//
// Point 3 is the reason this file exists. The 500 was an availability bug; a
// join that forgot the workspace would be a cross-tenant leak.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── The supabase mock ───
//
// Records every table touched and every filter applied, so the assertions can
// be about the QUERY rather than about a fixture.

interface Call {
  table: string
  filters: Array<{ op: string; column: string; value: unknown }>
}

const calls: Call[] = []

/** Set per test: what `.from(table)` should resolve to. */
let responses: Record<string, { data: unknown; error: { code: string } | null }> = {}

function builder(table: string) {
  const call: Call = { table, filters: [] }
  calls.push(call)

  const chain: Record<string, unknown> = {}
  const record = (op: string) => (column: string, value: unknown) => {
    call.filters.push({ op, column, value })
    return chain
  }

  Object.assign(chain, {
    select: () => chain,
    eq: record('eq'),
    in: record('in'),
    order: () => chain,
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(responses[table] ?? { data: [], error: null }).then(resolve),
  })
  return chain
}

vi.mock('../db', () => ({
  supabase: { from: (table: string) => builder(table) },
}))

vi.mock('../utils/pagination', () => ({
  memoryCache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    invalidate: vi.fn(async () => undefined),
  },
}))

const { ManufacturingService } = await import('../services/manufacturing.service')

const WORKSPACE = '11111111-1111-1111-1111-111111111111'
const OTHER_WORKSPACE = '22222222-2222-2222-2222-222222222222'
const ctx = { workspaceId: WORKSPACE, userId: 'user-1', role: 'owner' } as never

const PGRST200 = { code: 'PGRST200' }

beforeEach(() => {
  calls.length = 0
  responses = {}
})

describe('GET /api/boms survives the missing foreign key', () => {
  it('falls back instead of throwing when the embed cannot resolve', async () => {
    let bomsSeen = 0
    responses = {
      // First `boms` call is the embedded query and fails; the flat re-query
      // is a second call to the same table.
      get boms() {
        bomsSeen += 1
        return bomsSeen === 1
          ? { data: null, error: PGRST200 }
          : { data: [{ id: 'bom-1', product_id: 'prod-1' }], error: null }
      },
      bom_items: {
        data: [{ id: 'item-1', bom_id: 'bom-1', raw_material_id: 'prod-2' }],
        error: null,
      },
      products: {
        data: [
          { id: 'prod-1', name: 'انگشتر', unit: 'gram' },
          { id: 'prod-2', name: 'طلای خام', unit: 'gram' },
        ],
        error: null,
      },
    }

    const result = (await new ManufacturingService().listBoms(ctx)) as Array<{
      product: { name: string } | null
      items: Array<{ raw_material: { name: string } | null }>
    }>

    expect(result).toHaveLength(1)
    // The shape must be identical to the embedded query's, or the client has
    // to know which path served it.
    expect(result[0]!.product?.name).toBe('انگشتر')
    expect(result[0]!.items[0]!.raw_material?.name).toBe('طلای خام')
  })

  it('⚠️ re-applies the workspace filter on the hand-written product join', async () => {
    let bomsSeen = 0
    responses = {
      get boms() {
        bomsSeen += 1
        return bomsSeen === 1
          ? { data: null, error: PGRST200 }
          : { data: [{ id: 'bom-1', product_id: 'prod-1' }], error: null }
      },
      bom_items: { data: [], error: null },
      products: { data: [], error: null },
    }

    await new ManufacturingService().listBoms(ctx)

    const productQuery = calls.find((c) => c.table === 'products')
    expect(productQuery, 'the fallback must query products').toBeDefined()

    const workspaceFilter = productQuery!.filters.find(
      (f) => f.op === 'eq' && f.column === 'workspace_id',
    )
    // Without this the join returns any product whose id was supplied —
    // including one belonging to another tenant.
    expect(workspaceFilter, 'products must be filtered by workspace').toBeDefined()
    expect(workspaceFilter!.value).toBe(WORKSPACE)
    expect(workspaceFilter!.value).not.toBe(OTHER_WORKSPACE)
  })

  it('every table the fallback reads is workspace-filtered', async () => {
    let bomsSeen = 0
    responses = {
      get boms() {
        bomsSeen += 1
        return bomsSeen === 1
          ? { data: null, error: PGRST200 }
          : { data: [{ id: 'bom-1', product_id: 'prod-1' }], error: null }
      },
      bom_items: { data: [], error: null },
      products: { data: [], error: null },
    }

    await new ManufacturingService().listBoms(ctx)

    // The first `boms` call is the failed embedded query — it was filtered
    // too, but the ones that matter are the re-queries.
    for (const call of calls.slice(1)) {
      const filtered = call.filters.some((f) => f.op === 'eq' && f.column === 'workspace_id')
      expect(filtered, `${call.table} was read without a workspace filter`).toBe(true)
    }
  })

  it('a real database error still throws — the fallback is not a catch-all', async () => {
    responses = { boms: { data: null, error: { code: '08006' } } }
    // A dropped connection must surface as a failure, not as an empty page
    // that looks like «this shop has no bills of materials».
    await expect(new ManufacturingService().listBoms(ctx)).rejects.toThrow()
  })
})

describe('GET /api/work-orders survives the missing foreign key', () => {
  it('falls back and still names the product and the BOM version', async () => {
    let seen = 0
    responses = {
      get work_orders() {
        seen += 1
        return seen === 1
          ? { data: null, error: PGRST200 }
          : {
              data: [{ id: 'wo-1', product_id: 'prod-1', bom_id: 'bom-1', quantity: 5 }],
              error: null,
            }
      },
      products: { data: [{ id: 'prod-1', name: 'انگشتر', unit: 'gram' }], error: null },
      boms: { data: [{ id: 'bom-1', version: 2 }], error: null },
    }

    const result = (await new ManufacturingService().listWorkOrders(ctx)) as Array<{
      product: { name: string } | null
      bom: { version: number } | null
    }>

    expect(result[0]!.product?.name).toBe('انگشتر')
    expect(result[0]!.bom?.version).toBe(2)
  })

  it('a product id that resolves to nothing reads as null, never as a guess', async () => {
    let seen = 0
    responses = {
      get work_orders() {
        seen += 1
        return seen === 1
          ? { data: null, error: PGRST200 }
          : { data: [{ id: 'wo-1', product_id: 'gone', bom_id: null }], error: null }
      },
      // Empty: the id belongs to another workspace, or the product is deleted.
      products: { data: [], error: null },
    }

    const result = (await new ManufacturingService().listWorkOrders(ctx)) as Array<{
      product: unknown
    }>

    // Guardrail 12 — an unknown stays unknown. Substituting a placeholder name
    // here is how a foreign product's name would reach the screen.
    expect(result[0]!.product).toBeNull()
  })

  it('a real database error still throws', async () => {
    responses = { work_orders: { data: null, error: { code: '42501' } } }
    await expect(new ManufacturingService().listWorkOrders(ctx)).rejects.toThrow()
  })
})
