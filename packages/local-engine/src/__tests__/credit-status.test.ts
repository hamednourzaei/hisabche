// ============================================
// packages/local-engine/src/__tests__/credit-status.test.ts
//
// V53 OD-3: the SERVER's credit verdict is written onto the local invoice row (POST /invoices/:id/credit-status)
// and a sale that is not approved is NOT revenue: the dashboard leaves `pending_validation` and `rejected` rows
// out of totalSales / todaySales / customerDebt, while an ordinary row (NULL) and a `validated` row are counted.
// The device never decides this — the route only records what the server said.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import type { LocalDb } from '../db'
import { createTestDb, createTestEngine, TEST_WAREHOUSE_ID } from './test-db'

let db: LocalDb
let engine: ReturnType<typeof createTestEngine>

async function makeSale(): Promise<string> {
  const product = (
    await engine.request<{ id: string }>({
      method: 'POST',
      path: '/products',
      body: {
        name: 'چای',
        buyPrice: 100,
        sellPrice: 150,
        quantity: 10,
        warehouseId: TEST_WAREHOUSE_ID,
      },
    })
  ).data
  const res = await engine.request<{ id: string }>({
    method: 'POST',
    path: '/invoices',
    body: {
      type: 'sale',
      currency: 'AFN',
      warehouseId: TEST_WAREHOUSE_ID,
      items: [{ productId: product.id, productName: 'چای', quantity: 2, unitPrice: 150 }],
    },
  })
  expect(res.status, JSON.stringify(res.data)).toBe(201)
  return res.data.id
}

const setStatus = (invoiceId: string, status: string) =>
  engine.request<Record<string, unknown>>({
    method: 'POST',
    path: `/invoices/${invoiceId}/credit-status`,
    body: { status },
  })

const readStatus = (invoiceId: string) =>
  db.get<{ credit_status: string | null }>('SELECT credit_status FROM invoice WHERE id = ?', [
    invoiceId,
  ])?.credit_status

const totalSales = async () => {
  const res = await engine.request<{ totalSales: number }>({
    method: 'GET',
    path: '/analytics/dashboard',
  })
  return res.data.totalSales
}

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe("the server's credit verdict on a local sale", () => {
  it('records pending_validation, then the approval (validated), then a final rejection', async () => {
    const id = await makeSale()
    expect(readStatus(id)).toBeNull()

    const pending = await setStatus(id, 'pending_validation')
    expect(pending.status).toBe(201)
    expect(readStatus(id)).toBe('pending_validation')

    expect((await setStatus(id, 'validated')).status).toBe(201)
    expect(readStatus(id)).toBe('validated')

    expect((await setStatus(id, 'rejected')).status).toBe(201)
    expect(readStatus(id)).toBe('rejected')
  })

  it('refuses a state the server never sends', async () => {
    const id = await makeSale()
    const res = await setStatus(id, 'approved')
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(JSON.stringify(res.data)).toContain('CREDIT_STATUS_INVALID')
    expect(readStatus(id)).toBeNull() // nothing was half-written
  })

  it('refuses an unknown invoice and a cancelled sale', async () => {
    expect(
      (await setStatus('no-such-invoice', 'pending_validation')).status,
    ).toBeGreaterThanOrEqual(400)
    const id = await makeSale()
    await engine.request({ method: 'POST', path: `/invoices/${id}/cancel`, body: {} })
    const res = await setStatus(id, 'pending_validation')
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(JSON.stringify(res.data)).toContain('INVOICE_CANCELLED')
  })
})

describe('an unapproved credit sale is not revenue on the device', () => {
  it('leaves pending_validation and rejected out of the dashboard, counts NULL and validated', async () => {
    const id = await makeSale()
    // An ordinary sale (no credit question asked) IS revenue.
    expect(await totalSales()).toBe(300)

    await setStatus(id, 'pending_validation')
    expect(await totalSales()).toBe(0) // waiting: not revenue, not receivable

    await setStatus(id, 'validated')
    expect(await totalSales()).toBe(300) // the server accepted it

    await setStatus(id, 'rejected')
    expect(await totalSales()).toBe(0) // refused again: must be edited or cancelled
  })
})
