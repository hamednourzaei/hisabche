// ============================================
// packages/local-engine/src/__tests__/offline-batch-recall.test.ts
//
// WP-05, OFFLINE: a pharmacy on a device with no server blocks a recalled
// carton — the supplier rang, the batch failed inspection — and the till stops
// selling it without losing the stock. The rule is the SHARED `planAllocation`
// core the server runs, so the same carton is refused in both places.
//
// The blocked carton keeps its quantity: the goods exist, their value is on the
// books, and only a write-off may change that.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, TEST_WAREHOUSE_ID, type ClosableLocalDb } from './test-db'

let db: ClosableLocalDb
let engine: ReturnType<typeof createTestEngine>

async function makeProduct(name: string): Promise<{ id: string }> {
  const res = await engine.request<{ id: string }>({
    method: 'POST',
    path: '/products',
    body: { name, buyPrice: 1000, sellPrice: 1500, quantity: 0, warehouseId: TEST_WAREHOUSE_ID },
  })
  expect(res.status, JSON.stringify(res.data)).toBe(201)
  return res.data
}

async function receiveBatch(input: Record<string, unknown>) {
  const res = await engine.request<{ id: string; remainingQty: number }>({
    method: 'POST',
    path: '/operations/batches',
    body: input,
  })
  expect(res.status, JSON.stringify(res.data)).toBe(201)
  return res.data
}

async function sell(productId: string, quantity: number): Promise<{ id: string }> {
  const res = await engine.request<{ id: string }>({
    method: 'POST',
    path: '/invoices',
    body: {
      type: 'sale',
      currency: 'AFN',
      warehouseId: TEST_WAREHOUSE_ID,
      items: [{ productId, productName: 'دوا', quantity, unitPrice: 1500 }],
    },
  })
  expect(res.status, JSON.stringify(res.data)).toBe(201)
  return res.data
}

