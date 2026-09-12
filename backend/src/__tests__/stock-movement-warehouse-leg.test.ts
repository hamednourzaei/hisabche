// ============================================
// A sale has to leave a warehouse.
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT WAS ACTUALLY HAPPENING
//
// Since Phase C the application does not write `products.quantity` or
// `warehouse_stock.quantity` at all. It inserts `stock_movements` rows, and a
// database trigger projects BOTH figures from them. But the trigger only
// touches `warehouse_stock` when the movement NAMES a warehouse:
//
//     IF m.from_warehouse_id IS NOT NULL THEN ... warehouse_stock ...
//     IF NOT v_transfer      THEN ... products.quantity ...
//
// Sale and purchase movements carried neither id. So `products.quantity` moved
// and `warehouse_stock.quantity` never did — the shelf figure stayed at
// whatever it was the day it was counted, for ever, and the two numbers drifted
// apart by exactly everything that had ever been sold. `warehouse.service.ts`
// reads `warehouse_stock`, so that is the number people were looking at.
//
// ⚠️ THE AMBIGUOUS CASE IS NOT GUESSED. Nothing on an invoice line says which
// building the goods left. With several warehouses, choosing one would write a
// confident wrong figure into the source of truth. Only the single-warehouse
// case — where there is no choice to make — is resolved here.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
}

const service = code(join(__dirname, '..', 'services', 'invoice.service.ts'))

describe('the movement names its warehouse', () => {
  it('⚠️ a sale leaves a warehouse and a purchase arrives at one', () => {
    expect(service).toMatch(/to_warehouse_id: warehouseId/)
    expect(service).toMatch(/from_warehouse_id: warehouseId/)
  })

  it('⚠️ the direction decides which leg, not the other way round', () => {
    // Swapping these would ADD stock to a warehouse on every sale.
    const leg = service.slice(service.indexOf('...(warehouseId'))
    expect(leg.indexOf('to_warehouse_id')).toBeLessThan(leg.indexOf('from_warehouse_id'))
    expect(leg).toMatch(/direction === 1/)
  })

  it('⚠️ several warehouses resolve to null, never to the first row', () => {
    // `.limit(2)` then `length !== 1` — it asks whether there is exactly one,
    // and a `.limit(1)` here would silently answer «yes» for a workspace with
    // twenty.
    const helper = service.slice(service.indexOf('private async soleWarehouseId'))
    expect(helper).toMatch(/\.limit\(2\)/)
    expect(helper).toMatch(/data\.length !== 1\) return null/)
  })

  it('a failed lookup leaves the movement unattributed rather than guessing', () => {
    const helper = service.slice(service.indexOf('private async soleWarehouseId'))
    expect(helper).toMatch(/if \(error \|\| !data \|\| data\.length !== 1\) return null/)
  })

  it('the lookup is scoped to the workspace', () => {
    const helper = service.slice(service.indexOf('private async soleWarehouseId'))
    expect(helper).toMatch(/\.eq\('workspace_id', workspaceId\)/)
  })

  it('⚠️ the application still does not write products.quantity by hand', () => {
    // Phase C: the trigger owns both figures. A direct update here would make
    // the application a second writer and the two would race.
    expect(service).not.toMatch(/from\('products'\)[\s\S]{0,200}\.update\(\{[\s\S]{0,80}quantity/)
  })
})
