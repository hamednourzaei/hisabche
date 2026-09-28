// ============================================
// BUG-080 — «موجودی ۲۰» on the product page, «تمام شده −۱۰» in the warehouse,
// for the same item.
//
// A stock edit on the product page recorded its movement with NO warehouse,
// while every sale names the warehouse it sells from. The refill sat in
// «بدون انبار», the sales emptied the warehouse, and the product total (20)
// was the sum of +30 nowhere and −10 in the warehouse. The product page then
// served its old quantity for two more minutes, because the route cleared a
// cache key that matched nothing.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  productWarehouseBreakdown,
  stockEditWarehouse,
  type WarehouseRow,
} from '../services/inventory/warehouse-summary.domain'

const SRC = join(__dirname, '..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (...p: string[]) => strip(readFileSync(join(SRC, ...p), 'utf8'))

const w = (id: string, is_active: boolean | null = true): WarehouseRow => ({
  id,
  name: id,
  location: null,
  is_active,
})

describe('where a product-page stock change lands', () => {
  it('into the named warehouse — if it is a live one of this business', () => {
    expect(stockEditWarehouse([w('a'), w('b')], 'b', 'edit')).toEqual({ warehouseId: 'b' })
    expect(stockEditWarehouse([w('a')], 'zzz', 'edit')).toEqual({
      refusal: 'PRODUCT_WAREHOUSE_NOT_FOUND',
    })
    expect(stockEditWarehouse([w('a'), w('off', false)], 'off', 'edit')).toEqual({
      refusal: 'PRODUCT_WAREHOUSE_NOT_FOUND',
    })
  })

  it('into the only warehouse — the case that produced 20 vs −10', () => {
    expect(stockEditWarehouse([w('haji')], undefined, 'edit')).toEqual({ warehouseId: 'haji' })
    expect(stockEditWarehouse([w('haji')], null, 'create')).toEqual({ warehouseId: 'haji' })
    // An inactive warehouse is not a place stock can be put.
    expect(stockEditWarehouse([w('haji'), w('old', false)], undefined, 'edit')).toEqual({
      warehouseId: 'haji',
    })
  })

  it('with several, an edit asks — never guesses; creation keeps the documented «بدون انبار»', () => {
    expect(stockEditWarehouse([w('a'), w('b')], undefined, 'edit')).toEqual({
      refusal: 'PRODUCT_WAREHOUSE_REQUIRED',
    })
    expect(stockEditWarehouse([w('a'), w('b')], undefined, 'create')).toEqual({ warehouseId: null })
  })

  it('with no warehouses at all, nowhere — there is nowhere else', () => {
    expect(stockEditWarehouse([], undefined, 'edit')).toEqual({ warehouseId: null })
  })
})

describe('the breakdown the product page shows', () => {
  it('reproduces the report: 20 = −10 in the warehouse + 30 in none', () => {
    const b = productWarehouseBreakdown(
      20,
      [w('haji')],
      [{ warehouse_id: 'haji', product_id: 'p', quantity: '-10' }],
    )
    expect(b).toEqual({
      total: 20,
      warehouses: [{ id: 'haji', name: 'haji', quantity: -10 }],
      unassigned: 30,
    })
  })

  it('lists every warehouse, including ones holding none of it', () => {
    const b = productWarehouseBreakdown(
      5,
      [w('a'), w('b')],
      [{ warehouse_id: 'a', product_id: 'p', quantity: 5 }],
    )
    expect(b.warehouses).toEqual([
      { id: 'a', name: 'a', quantity: 5 },
      { id: 'b', name: 'b', quantity: 0 },
    ])
    expect(b.unassigned).toBe(0)
  })
})

describe('wiring', () => {
  const service = read('services', 'product.service.ts')
  const routes = read('routes', 'product.routes.ts')

  it('an edit’s movement names the warehouse the rule chose', () => {
    const update = service.slice(service.indexOf('const delta = target -'))
    expect(update.indexOf('this.stockWarehouse(')).toBeLessThan(
      update.indexOf(".from('stock_movements').insert("),
    )
    expect(update).toContain('...(warehouseId ? { to_warehouse_id: warehouseId } : {})')
    expect(service).toContain('stockEditWarehouse((data ?? []) as WarehouseRow[], requested, mode)')
  })

  it('opening stock goes through the same rule', () => {
    const create = service.slice(
      service.indexOf('async create('),
      service.indexOf('async create(') + 1500,
    )
    expect(create).toContain("'create',")
    expect(create).toContain('this.stockWarehouse(')
  })

  it('no product route clears a hand-built product key any more; the money caches go instead', () => {
    expect(routes).not.toMatch(/clearCache\(`product:\$\{workspaceId\}:\$\{id\}`\)/)
    expect(routes.match(/await invalidateMoneyCaches\(workspaceId\)/g)?.length).toBe(3)
  })

  it('a refused edit is a 400 with its reason and field, not a 500', () => {
    expect(routes).toContain('if (err instanceof ValidationError) return sendRefusal(reply, err)')
    expect(routes).toContain("PRODUCT_WAREHOUSE_REQUIRED: 'warehouseId'")
  })

  it('the breakdown is served, read-gated by inventory.read', () => {
    const wh = read('routes', 'warehouse.routes.ts')
    const at = wh.indexOf("'/api/products/:id/warehouse-breakdown'")
    expect(at).toBeGreaterThan(-1)
    expect(wh.slice(at, at + 200)).toContain("requireCapability('inventory.read')")
  })
})