const remainingOf = (batchId: string) =>
  Number(
    db.get<{ remaining_qty: number }>('SELECT remaining_qty FROM stock_batches WHERE id = ?', [
      batchId,
    ])?.remaining_qty,
  )

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('offline batch recall', () => {
  it('blocks a batch without touching its quantity, and says who did it', async () => {
    const product = await makeProduct('آموکسیلین')
    const batch = await receiveBatch({
      productId: product.id,
      batchNumber: 'B-JAN',
      quantity: 10,
      expiryDate: '2026-12-31',
    })

    const res = await engine.request<{ recalledAt: string | null; recalledReason: string }>({
      method: 'POST',
      path: `/operations/batches/${batch.id}/recall`,
      body: { reason: '  فراخوان تأمین‌کننده  ' },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    expect(res.data.recalledAt).toBeTruthy()
    expect(res.data.recalledReason).toBe('فراخوان تأمین‌کننده')

    // The carton still exists and still holds its stock.
    expect(remainingOf(batch.id)).toBe(10)
    const row = db.get<{ recalled_by: string }>(
      'SELECT recalled_by FROM stock_batches WHERE id = ?',
      [batch.id],
    )
    expect(row?.recalled_by).toBeTruthy()
  })

  it('a recall with no reason is refused — and the batch stays sellable', async () => {
    const product = await makeProduct('آموکسیلین')
    const batch = await receiveBatch({ productId: product.id, batchNumber: 'B-1', quantity: 5 })

    const res = await engine.request({
      method: 'POST',
      path: `/operations/batches/${batch.id}/recall`,
      body: { reason: '   ' },
    })
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('BATCH_RECALL_REASON_REQUIRED')

    const row = db.get<{ recalled_at: string | null }>(
      'SELECT recalled_at FROM stock_batches WHERE id = ?',
      [batch.id],
    )
    expect(row?.recalled_at).toBeNull()
  })

  it('FEFO steps over the blocked carton and takes the next one', async () => {
    const product = await makeProduct('آموکسیلین')
    const sooner = await receiveBatch({
      productId: product.id,
      batchNumber: 'B-JAN',
      quantity: 10,
      expiryDate: '2026-12-31',
    })
    const later = await receiveBatch({
      productId: product.id,
      batchNumber: 'B-JUNE',
      quantity: 10,
      expiryDate: '2027-06-30',
    })

    await engine.request({
      method: 'POST',
      path: `/operations/batches/${sooner.id}/recall`,
      body: { reason: 'فراخوان تأمین‌کننده' },
    })

    const invoice = await sell(product.id, 4)
    const res = await engine.request<{ allocations: { batchId: string }[] }>({
      method: 'POST',
      path: '/operations/batches/issue',
      body: { invoiceId: invoice.id, productId: product.id, quantity: 4 },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    expect(res.data.allocations.map((allocation) => allocation.batchId)).toEqual([later.id])
    // The blocked carton was not touched; the good one gave the 4.
    expect(remainingOf(sooner.id)).toBe(10)
    expect(remainingOf(later.id)).toBe(6)
  })

  it('an issue only a blocked carton could cover is refused as BATCH_RECALLED', async () => {
    const product = await makeProduct('آموکسیلین')
    const batch = await receiveBatch({ productId: product.id, batchNumber: 'B-1', quantity: 10 })
    await engine.request({
      method: 'POST',
      path: `/operations/batches/${batch.id}/recall`,
      body: { reason: 'نتیجه معاینه منفی' },
    })

    const invoice = await sell(product.id, 2)
    const res = await engine.request({
      method: 'POST',
      path: '/operations/batches/issue',
      body: { invoiceId: invoice.id, productId: product.id, quantity: 2 },
    })
    expect(res.status).toBe(409)
    expect(JSON.stringify(res.data)).toContain('BATCH_RECALLED')
    expect(remainingOf(batch.id)).toBe(10)
  })

  it('a manual pick of a blocked carton is refused too', async () => {
    const product = await makeProduct('آموکسیلین')
    const batch = await receiveBatch({ productId: product.id, batchNumber: 'B-1', quantity: 10 })
    await engine.request({
      method: 'POST',
      path: `/operations/batches/${batch.id}/recall`,
      body: { reason: 'فراخوان' },
    })

    const plan = await engine.request<{ allocations: unknown[]; shortfall: number }>({
      method: 'POST',
      path: '/operations/batches/plan-issue',
      body: {
        productId: product.id,
        quantity: 3,
        strategy: 'manual',
        manual: [{ batchId: batch.id, quantity: 3 }],
      },
    })
    expect(plan.status).toBe(201)
    expect(plan.data.allocations).toEqual([])
    expect(plan.data.shortfall).toBe(3)
  })

  it('a second recall keeps the FIRST reason', async () => {
    const product = await makeProduct('آموکسیلین')
    const batch = await receiveBatch({ productId: product.id, batchNumber: 'B-1', quantity: 5 })

    await engine.request({
      method: 'POST',
      path: `/operations/batches/${batch.id}/recall`,
      body: { reason: 'فراخوان تأمین‌کننده' },
    })
    const again = await engine.request<{ recalledReason: string }>({
      method: 'POST',
      path: `/operations/batches/${batch.id}/recall`,
      body: { reason: 'چیز دیگری' },
    })
    expect(again.status).toBe(201)
    expect(again.data.recalledReason).toBe('فراخوان تأمین‌کننده')
  })

  it('unblocking makes the carton sellable again', async () => {
    const product = await makeProduct('آموکسیلین')
    const batch = await receiveBatch({
      productId: product.id,
      batchNumber: 'B-1',
      quantity: 10,
      expiryDate: '2026-12-31',
    })
    await engine.request({
      method: 'POST',
      path: `/operations/batches/${batch.id}/recall`,
      body: { reason: 'اشتباه ثبت شد' },
    })

    const release = await engine.request<{ recalledAt: string | null }>({
      method: 'DELETE',
      path: `/operations/batches/${batch.id}/recall`,
    })
    expect(release.status, JSON.stringify(release.data)).toBe(200)
    expect(release.data.recalledAt).toBeNull()

    const invoice = await sell(product.id, 3)
    const issue = await engine.request<{ allocations: { batchId: string }[] }>({
      method: 'POST',
      path: '/operations/batches/issue',
      body: { invoiceId: invoice.id, productId: product.id, quantity: 3 },
    })
    expect(issue.status, JSON.stringify(issue.data)).toBe(201)
    expect(issue.data.allocations.map((allocation) => allocation.batchId)).toEqual([batch.id])
    expect(remainingOf(batch.id)).toBe(7)
  })

  it('unblocking a carton that was never blocked is a no-op, not an error', async () => {
    const product = await makeProduct('آموکسیلین')
    const batch = await receiveBatch({ productId: product.id, batchNumber: 'B-1', quantity: 5 })

    const res = await engine.request<{ recalledAt: string | null }>({
      method: 'DELETE',
      path: `/operations/batches/${batch.id}/recall`,
    })
    expect(res.status).toBe(200)
    expect(res.data.recalledAt).toBeNull()
  })

  it('a batch that does not exist cannot be blocked', async () => {
    const res = await engine.request({
      method: 'POST',
      path: '/operations/batches/99999999-9999-4999-8999-999999999999/recall',
      body: { reason: 'فراخوان' },
    })
    expect(res.status).toBe(404)
  })
})
