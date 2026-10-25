// ============================================
// What to reorder and what is not moving — on the device.
// Read models: nothing is written, nothing is ordered.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import { createTestDb, TEST_WAREHOUSE_ID } from './test-db'

interface Reorder {
  productId: string
  name: string
  onHand: number
  suggestedQty: number
  inTransit: number
}
interface Dead {
  productId: string
  name: string
  neverSold: boolean
  daysSinceSale: number | null
}

describe('stock insights on the device', () => {
  let db: ReturnType<typeof createTestDb>
  let engine: ReturnType<typeof createLocalEngine>

  async function product(name: string, quantity: number) {
    const res = await engine.request({
      method: 'POST',
      path: '/products',
      body: { name, buyPrice: 10, sellPrice: 20, quantity, warehouseId: TEST_WAREHOUSE_ID },
    })
    return (res.data as { id: string }).id
  }

  async function sell(productId: string, quantity: number) {
    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [{ productId, productName: 'x', quantity, unitPrice: 20, discount: 0 }],
      },
    })
    expect(res.status).toBe(201)
  }

  beforeEach(() => {
    db = createTestDb()
    engine = createLocalEngine(db)
  })

  it('suggests a reorder for what sold fast and is nearly gone — and only that', async () => {
    const fast = await product('برنج', 100)
    await product('نمک', 100) // never sold, plenty on hand
    await sell(fast, 90) // 90 sold in the window, 10 left

    const lines = (
      await engine.request<Reorder[]>({ method: 'GET', path: '/inventory/reorder-suggestions' })
    ).data
    expect(lines.map((l) => l.name)).toEqual(['برنج'])
    expect(lines[0]).toMatchObject({ onHand: 10, inTransit: 0 })
    expect(lines[0]!.suggestedQty).toBeGreaterThan(0)
  })

  it('a purchase is not demand: restocking does not make a product a bestseller', async () => {
    const id = await product('روغن', 5)
    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'purchase',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [{ productId: id, productName: 'x', quantity: 500, unitPrice: 10, discount: 0 }],
      },
    })
    expect(res.status).toBe(201)
    const lines = (
      await engine.request<Reorder[]>({ method: 'GET', path: '/inventory/reorder-suggestions' })
    ).data
    expect(lines).toEqual([])
  })

  it('dead stock: never-sold is said so, recently sold is not dead, zero stock is not dead', async () => {
    await product('هرگز', 10)
    const sold = await product('فروخته', 10)
    await sell(sold, 1)
    const empty = await product('تمام', 1)
    await sell(empty, 1)

    const lines = (await engine.request<Dead[]>({ method: 'GET', path: '/inventory/dead-stock' }))
      .data
    expect(lines.map((l) => l.name)).toEqual(['هرگز'])
    expect(lines[0]).toMatchObject({ neverSold: true, daysSinceSale: null })
  })

  it("a sale older than the window makes the stock dead, and the window is the caller's", async () => {
    const id = await product('کهنه', 10)
    await sell(id, 1)
    const old = new Date(Date.now() - 200 * 86_400_000).toISOString()
    db.run("UPDATE inventory_movement SET created_at = ? WHERE product_id = ? AND type = 'sale'", [
      old,
      id,
    ])
    const dead = (
      await engine.request<Dead[]>({ method: 'GET', path: '/inventory/dead-stock?days=90' })
    ).data
    expect(dead).toHaveLength(1)
    expect(dead[0]!.daysSinceSale).toBeGreaterThanOrEqual(199)

    const wide = (
      await engine.request<Dead[]>({ method: 'GET', path: '/inventory/dead-stock?days=365' })
    ).data
    expect(wide).toEqual([])
  })
})
