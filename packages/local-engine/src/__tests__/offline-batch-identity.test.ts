// ============================================
// packages/local-engine/src/__tests__/offline-batch-identity.test.ts
//
// V55 final completion — batch_expiry, OFFLINE: a pharmacy on a device with
// no server. Receive a delivery as a batch, sell FROM the batch whose expiry
// comes first (the SHARED `planAllocation` — the same FEFO rule the server
// keeps), refuse an expired or insufficient issue, keep one invoice's hands
// off another's allocation, and get the quantity back when the sale is
// cancelled. A restart keeps the batch rows; a legacy product that tracks no
// batches still sells exactly as before.
// ============================================

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createTestDb,
  createTestEngine,
  reopenTestDb,
  TEST_WAREHOUSE_ID,
  type ClosableLocalDb,
} from './test-db'

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

describe('offline batch identity', () => {
  it('receiving a delivery creates the batch with its identity', async () => {
    const product = await makeProduct('آموکسیلین')
    const batch = await receiveBatch({
      productId: product.id,
      batchNumber: 'B-2026-11-01',
      quantity: 100,
      expiryDate: '2027-06-30',
      warehouseId: TEST_WAREHOUSE_ID,
    })
    expect(batch.remainingQty).toBe(100)

    const row = db.get<{ expiry_date: string; received_qty: number }>(
      'SELECT expiry_date, received_qty FROM stock_batches WHERE id = ?',
      [batch.id],
    )
    expect(row?.expiry_date).toBe('2027-06-30')
    expect(Number(row?.received_qty)).toBe(100)
  })

  it('the same batch number twice is refused — one delivery, one row', async () => {
    const product = await makeProduct('آموکسیلین')
    await receiveBatch({ productId: product.id, batchNumber: 'B-1', quantity: 10 })
    const res = await engine.request({
      method: 'POST',
      path: '/operations/batches',
      body: { productId: product.id, batchNumber: 'B-1', quantity: 5 },
    })
    expect(res.status).toBe(409)
    expect(JSON.stringify(res.data)).toContain('BATCH_NUMBER_DUPLICATE')
  })

  it('several batches can exist for one product, other warehouses stay out of the way', async () => {
    const product = await makeProduct('آموکسیلین')
    await receiveBatch({
      productId: product.id,
      batchNumber: 'B-KABUL',
      quantity: 10,
      warehouseId: TEST_WAREHOUSE_ID,
    })
    await receiveBatch({
      productId: product.id,
      batchNumber: 'B-HERAT',
      quantity: 20,
      warehouseId: '44444444-4444-4444-8444-444444444444',
    })

    const res = await engine.request<{ batchNumber: string }[]>({
      method: 'GET',
      path: `/operations/batches?productId=${product.id}&warehouseId=${TEST_WAREHOUSE_ID}`,
    })
    expect(res.status).toBe(200)
    expect(res.data.map((b) => b.batchNumber)).toEqual(['B-KABUL'])
  })

  it('FEFO takes the soonest valid expiry first, across several batches', async () => {
    const product = await makeProduct('آموکسیلین')
    const later = await receiveBatch({
      productId: product.id,
      batchNumber: 'B-JUNE',
      quantity: 10,
      expiryDate: '2027-06-30',
    })
    const sooner = await receiveBatch({
      productId: product.id,
      batchNumber: 'B-JAN',
      quantity: 10,
      expiryDate: '2026-12-31',
    })
    const invoice = await sell(product.id, 4)

    const res = await engine.request<{ allocations: { batchId: string; quantity: number }[] }>({
      method: 'POST',
      path: '/operations/batches/issue',
      body: { invoiceId: invoice.id, productId: product.id, quantity: 4 },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    expect(res.data.allocations).toEqual([
      {
        batchId: sooner.id,
        batchNumber: 'B-JAN',
        quantity: 4,
        expiryDate: '2026-12-31',
        costLayerId: null,
      },
    ])
    expect(remainingOf(sooner.id)).toBe(6)
    expect(remainingOf(later.id)).toBe(10)
  })

  it('an expired batch is never allocated — the issue is refused and the batch named', async () => {
    const product = await makeProduct('آموکسیلین')
    const expired = await receiveBatch({
      productId: product.id,
      batchNumber: 'B-OLD',
      quantity: 10,
      expiryDate: '2020-01-01',
    })
    const invoice = await sell(product.id, 2)

    const res = await engine.request({
      method: 'POST',
      path: '/operations/batches/issue',
      body: { invoiceId: invoice.id, productId: product.id, quantity: 2 },
    })
    expect(res.status).toBe(409)
    expect(JSON.stringify(res.data)).toContain('BATCH_ONLY_EXPIRED_STOCK')
    // The expired stock is still on the shelf, untouched.
    expect(remainingOf(expired.id)).toBe(10)
  })

  it('a batch that does not expire is drawn LAST, after the perishable one', async () => {
    const product = await makeProduct('آموکسیلین')
    const noExpiry = await receiveBatch({
      productId: product.id,
      batchNumber: 'B-FOREVER',
      quantity: 10,
    })
    const perishable = await receiveBatch({
      productId: product.id,
      batchNumber: 'B-JAN',
      quantity: 10,
      expiryDate: '2026-12-31',
    })
    const invoice = await sell(product.id, 3)

    const res = await engine.request<{ allocations: { batchId: string }[] }>({
      method: 'POST',
      path: '/operations/batches/issue',
      body: { invoiceId: invoice.id, productId: product.id, quantity: 3 },
    })
    expect(res.status).toBe(201)
    expect(res.data.allocations.map((a) => a.batchId)).toEqual([perishable.id])
    expect(remainingOf(noExpiry.id)).toBe(10)
  })

  it('an issue nothing covers is refused with an explicit shortfall', async () => {
    const product = await makeProduct('آموکسیلین')
    await receiveBatch({ productId: product.id, batchNumber: 'B-1', quantity: 3 })
    const invoice = await sell(product.id, 2)
    // The invoice sold 2; asking the batch trail for 5 must refuse — the shelf
    // only has 3 and the invoice only took 2.
    const res = await engine.request({
      method: 'POST',
      path: '/operations/batches/issue',
      body: { invoiceId: invoice.id, productId: product.id, quantity: 5 },
    })
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('BATCH_COUNT_MISMATCH')
  })

  it('a partial take from one batch and the rest from the next is one plan', async () => {
    const product = await makeProduct('آموکسیلین')
    const jan = await receiveBatch({
      productId: product.id,
      batchNumber: 'B-JAN',
      quantity: 3,
      expiryDate: '2026-12-31',
    })
    const june = await receiveBatch({
      productId: product.id,
      batchNumber: 'B-JUNE',
      quantity: 10,
      expiryDate: '2027-06-30',
    })
    const invoice = await sell(product.id, 5)

    const res = await engine.request<{ allocations: { batchId: string; quantity: number }[] }>({
      method: 'POST',
      path: '/operations/batches/issue',
      body: { invoiceId: invoice.id, productId: product.id, quantity: 5 },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    expect(res.data.allocations).toEqual([
      {
        batchId: jan.id,
        batchNumber: 'B-JAN',
        quantity: 3,
        expiryDate: '2026-12-31',
        costLayerId: null,
      },
      {
        batchId: june.id,
        batchNumber: 'B-JUNE',
        quantity: 2,
        expiryDate: '2027-06-30',
        costLayerId: null,
      },
    ])
    expect(remainingOf(jan.id)).toBe(0)
    expect(remainingOf(june.id)).toBe(8)
  })

  it('a second invoice cannot consume what the first one took (the guard, not the plan)', async () => {
    const product = await makeProduct('آموکسیلین')
    await receiveBatch({ productId: product.id, batchNumber: 'B-1', quantity: 10 })
    const first = await sell(product.id, 7)
    await engine.request({
      method: 'POST',
      path: '/operations/batches/issue',
      body: { invoiceId: first.id, productId: product.id, quantity: 7 },
    })
    expect(remainingOf(db.get<{ id: string }>('SELECT id FROM stock_batches')!.id)).toBe(3)

    const second = await sell(product.id, 7)
    const res = await engine.request({
      method: 'POST',
      path: '/operations/batches/issue',
      body: { invoiceId: second.id, productId: product.id, quantity: 7 },
    })
    expect(res.status).toBe(409)
    expect(JSON.stringify(res.data)).toContain('BATCH_INSUFFICIENT_STOCK')
  })

  it('a replayed issue does not take the shelf twice', async () => {
    const product = await makeProduct('آموکسیلین')
    await receiveBatch({ productId: product.id, batchNumber: 'B-1', quantity: 10 })
    const invoice = await sell(product.id, 4)
    const first = await engine.request({
      method: 'POST',
      path: '/operations/batches/issue',
      body: { invoiceId: invoice.id, productId: product.id, quantity: 4 },
    })
    expect(first.status).toBe(201)

    const replay = await engine.request({
      method: 'POST',
      path: '/operations/batches/issue',
      body: { invoiceId: invoice.id, productId: product.id, quantity: 4 },
    })
    expect(replay.status).toBe(400)
    expect(JSON.stringify(replay.data)).toContain('BATCH_COUNT_MISMATCH')
    expect(remainingOf(db.get<{ id: string }>('SELECT id FROM stock_batches')!.id)).toBe(6)
  })

  it('an issue against a purchase invoice is refused', async () => {
    const product = await makeProduct('آموکسیلین')
    await receiveBatch({ productId: product.id, batchNumber: 'B-1', quantity: 10 })
    const res = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'purchase',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [{ productId: product.id, productName: 'دوا', quantity: 4, unitPrice: 1500 }],
      },
    })
    expect(res.status).toBe(201)
    const issue = await engine.request({
      method: 'POST',
      path: '/operations/batches/issue',
      body: { invoiceId: res.data.id, productId: product.id, quantity: 4 },
    })
    expect(issue.status).toBe(400)
    expect(JSON.stringify(issue.data)).toContain('BATCH_SALE_ONLY')
  })

  it('cancelling the sale gives back ONLY what that sale took', async () => {
    const product = await makeProduct('آموکسیلین')
    const jan = await receiveBatch({
      productId: product.id,
      batchNumber: 'B-JAN',
      quantity: 6,
      expiryDate: '2026-12-31',
    })
    const june = await receiveBatch({
      productId: product.id,
      batchNumber: 'B-JUNE',
      quantity: 10,
      expiryDate: '2027-06-30',
    })

    const first = await sell(product.id, 8)
    await engine.request({
      method: 'POST',
      path: '/operations/batches/issue',
      body: { invoiceId: first.id, productId: product.id, quantity: 8 },
    })
    expect(remainingOf(jan.id)).toBe(0)
    expect(remainingOf(june.id)).toBe(8)

    const second = await sell(product.id, 2)
    await engine.request({
      method: 'POST',
      path: '/operations/batches/issue',
      body: { invoiceId: second.id, productId: product.id, quantity: 2 },
    })
    expect(remainingOf(june.id)).toBe(6)

    // Cancelling the SECOND sale restores its 2 — and nothing of the first's 8.
    const cancel = await engine.request({
      method: 'POST',
      path: `/invoices/${second.id}/cancel`,
      body: { reason: 'مرجوعی' },
    })
    expect(cancel.status, JSON.stringify(cancel.data)).toBe(200)
    expect(remainingOf(jan.id)).toBe(0)
    expect(remainingOf(june.id)).toBe(8)

    const left = db.all<{ consumer_id: string }>(
      "SELECT consumer_id FROM lot_allocations WHERE consumer_type = 'invoice'",
    )
    // The first sale still owns BOTH of its rows (it drew from two batches);
    // the cancelled sale owns none.
    expect(left).toHaveLength(2)
    expect(left.every((r) => r.consumer_id === first.id)).toBe(true)
  })

  it('cancelling an invoice that never issued batches restores nothing', async () => {
    const product = await makeProduct('آموکسیلین')
    const batch = await receiveBatch({ productId: product.id, batchNumber: 'B-1', quantity: 10 })
    const invoice = await sell(product.id, 2)

    const cancel = await engine.request({
      method: 'POST',
      path: `/invoices/${invoice.id}/cancel`,
      body: { reason: 'اشتباه' },
    })
    expect(cancel.status).toBe(200)
    // No allocation was ever made — the batch must still hold 10, not 12.
    expect(remainingOf(batch.id)).toBe(10)
  })

  it('a restart keeps the batch identity and the allocations', async () => {
    const file = path.join(os.tmpdir(), `hisabche-batch-${Date.now()}-${Math.random()}.db`)
    try {
      const fileDb = createTestDb(file)
      const fileEngine = createTestEngine(fileDb)
      const product = await (async () => {
        const res = await fileEngine.request<{ id: string }>({
          method: 'POST',
          path: '/products',
          body: { name: 'آموکسیلین', buyPrice: 1000, sellPrice: 1500, quantity: 0 },
        })
        expect(res.status).toBe(201)
        return res.data
      })()
      await fileEngine.request({
        method: 'POST',
        path: '/operations/batches',
        body: {
          productId: product.id,
          batchNumber: 'B-PERSIST',
          quantity: 10,
          expiryDate: '2027-01-31',
        },
      })
      const invoice = await (async () => {
        const res = await fileEngine.request<{ id: string }>({
          method: 'POST',
          path: '/invoices',
          body: {
            type: 'sale',
            currency: 'AFN',
            items: [{ productId: product.id, productName: 'دوا', quantity: 4, unitPrice: 1500 }],
          },
        })
        expect(res.status).toBe(201)
        return res.data
      })()
      await fileEngine.request({
        method: 'POST',
        path: '/operations/batches/issue',
        body: { invoiceId: invoice.id, productId: product.id, quantity: 4 },
      })
      fileDb.close()

      // The app is opened again: same file, no reseed.
      const reopened = reopenTestDb(file)
      const batch = reopened.get<{ remaining_qty: number }>(
        "SELECT remaining_qty FROM stock_batches WHERE batch_number = 'B-PERSIST'",
      )
      expect(Number(batch?.remaining_qty)).toBe(6)
      const allocation = reopened.get<{ consumer_id: string; quantity: number }>(
        "SELECT consumer_id, quantity FROM lot_allocations WHERE consumer_type = 'invoice'",
      )
      expect(allocation?.consumer_id).toBe(invoice.id)
      expect(Number(allocation?.quantity)).toBe(4)
      reopened.close()
    } finally {
      try {
        fs.unlinkSync(file)
      } catch {
        // already gone
      }
    }
  })

  it('a legacy product that tracks no batches still sells exactly as before', async () => {
    const product = await makeProduct('کالا بدون بچ')
    const invoice = await sell(product.id, 2)
    expect(invoice.id).toBeTruthy()
    expect(db.all('SELECT * FROM lot_allocations')).toEqual([])
    // The product-level stock moved, as it always did.
    const qty = db.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [
      product.id,
    ])
    expect(Number(qty?.quantity)).toBe(-2)
  })

  it('the plan endpoint consumes nothing', async () => {
    const product = await makeProduct('آموکسیلین')
    const batch = await receiveBatch({
      productId: product.id,
      batchNumber: 'B-1',
      quantity: 10,
      expiryDate: '2026-12-31',
    })
    const res = await engine.request<{ allocations: unknown[]; shortfall: number }>({
      method: 'POST',
      path: '/operations/batches/plan-issue',
      body: { productId: product.id, quantity: 4 },
    })
    expect(res.status).toBe(201)
    expect(res.data.allocations).toHaveLength(1)
    expect(res.data.shortfall).toBe(0)
    expect(remainingOf(batch.id)).toBe(10)
    expect(db.all('SELECT * FROM lot_allocations')).toEqual([])
  })
})
