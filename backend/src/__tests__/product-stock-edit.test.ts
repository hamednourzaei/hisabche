// A stock edit on the product page is an adjustment movement, never a direct
// write to products.quantity (Phase C projection).
import { beforeEach, describe, expect, it, vi } from 'vitest'

const writes: Array<{ table: string; op: string; row?: any }> = []
let currentQuantity = -98
/** The workspace's live warehouses, as `warehouses … .is('deleted_at', null)` answers. */
let warehouses: Array<{ id: string; name: string; location: null; is_active: boolean }> = []

vi.mock('../db', () => {
  const builder = (table: string) => {
    let op = 'select'
    let row: any
    const q: any = {
      select: () => q,
      insert: (r: any) => (
        (op = 'insert'),
        (row = r),
        writes.push({ table, op, row: r }),
        Promise.resolve({ error: null })
      ),
      update: (r: any) => ((op = 'update'), (row = r), writes.push({ table, op, row: r }), q),
      eq: () => q,
      in: () => q,
      is: () => Promise.resolve({ data: table === 'warehouses' ? warehouses : [], error: null }),
      maybeSingle: async () => ({ data: { quantity: currentQuantity }, error: null }),
      single: async () => ({
        data: { id: 'p1', name: 'x', quantity: currentQuantity, ...row },
        error: null,
      }),
    }
    return q
  }
  const supabase = { from: (t: string) => builder(t) }
  return { supabase, default: supabase }
})
vi.mock('../services/authorization/scope.service', () => ({
  scopes: { assertMay: async () => undefined },
}))

const ctx = { workspaceId: 'ws', userId: 'u', role: 'owner' } as any

beforeEach(() => {
  writes.length = 0
  currentQuantity = -98
  warehouses = []
})

const wh = (id: string) => ({ id, name: id, location: null, is_active: true })

describe('ProductService.update — stock', () => {
  it('−98 → 99 records ONE adjustment of +197 and never writes products.quantity', async () => {
    const { ProductService } = await import('../services/product.service')
    await new ProductService().update('p1', ctx, { id: 'p1', quantity: 99 } as any)

    const movements = writes.filter((w) => w.table === 'stock_movements')
    expect(movements).toHaveLength(1)
    expect(movements[0]!.row).toMatchObject({
      product_id: 'p1',
      type: 'adjustment',
      quantity: 197,
      workspace_id: 'ws',
    })
    const productUpdate = writes.find((w) => w.table === 'products' && w.op === 'update')
    expect(productUpdate?.row).not.toHaveProperty('quantity')
  })

  it('an unchanged quantity writes no movement', async () => {
    const { ProductService } = await import('../services/product.service')
    await new ProductService().update('p1', ctx, { id: 'p1', quantity: -98, name: 'y' } as any)
    expect(writes.filter((w) => w.table === 'stock_movements')).toHaveLength(0)
  })

  // BUG-080: a refill recorded with no warehouse sat in «بدون انبار» while
  // sales left the warehouse — 20 on the product page, −10 in the warehouse.
  it('with ONE warehouse, the adjustment lands in it', async () => {
    warehouses = [wh('haji')]
    const { ProductService } = await import('../services/product.service')
    await new ProductService().update('p1', ctx, { id: 'p1', quantity: 2 } as any)
    const movement = writes.find((w) => w.table === 'stock_movements')
    expect(movement?.row).toMatchObject({ quantity: 100, to_warehouse_id: 'haji' })
  })

  it('with SEVERAL, an edit without a warehouse is refused and records nothing', async () => {
    warehouses = [wh('a'), wh('b')]
    const { ProductService } = await import('../services/product.service')
    await expect(
      new ProductService().update('p1', ctx, { id: 'p1', quantity: 2 } as any),
    ).rejects.toThrow('PRODUCT_WAREHOUSE_REQUIRED')
    expect(writes.filter((w) => w.table === 'stock_movements')).toHaveLength(0)
  })

  it('with SEVERAL, the chosen warehouse gets it; an unknown one is refused', async () => {
    warehouses = [wh('a'), wh('b')]
    const { ProductService } = await import('../services/product.service')
    await new ProductService().update('p1', ctx, { id: 'p1', quantity: 2, warehouseId: 'b' } as any)
    expect(writes.find((w) => w.table === 'stock_movements')?.row).toMatchObject({
      to_warehouse_id: 'b',
    })
    await expect(
      new ProductService().update('p1', ctx, { id: 'p1', quantity: 5, warehouseId: 'zzz' } as any),
    ).rejects.toThrow('PRODUCT_WAREHOUSE_NOT_FOUND')
  })

  it('with NO warehouses, the adjustment names none — there is nowhere else', async () => {
    const { ProductService } = await import('../services/product.service')
    await new ProductService().update('p1', ctx, { id: 'p1', quantity: 2 } as any)
    expect(writes.find((w) => w.table === 'stock_movements')?.row).not.toHaveProperty(
      'to_warehouse_id',
    )
  })
})
