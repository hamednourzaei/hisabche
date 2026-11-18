// ============================================
// packages/local-engine/src/__tests__/offline-serial-return.test.ts
//
// WP-02 — a return made on a device routes the UNITS it names.
//
// The invoice return itself is only recorded offline (stock, cost and the books
// move on the server when it syncs). The serials are the exception, because a
// phone that came back to this shop is a fact this shop knows now: the shared
// `routeReturnedSerial` decides where the unit goes, exactly as the server
// decides it after applying the same return, and the numbers travel with the
// queued return so the server reaches the same state.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, TEST_WAREHOUSE_ID, type ClosableLocalDb } from './test-db'

let db: ClosableLocalDb
let engine: ReturnType<typeof createTestEngine>

const PRODUCT_NAME = 'گوشی'

async function makeProduct(): Promise<{ id: string }> {
  const res = await engine.request<{ id: string }>({
    method: 'POST',
    path: '/products',
    body: {
      name: PRODUCT_NAME,
      buyPrice: 1000,
      sellPrice: 1500,
      quantity: 0,
      warehouseId: TEST_WAREHOUSE_ID,
    },
  })
  expect(res.status, JSON.stringify(res.data)).toBe(201)
  return res.data
}

/** A phone shop's sale of one serialized unit, with the IMEI named on it. */
async function sellOnePhone(
  productId: string,
  serialNumber: string,
): Promise<{ invoiceId: string; lineId: string }> {
  const received = await engine.request({
    method: 'POST',
    path: '/operations/serials',
    body: { productId, serialNumbers: [serialNumber], unitCostMinor: 1000 },
  })
  expect(received.status, JSON.stringify(received.data)).toBe(201)

  const invoice = await engine.request<{ id: string }>({
    method: 'POST',
    path: '/invoices',
    body: {
      type: 'sale',
      currency: 'AFN',
      warehouseId: TEST_WAREHOUSE_ID,
      items: [{ productId, productName: PRODUCT_NAME, quantity: 1, unitPrice: 1500 }],
    },
  })
  expect(invoice.status, JSON.stringify(invoice.data)).toBe(201)

  const issued = await engine.request({
    method: 'POST',
    path: '/operations/serials/issue',
    body: { invoiceId: invoice.data.id, productId, serialNumbers: [serialNumber] },
  })
  expect(issued.status, JSON.stringify(issued.data)).toBe(201)

  const line = db.get<{ id: string }>(
    'SELECT id FROM invoice_item WHERE invoice_id = ? AND product_id = ?',
    [invoice.data.id, productId],
  )
  return { invoiceId: invoice.data.id, lineId: line!.id }
}

async function returnLine(
  invoiceId: string,
  body: Record<string, unknown>,
): Promise<Awaited<ReturnType<typeof engine.request>>> {
  return engine.request({
    method: 'POST',
    path: `/invoices/${invoiceId}/returns`,
    body: {
      returnType: 'sale_return',
      returnNumber: 'RET-1',
      returnDate: '2026-11-17',
      lines: [{ restockChoice: 'restock', reasonCode: 'other', ...body }],
    },
  })
}

function serialRow(serialNumber: string) {
  return db.get<{ status: string; invoice_id: string | null; sold_on: string | null }>(
    'SELECT status, invoice_id, sold_on FROM stock_serials WHERE serial_number = ?',
    [serialNumber],
  )
}

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('WP-02 — an offline return routes the unit it names', () => {
  it('a sound unit goes back on the shelf, free of its invoice', async () => {
    const product = await makeProduct()
    const { invoiceId, lineId } = await sellOnePhone(product.id, 'IMEI-A')

    const res = await returnLine(invoiceId, {
      originalLineId: lineId,
      returnQuantity: 1,
      conditionCode: 'opened',
      serialNumbers: ['IMEI-A'],
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)

    const row = serialRow('IMEI-A')
    expect(row?.status).toBe('in_stock')
    expect(row?.invoice_id).toBeNull()
    expect(row?.sold_on).toBeNull()

    // And it can be sold again — the same claim rule, on the same device.
    const second = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [{ productId: product.id, productName: PRODUCT_NAME, quantity: 1, unitPrice: 1500 }],
      },
    })
    const issued = await engine.request({
      method: 'POST',
      path: '/operations/serials/issue',
      body: {
        invoiceId: second.data.id,
        productId: product.id,
        serialNumbers: ['IMEI-A'],
      },
    })
    expect(issued.status, JSON.stringify(issued.data)).toBe(201)
    expect(serialRow('IMEI-A')?.invoice_id).toBe(second.data.id)
  })

  it('a defective unit is «returned», not put back on the shelf', async () => {
    const product = await makeProduct()
    const { invoiceId, lineId } = await sellOnePhone(product.id, 'IMEI-B')

    const res = await returnLine(invoiceId, {
      originalLineId: lineId,
      returnQuantity: 1,
      conditionCode: 'defective',
      serialNumbers: ['IMEI-B'],
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)

    expect(serialRow('IMEI-B')?.status).toBe('returned')
    expect(serialRow('IMEI-B')?.invoice_id).toBeNull()

    // A returned (not in_stock) unit cannot be sold again as it is.
    const again = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [{ productId: product.id, productName: PRODUCT_NAME, quantity: 1, unitPrice: 1500 }],
      },
    })
    const issued = await engine.request({
      method: 'POST',
      path: '/operations/serials/issue',
      body: { invoiceId: again.data.id, productId: product.id, serialNumbers: ['IMEI-B'] },
    })
    expect(issued.status).toBe(400)
    expect(JSON.stringify(issued.data)).toContain('SERIAL_NOT_IN_STOCK')
  })

  it('a line written off as scrap marks the unit scrapped', async () => {
    const product = await makeProduct()
    const { invoiceId, lineId } = await sellOnePhone(product.id, 'IMEI-C')

    const res = await returnLine(invoiceId, {
      originalLineId: lineId,
      returnQuantity: 1,
      conditionCode: 'damaged',
      restockChoice: 'scrap',
      serialNumbers: ['IMEI-C'],
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)

    expect(serialRow('IMEI-C')?.status).toBe('scrapped')
  })

  it('a number this invoice never sold is left alone, and the return stands', async () => {
    const product = await makeProduct()
    const { invoiceId, lineId } = await sellOnePhone(product.id, 'IMEI-D')

    const res = await returnLine(invoiceId, {
      originalLineId: lineId,
      returnQuantity: 1,
      conditionCode: 'opened',
      serialNumbers: ['NOT-ON-THIS-INVOICE'],
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)

    // The sold unit was not named, so it was not routed.
    expect(serialRow('IMEI-D')?.status).toBe('sold')
    expect(serialRow('IMEI-D')?.invoice_id).toBe(invoiceId)
  })
})
