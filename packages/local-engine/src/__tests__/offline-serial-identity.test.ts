// ============================================
// packages/local-engine/src/__tests__/offline-serial-identity.test.ts
//
// V55 P2 — serialized_items, OFFLINE: a phone shop on a device with no server.
// Receive the IMEIs, sell one on an invoice, name it on the sale, refuse a
// second sale of the same unit, and get it back when the invoice is cancelled.
// The claim decision is the SHARED `validateSerialSale` rule — the same one
// the server keeps.
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

async function receiveSerials(productId: string, serialNumbers: string[]) {
  const res = await engine.request<{ issued: number }>({
    method: 'POST',
    path: '/operations/serials',
    body: { productId, serialNumbers, unitCostMinor: 1000 },
  })
  expect(res.status, JSON.stringify(res.data)).toBe(201)
  return res.data
}

async function sellPhone(productId: string): Promise<{ id: string }> {
  const res = await engine.request<{ id: string }>({
    method: 'POST',
    path: '/invoices',
    body: {
      type: 'sale',
      currency: 'AFN',
      warehouseId: TEST_WAREHOUSE_ID,
      items: [{ productId, productName: 'گوشی', quantity: 1, unitPrice: 1500 }],
    },
  })
  expect(res.status, JSON.stringify(res.data)).toBe(201)
  return res.data
}

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('offline serial identity', () => {
  it('receiving the same IMEI twice is refused', async () => {
    const product = await makeProduct('گوشی')
    await receiveSerials(product.id, ['IMEI-A'])
    const again = await engine.request({
      method: 'POST',
      path: '/operations/serials',
      body: { productId: product.id, serialNumbers: ['IMEI-A'], unitCostMinor: 1000 },
    })
    expect(again.status).toBe(409)
    expect(JSON.stringify(again.data)).toContain('SERIAL_DUPLICATE')
  })

  it('a sale names its unit: the IMEI is sold ON that invoice', async () => {
    const product = await makeProduct('گوشی')
    await receiveSerials(product.id, ['IMEI-A', 'IMEI-B'])
    const invoice = await sellPhone(product.id)

    const issued = await engine.request<{ issued: number; costMinor: number }>({
      method: 'POST',
      path: '/operations/serials/issue',
      body: { invoiceId: invoice.id, productId: product.id, serialNumbers: ['IMEI-A'] },
    })
    // The engine answers a bare POST 201 (the server route answers 200).
    expect(issued.status, JSON.stringify(issued.data)).toBe(201)
    expect(issued.data.issued).toBe(1)
    expect(issued.data.costMinor).toBe(1000)

    const row = db.get<{ status: string; invoice_id: string; sold_on: string | null }>(
      'SELECT status, invoice_id, sold_on FROM stock_serials WHERE serial_number = ?',
      ['IMEI-A'],
    )
    expect(row?.status).toBe('sold')
    expect(row?.invoice_id).toBe(invoice.id)
    expect(row?.sold_on).not.toBeNull()

    // The other unit is untouched.
    const other = db.get<{ status: string }>(
      'SELECT status FROM stock_serials WHERE serial_number = ?',
      ['IMEI-B'],
    )
    expect(other?.status).toBe('in_stock')
  })

  it('selling the SAME unit again is refused — offline, at the till', async () => {
    const product = await makeProduct('گوشی')
    await receiveSerials(product.id, ['IMEI-A', 'IMEI-B'])
    const first = await sellPhone(product.id)
    await engine.request({
      method: 'POST',
      path: '/operations/serials/issue',
      body: { invoiceId: first.id, productId: product.id, serialNumbers: ['IMEI-A'] },
    })

    const second = await sellPhone(product.id)
    const res = await engine.request({
      method: 'POST',
      path: '/operations/serials/issue',
      body: { invoiceId: second.id, productId: product.id, serialNumbers: ['IMEI-A'] },
    })
    // The same answer the server gives: a refused number is a 400, seen at the till.
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('SERIAL_ALREADY_SOLD')
  })

  it('more IMEIs named than units sold is refused', async () => {
    const product = await makeProduct('گوشی')
    await receiveSerials(product.id, ['IMEI-A', 'IMEI-B'])
    const invoice = await sellPhone(product.id)

    const res = await engine.request({
      method: 'POST',
      path: '/operations/serials/issue',
      body: { invoiceId: invoice.id, productId: product.id, serialNumbers: ['IMEI-A', 'IMEI-B'] },
    })
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('SERIAL_COUNT_MISMATCH')
  })

  it('a serial of ANOTHER product cannot be claimed for this sale', async () => {
    const phone = await makeProduct('گوشی')
    const laptop = await makeProduct('لپ‌تاپ')
    await receiveSerials(laptop.id, ['SN-X'])
    const invoice = await sellPhone(phone.id)

    const res = await engine.request({
      method: 'POST',
      path: '/operations/serials/issue',
      body: { invoiceId: invoice.id, productId: phone.id, serialNumbers: ['SN-X'] },
    })
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('SERIAL_NOT_FOUND')
  })

  it('cancelling the invoice frees the unit back into stock', async () => {
    const product = await makeProduct('گوشی')
    await receiveSerials(product.id, ['IMEI-A'])
    const invoice = await sellPhone(product.id)
    await engine.request({
      method: 'POST',
      path: '/operations/serials/issue',
      body: { invoiceId: invoice.id, productId: product.id, serialNumbers: ['IMEI-A'] },
    })

    const cancel = await engine.request({
      method: 'POST',
      path: `/invoices/${invoice.id}/cancel`,
      body: { reason: 'مرجوعی' },
    })
    expect(cancel.status, JSON.stringify(cancel.data)).toBe(200)

    const row = db.get<{ status: string; invoice_id: string | null }>(
      'SELECT status, invoice_id FROM stock_serials WHERE serial_number = ?',
      ['IMEI-A'],
    )
    expect(row?.status).toBe('in_stock')
    expect(row?.invoice_id).toBeNull()
  })
})
