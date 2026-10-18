// ============================================
// GET /api/products?warehouseId= — the invoice picker's list, scoped by the
// SERVER (owner, 18 Oct 2026). Before, the browser narrowed a page of 100
// products to the chosen warehouse, so a warehouse's 101st product was never
// offered; and a purchase into «حاجی» listed the whole catalogue under its name.
//
// Two warehouses, a product in both, one only in A, one only in B, one
// workspace's warehouse used from another, and a branch-restricted member.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_WS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const A = '0000000a-0000-4000-8000-00000000000a'
const B = '0000000b-0000-4000-8000-00000000000b'
const FOREIGN = '0000000f-0000-4000-8000-00000000000f'
const LOCKED = '0000000c-0000-4000-8000-00000000000c'

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
/** Every `.in('id', …)` list the products read sent — for the URL-size rule. */
const inLists: number[] = []

function builder(table: string) {
  let rows = [...(tables[table] ?? [])]
  let single = false
  const api = {
    select: () => api,
    eq: (col: string, value: unknown) => ((rows = rows.filter((r) => r[col] === value)), api),
    is: (col: string, value: unknown) => (
      (rows = rows.filter((r) => (r[col] ?? null) === value)),
      api
    ),
    in: (col: string, values: unknown[]) => {
      if (table === 'products') inLists.push(values.length)
      rows = rows.filter((r) => values.includes(r[col]))
      return api
    },
    ilike: (col: string, pattern: string) => {
      const needle = pattern.replace(/%/g, '').toLowerCase()
      rows = rows.filter((r) =>
        String(r[col] ?? '')
          .toLowerCase()
          .includes(needle),
      )
      return api
    },
    or: (expr: string) => {
      const needle = /name\.ilike\.%(.*?)%/.exec(expr)?.[1]?.toLowerCase() ?? ''
      rows = rows.filter((r) =>
        String(r.name ?? '')
          .toLowerCase()
          .includes(needle),
      )
      return api
    },
    order: () => api,
    range: (from: number, to: number) => ((rows = rows.slice(from, to + 1)), api),
    maybeSingle: () => ((single = true), api),
    then: (resolve: (value: unknown) => unknown) =>
      resolve({ data: single ? (rows[0] ?? null) : rows, error: null }),
  }
  return api
}

vi.mock('../db', () => ({ supabase: { from: (table: string) => builder(table) } }))
vi.mock('../utils/pagination', () => ({
  memoryCache: { get: async () => null, set: async () => undefined, del: async () => undefined },
}))
const assertMayUseWarehouse = vi.fn(async (_ctx: unknown, id: string, code: string) => {
  // The branch rule refuses this one for this member.
  if (id === LOCKED) {
    const { ForbiddenError } = await import('../errors/auth.error')
    throw new ForbiddenError(code)
  }
})
vi.mock('../services/inventory/warehouse-access', () => ({ assertMayUseWarehouse }))

const { ProductService } = await import('../services/product.service')
const ctx = { workspaceId: WS, userId: 'u', role: 'owner' } as never

const product = (id: string, name: string, ws = WS): Row => ({
  id,
  workspace_id: ws,
  name,
  quantity: 0,
  created_at: `2026-10-${String(10 + (Number(id.slice(-2)) % 10)).padStart(2, '0')}T00:00:00Z`,
})

beforeEach(() => {
  inLists.length = 0
  assertMayUseWarehouse.mockClear()
  tables.warehouses = [
    { id: A, workspace_id: WS, deleted_at: null },
    { id: B, workspace_id: WS, deleted_at: null },
    { id: LOCKED, workspace_id: WS, deleted_at: null },
    { id: FOREIGN, workspace_id: OTHER_WS, deleted_at: null },
  ]
  tables.products = [
    product('p-01', 'گیربوکس اتوماتیک'),
    product('p-02', 'موتور سر سیلندر'),
    product('p-03', 'بستنی وانیل'),
    product('p-04', 'شیر'),
    product('p-99', 'کالای کسب‌وکار دیگر', OTHER_WS),
  ]
  tables.warehouse_stock = [
    { workspace_id: WS, warehouse_id: A, product_id: 'p-01', quantity: 8 },
    { workspace_id: WS, warehouse_id: B, product_id: 'p-01', quantity: 0 },
    { workspace_id: WS, warehouse_id: A, product_id: 'p-02', quantity: 5 },
    { workspace_id: WS, warehouse_id: B, product_id: 'p-03', quantity: 16 },
    { workspace_id: OTHER_WS, warehouse_id: FOREIGN, product_id: 'p-99', quantity: 3 },
  ]
})

const list = (warehouseId: string, extra: Record<string, unknown> = {}) =>
  new ProductService().list(ctx, { warehouseId, limit: 20, page: 1, search: '', ...extra } as never)
const ids = (result: unknown) =>
  (result as { products: Array<{ id: string }> }).products.map((row) => row.id).sort()

describe('a warehouse-scoped product list', () => {
  it('A lists only A; B lists only B; a product in both is in both', async () => {
    expect(ids(await list(A))).toEqual(['p-01', 'p-02'])
    expect(ids(await list(B))).toEqual(['p-01', 'p-03'])
  })

  it('a product only in A is not in B, and a product nowhere is in neither', async () => {
    expect(ids(await list(B))).not.toContain('p-02')
    expect(ids(await list(A))).not.toContain('p-04')
    expect(ids(await list(B))).not.toContain('p-04')
  })

  it('search keeps the scope, and total is the warehouse count', async () => {
    expect(ids(await list(B, { search: 'بستنی' }))).toEqual(['p-03'])
    expect(ids(await list(A, { search: 'بستنی' }))).toEqual([])
    const result = (await list(A)) as { total: number }
    expect(result.total).toBe(2)
  })

  it('pages over the WHOLE warehouse — the 101st product is reachable', async () => {
    tables.products = Array.from({ length: 230 }, (_, i) =>
      product(`q-${String(i).padStart(3, '0')}`, `کالا ${i}`),
    )
    tables.warehouse_stock = tables.products.map((row) => ({
      workspace_id: WS,
      warehouse_id: A,
      product_id: row.id,
      quantity: 1,
    }))
    const first = (await list(A, { limit: 100, page: 1 })) as { total: number; hasMore: boolean }
    const third = (await list(A, { limit: 100, page: 3 })) as {
      products: unknown[]
      hasMore: boolean
    }
    expect(first.total).toBe(230)
    expect(first.hasMore).toBe(true)
    expect(third.products).toHaveLength(30)
    expect(third.hasMore).toBe(false)
    // Read in chunks small enough for a URL.
    expect(Math.max(...inLists)).toBeLessThanOrEqual(150)
  })

  it('another business’s warehouse id is refused, not «an empty list»', async () => {
    await expect(list(FOREIGN)).rejects.toThrow('PRODUCT_WAREHOUSE_NOT_FOUND')
  })

  it('a warehouse of a branch this member may not use is refused (the branch rule)', async () => {
    await expect(list(LOCKED)).rejects.toThrow('PRODUCT_WAREHOUSE_NOT_PERMITTED')
    expect(assertMayUseWarehouse).toHaveBeenCalledWith(
      ctx,
      LOCKED,
      'PRODUCT_WAREHOUSE_NOT_PERMITTED',
    )
  })

  it('reading writes nothing: no stock, movement or ledger table is touched', async () => {
    const before = JSON.stringify(tables)
    await list(A)
    await list(B, { search: 'شیر' })
    expect(JSON.stringify(tables)).toBe(before)
  })
})
