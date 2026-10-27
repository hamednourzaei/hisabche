// ============================================
// The device's product list — what the invoice's picker and the stock page read.
//
// «در انبار ۱۰ گرم طلا دارم و فاکتور می‌گوید کالایی پیدا نشد» (26 Oct 2026): the
// list was read through a gated IPC and came back empty. The device answers
// through THIS route now, so everything the old generic read did has to be here:
// the warehouse filter, the sort, a page as big as the screen asks, and the
// workspace wall.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import type { LocalDb } from '../db'
import { createTestDb, TEST_WAREHOUSE_ID, TEST_WORKSPACE_ID } from './test-db'

const OTHER_WAREHOUSE_ID = '44444444-4444-4444-8444-444444444444'
const OTHER_WORKSPACE_ID = '99999999-9999-4999-8999-999999999999'

interface ProductList {
  products: Array<{ id: string; name: string; quantity: number }>
  total: number
  hasMore: boolean
  summary?: { productCount: number }
}

describe('GET /products on the device', () => {
  let db: LocalDb
  let engine: ReturnType<typeof createLocalEngine>

  const list = async (query: Record<string, string> = {}) => {
    const res = await engine.request({ method: 'GET', path: '/products', params: query })
    expect(res.status).toBe(200)
    return res.data as ProductList
  }

  beforeEach(async () => {
    db = createTestDb()
    engine = createLocalEngine(db)
    db.run(
      `INSERT INTO warehouse (id, workspace_id, name, location, is_active, created_at, updated_at)
       VALUES (?, ?, 'انبار دوم', '', 1, datetime('now'), datetime('now'))`,
      [OTHER_WAREHOUSE_ID, TEST_WORKSPACE_ID],
    )
    for (const [name, warehouseId, quantity] of [
      ['طلا', TEST_WAREHOUSE_ID, 10],
      ['نقره', OTHER_WAREHOUSE_ID, 4],
      ['برنج', TEST_WAREHOUSE_ID, 50],
    ] as const) {
      const res = await engine.request({
        method: 'POST',
        path: '/products',
        body: { name, unit: 'gram', buyPrice: 100, sellPrice: 150, quantity, warehouseId },
      })
      expect(res.status).toBe(201)
    }
  })

  it('the warehouse filter lists what that warehouse holds, and only that', async () => {
    const here = await list({ warehouseId: TEST_WAREHOUSE_ID })
    expect(here.products.map((p) => p.name).sort()).toEqual(['برنج', 'طلا'].sort())

    const there = await list({ warehouseId: OTHER_WAREHOUSE_ID })
    expect(there.products.map((p) => p.name)).toEqual(['نقره'])
  })

  it('a warehouse that holds nothing lists nothing — the gold is not «everywhere»', async () => {
    db.run(
      `INSERT INTO warehouse (id, workspace_id, name, location, is_active, created_at, updated_at)
       VALUES ('55555555-5555-4555-8555-555555555555', ?, 'خالی', '', 1, datetime('now'), datetime('now'))`,
      [TEST_WORKSPACE_ID],
    )
    const none = await list({ warehouseId: '55555555-5555-4555-8555-555555555555' })
    expect(none.products).toEqual([])
    expect(none.total).toBe(0)
  })

  it('another business’s product never shows up, with or without a warehouse', async () => {
    db.run(
      `INSERT INTO product (id, workspace_id, name, quantity, unit, is_active, created_at, updated_at, origin, sync_state)
       VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ?, 'مال دیگری', 9, 'gram', 1, datetime('now'), datetime('now'), 'local', 'local_only')`,
      [OTHER_WORKSPACE_ID],
    )
    db.run(
      `INSERT INTO product_stock (id, workspace_id, product_id, warehouse_id, qty, created_at, updated_at)
       VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', ?, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ?, 9, datetime('now'), datetime('now'))`,
      [OTHER_WORKSPACE_ID, TEST_WAREHOUSE_ID],
    )

    for (const query of [{}, { warehouseId: TEST_WAREHOUSE_ID }, { search: 'دیگری' }]) {
      const page = await list(query)
      expect(page.products.map((p) => p.name)).not.toContain('مال دیگری')
    }
  })

  it('sorts the way the screen asks, and a name sort is stable', async () => {
    const ascending = await list({ sortBy: 'name', sortDirection: 'asc' })
    const names = ascending.products.map((p) => p.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))

    const byQuantity = await list({ sortBy: 'quantity', sortDirection: 'desc' })
    expect(byQuantity.products.map((p) => p.quantity)).toEqual([50, 10, 4])
  })

  it('an unknown sort column is the default order, not an error or an injection', async () => {
    const page = await list({ sortBy: 'name; DROP TABLE product', sortDirection: 'asc' })
    expect(page.products).toHaveLength(3)
    const still = await list()
    expect(still.total).toBe(3)
  })

  it('a page as big as the screen asks for', async () => {
    for (let i = 0; i < 120; i += 1) {
      db.run(
        `INSERT INTO product (id, workspace_id, name, quantity, unit, is_active, created_at, updated_at, origin, sync_state)
         VALUES (?, ?, ?, 0, 'piece', 1, datetime('now'), datetime('now'), 'local', 'local_only')`,
        [`cccccccc-cccc-4ccc-8ccc-${String(i).padStart(12, '0')}`, TEST_WORKSPACE_ID, `کالا ${i}`],
      )
    }
    const page = await list({ limit: '500' })
    expect(page.products).toHaveLength(123)
    expect(page.hasMore).toBe(false)

    const capped = await list({ limit: '5000' })
    expect(capped.products.length).toBeLessThanOrEqual(1000)
  })

  it('includeSummary adds the cards’ numbers, over every active product', async () => {
    const withSummary = await list({ includeSummary: 'true', limit: '1' })
    expect(withSummary.products).toHaveLength(1)
    expect(withSummary.summary?.productCount).toBe(3)

    const without = await list({ limit: '1' })
    expect('summary' in without).toBe(false)
  })

  // ⚠️ THE ROOT OF «کالایی پیدا نشد» ON THE OFFLINE EDITION (26 Oct 2026).
  // The shared list hooks send every filter, set or not: `{ isActive: undefined,
  // lowStock: undefined, search: '' … }`. The engine turned `undefined` into `''`,
  // and `'' !== undefined` made `isActive` an ACTIVE filter that read as false —
  // «only inactive products». The picker listed nothing with the gold in stock.
  it('a filter nobody set filters nothing — undefined, null and empty are all «absent»', async () => {
    const page = await list({
      isActive: undefined,
      lowStock: undefined,
      category: '',
      barcode: '',
      search: '',
      warehouseId: undefined,
      minPrice: undefined,
    } as unknown as Record<string, string>)
    expect(page.products).toHaveLength(3)
    expect(page.total).toBe(3)
  })

  it('a filter somebody DID set still filters (isActive=false is «inactive only»)', async () => {
    db.run("UPDATE product SET is_active = 0 WHERE name = 'برنج'")
    const inactive = await list({ isActive: 'false' })
    expect(inactive.products.map((p) => p.name)).toEqual(['برنج'])
    const active = await list({ isActive: 'true' })
    expect(active.products).toHaveLength(2)
  })

  it('the barcode-or-name search the server runs', async () => {
    const found = await list({ search: 'طلا' })
    expect(found.products.map((p) => p.name)).toEqual(['طلا'])
  })
})
