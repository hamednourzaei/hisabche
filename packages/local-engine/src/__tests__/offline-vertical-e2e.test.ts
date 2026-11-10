// ============================================
// packages/local-engine/src/__tests__/offline-vertical-e2e.test.ts
//
// V55 final completion — the WHOLE offline vertical in one walk, the path a
// real pharmacy takes on a device with no server:
//
//   variant product + batch receive  →  sale naming the variant  →
//   FEFO batch claim on that sale    →  serial/IMEI claim        →
//   cancellation gives EVERYTHING back (quantity, batch, serial) →
//   a restart keeps the remaining identity
//
// Nothing here is mocked: every step runs through the same engine routes the
// app calls, on the same SQLite schema the device opens.
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

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('the offline vertical: variant → batch → serial → cancel', () => {
  it('one sale names its variant, its batch and its serial — and cancelling returns all three', async () => {
    // ── 1. A variant product with two variants ────────────────────────────
    const product = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/products',
      body: { name: 'شربت', buyPrice: 1000, sellPrice: 1500, quantity: 0 },
    })
    expect(product.status).toBe(201)
    const productId = product.data.id

    const variant = await engine.request<{ id: string }>({
      method: 'POST',
      path: `/products/${productId}/variants`,
      body: {
        sku: 'SHR-SYRUP-120',
        attributes: [{ name: 'size', value: '120ml' }],
      },
    })
    expect(variant.status, JSON.stringify(variant.data)).toBe(201)
    const variantId = variant.data.id

    // ── 2. The delivery arrives as a batch ────────────────────────────────
    const batchRes = await engine.request<{ id: string; remainingQty: number }>({
      method: 'POST',
      path: '/operations/batches',
      body: {
        productId,
        batchNumber: 'B-PHARM-11',
        quantity: 10,
        expiryDate: '2026-12-31',
        warehouseId: TEST_WAREHOUSE_ID,
      },
    })
    expect(batchRes.status).toBe(201)
    const batchId = batchRes.data.id

    // ── 3. The sale: one unit of THIS variant ─────────────────────────────
    const invoice = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [
          {
            productId,
            variantId,
            productName: 'شربت ۱۲۰',
            quantity: 1,
            unitPrice: 1500,
          },
        ],
      },
    })
    expect(invoice.status, JSON.stringify(invoice.data)).toBe(201)
    const invoiceId = invoice.data.id

    // ── 4. The batch claim: FEFO takes the only batch ────────────────────
    const issue = await engine.request<{ allocations: { batchId: string }[] }>({
      method: 'POST',
      path: '/operations/batches/issue',
      body: { invoiceId, productId, quantity: 1, consumerLine: 'line-1' },
    })
    expect(issue.status, JSON.stringify(issue.data)).toBe(201)
    expect(issue.data.allocations.map((a) => a.batchId)).toEqual([batchId])

    // ── 5. The serial claim: THIS unit left the shelf ─────────────────────
    await engine.request({
      method: 'POST',
      path: '/operations/serials',
      body: { productId, serialNumbers: ['LOT-11-0001'], unitCostMinor: 1000 },
    })
    const claim = await engine.request({
      method: 'POST',
      path: '/operations/serials/issue',
      body: { invoiceId, productId, serialNumbers: ['LOT-11-0001'] },
    })
    expect(claim.status, JSON.stringify(claim.data)).toBe(201)

    // The identity on the rows, before anything is undone:
    expect(
      db.get<{ variant_id: string }>('SELECT variant_id FROM invoice_item WHERE invoice_id = ?', [
        invoiceId,
      ])?.variant_id,
    ).toBe(variantId)
    expect(
      db.get<{ variant_id: string }>(
        'SELECT variant_id FROM inventory_movement WHERE reference = (SELECT invoice_number FROM invoice WHERE id = ?)',
        [invoiceId],
      )?.variant_id,
    ).toBe(variantId)
    expect(
      Number(
        db.get<{ remaining_qty: number }>('SELECT remaining_qty FROM stock_batches WHERE id = ?', [
          batchId,
        ])?.remaining_qty,
      ),
    ).toBe(9)
    expect(
      db.get<{ status: string }>('SELECT status FROM stock_serials WHERE serial_number = ?', [
        'LOT-11-0001',
      ])?.status,
    ).toBe('sold')

    // ── 6. The cancellation gives ALL of it back ──────────────────────────
    const cancel = await engine.request({
      method: 'POST',
      path: `/invoices/${invoiceId}/cancel`,
      body: { reason: 'مرجوعی' },
    })
    expect(cancel.status, JSON.stringify(cancel.data)).toBe(200)

    expect(
      Number(
        db.get<{ remaining_qty: number }>('SELECT remaining_qty FROM stock_batches WHERE id = ?', [
          batchId,
        ])?.remaining_qty,
      ),
    ).toBe(10)
    expect(db.all("SELECT * FROM lot_allocations WHERE consumer_type = 'invoice'")).toEqual([])
    expect(
      db.get<{ status: string; invoice_id: string | null }>(
        'SELECT status, invoice_id FROM stock_serials WHERE serial_number = ?',
        ['LOT-11-0001'],
      ),
    ).toMatchObject({ status: 'in_stock', invoice_id: null })
  })

  it('a restart keeps the batch identity and the allocations', async () => {
    const file = path.join(os.tmpdir(), `hisabche-e2e-${Date.now()}-${Math.random()}.db`)
    try {
      const fileDb = createTestDb(file)
      const fileEngine = createTestEngine(fileDb)
      const product = await fileEngine.request<{ id: string }>({
        method: 'POST',
        path: '/products',
        body: { name: 'شربت', buyPrice: 1000, sellPrice: 1500, quantity: 0 },
      })
      expect(product.status).toBe(201)
      await fileEngine.request({
        method: 'POST',
        path: '/operations/batches',
        body: {
          productId: product.data.id,
          batchNumber: 'B-X',
          quantity: 5,
          expiryDate: '2027-01-31',
        },
      })
      const invoice = await fileEngine.request<{ id: string }>({
        method: 'POST',
        path: '/invoices',
        body: {
          type: 'sale',
          currency: 'AFN',
          items: [
            { productId: product.data.id, productName: 'شربت', quantity: 2, unitPrice: 1500 },
          ],
        },
      })
      expect(invoice.status).toBe(201)
      const issue = await fileEngine.request({
        method: 'POST',
        path: '/operations/batches/issue',
        body: { invoiceId: invoice.data.id, productId: product.data.id, quantity: 2 },
      })
      expect(issue.status).toBe(201)
      fileDb.close()

      const reopened = reopenTestDb(file)
      expect(
        Number(
          reopened.get<{ remaining_qty: number }>(
            "SELECT remaining_qty FROM stock_batches WHERE batch_number = 'B-X'",
          )?.remaining_qty,
        ),
      ).toBe(3)
      expect(
        reopened.get<{ consumer_id: string }>(
          "SELECT consumer_id FROM lot_allocations WHERE consumer_type = 'invoice'",
        )?.consumer_id,
      ).toBe(invoice.data.id)
      reopened.close()
    } finally {
      try {
        fs.unlinkSync(file)
      } catch {
        // already gone
      }
    }
  })
})
