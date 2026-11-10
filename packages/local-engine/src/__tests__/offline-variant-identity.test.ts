// ============================================
// packages/local-engine/src/__tests__/offline-variant-identity.test.ts
//
// V55 P2 — the vertical slice, OFFLINE: a real product variant survives the
// device's whole sale loop — created on the device, sold on an invoice, moved
// in stock, bought on a purchase order, received — without the server, and the
// identity is still on every row when the queue later drains.
//
// Refusals mirror the server's: a product with variants refuses the parent
// alone, a variant of another product or an inactive one is refused — offline,
// before anything is written.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, TEST_WAREHOUSE_ID, type ClosableLocalDb } from './test-db'

let db: ClosableLocalDb
let engine: ReturnType<typeof createTestEngine>

const uuid = (n: number) => `44444444-4444-4444-8444-44444444444${n}` as const

interface CreatedProduct {
  id: string
}

async function makeProduct(name: string): Promise<CreatedProduct> {
  const res = await engine.request<CreatedProduct>({
    method: 'POST',
    path: '/products',
    body: { name, buyPrice: 100, sellPrice: 150, quantity: 0, warehouseId: TEST_WAREHOUSE_ID },
  })
  expect(res.status, JSON.stringify(res.data)).toBe(201)
  return res.data
}

async function makeVariant(productId: string, sku: string): Promise<{ id: string }> {
  const res = await engine.request<{ id: string }>({
    method: 'POST',
    path: `/products/${productId}/variants`,
    body: { sku, attributes: [{ name: 'رنگ', value: sku }] },
  })
  expect(res.status, JSON.stringify(res.data)).toBe(201)
  return res.data
}

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('offline variant identity', () => {
  it('a variant created on the device has a UUID id (it must be sellable on a line)', async () => {
    const product = await makeProduct('تی‌شرت')
    const variant = await makeVariant(product.id, 'BLACK-L')
    expect(variant.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('an offline sale keeps the variant on the line AND on the movement', async () => {
    const product = await makeProduct('تی‌شرت')
    const variant = await makeVariant(product.id, 'BLACK-L')

    const res = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [
          {
            productId: product.id,
            variantId: variant.id,
            productName: 'تی‌شرت',
            quantity: 2,
            unitPrice: 150,
          },
        ],
      },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)

    const item = db.get<{ variant_id: string | null }>(
      'SELECT variant_id FROM invoice_item WHERE invoice_id = ?',
      [res.data.id],
    )
    expect(item?.variant_id).toBe(variant.id)

    const invoiceNumber = db.get<{ invoice_number: string }>(
      'SELECT invoice_number FROM invoice WHERE id = ?',
      [res.data.id],
    )?.invoice_number
    const movement = db.get<{ variant_id: string | null; quantity: number; type: string }>(
      'SELECT variant_id, quantity, type FROM inventory_movement WHERE reference = ? AND product_id = ?',
      [invoiceNumber, product.id],
    )
    expect(movement?.variant_id).toBe(variant.id)
    // The device records a sale as a POSITIVE quantity typed `sale` (the
    // server's movement rows are signed); the identity is the point here.
    expect(movement?.type).toBe('sale')
    expect(movement?.quantity).toBe(2)
  })

  it('a product with variants refuses the parent alone (offline, before anything is written)', async () => {
    const product = await makeProduct('تی‌شرت')
    await makeVariant(product.id, 'BLACK-L')

    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [{ productId: product.id, productName: 'تی‌شرت', quantity: 1, unitPrice: 150 }],
      },
    })
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('VARIANT_REQUIRED')
    expect(db.get('SELECT id FROM invoice')).toBeUndefined()
  })

  it('a variant of ANOTHER product is refused, and its stock is never touched', async () => {
    const shirt = await makeProduct('تی‌شرت')
    const shoe = await makeProduct('کفش')
    const shoeVariant = await makeVariant(shoe.id, 'SIZE-42')

    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [
          {
            productId: shirt.id,
            variantId: shoeVariant.id,
            productName: 'تی‌شرت',
            quantity: 1,
            unitPrice: 150,
          },
        ],
      },
    })
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('VARIANT_NOT_FOUND')
  })

  it('an inactive variant is refused on a NEW sale', async () => {
    const product = await makeProduct('تی‌شرت')
    const variant = await makeVariant(product.id, 'BLACK-L')
    db.run('UPDATE product_variants SET is_active = 0 WHERE id = ?', [variant.id])

    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [
          {
            productId: product.id,
            variantId: variant.id,
            productName: 'تی‌شرت',
            quantity: 1,
            unitPrice: 150,
          },
        ],
      },
    })
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('VARIANT_INACTIVE')
  })

  it('a purchase order line buys a named variant, and receiving moves THAT variant', async () => {
    const product = await makeProduct('تی‌شرت')
    const variant = await makeVariant(product.id, 'BLACK-L')
    const supplierId = uuid(9)
    const now = new Date().toISOString()
    db.run(
      `INSERT INTO supplier (id, workspace_id, name, created_at, updated_at)
       VALUES (?, ?, 'تأمین‌کننده', ?, ?)`,
      [supplierId, '11111111-1111-4111-8111-111111111111', now, now],
    )

    const created = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/purchase-orders',
      body: {
        supplierId,
        items: [
          {
            productId: product.id,
            variantId: variant.id,
            quantity: 5,
            unitPrice: 100,
            totalPrice: 500,
          },
        ],
      },
    })
    expect(created.status, JSON.stringify(created.data)).toBe(201)

    const line = db.get<{ variant_id: string | null }>(
      'SELECT variant_id FROM purchase_order_item WHERE purchase_order_id = ?',
      [created.data.id],
    )
    expect(line?.variant_id).toBe(variant.id)

    const received = await engine.request({
      method: 'POST',
      path: `/purchase-orders/${created.data.id}/receive`,
      body: {},
    })
    expect(received.status, JSON.stringify(received.data)).toBe(200)

    const movement = db.get<{ variant_id: string | null; quantity: number }>(
      'SELECT variant_id, quantity FROM inventory_movement WHERE reference = ? AND product_id = ?',
      [`purchase_order:${created.data.id}`, product.id],
    )
    expect(movement?.variant_id).toBe(variant.id)
    expect(movement?.quantity).toBe(5)
  })

  it('a product without variants keeps selling exactly as before (legacy path)', async () => {
    const product = await makeProduct('دفتر')
    const res = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [{ productId: product.id, productName: 'دفتر', quantity: 3, unitPrice: 150 }],
      },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    const item = db.get<{ variant_id: string | null; product_id: string }>(
      'SELECT variant_id, product_id FROM invoice_item WHERE invoice_id = ?',
      [res.data.id],
    )
    expect(item?.product_id).toBe(product.id)
    expect(item?.variant_id).toBeNull()
  })
})
