// ============================================
// The local engine and the server must convert a line the same way.
//
// The document keeps «2 cartons»; inventory is «48 pieces». The conversion is
// `toBaseQuantity` from @hisabche/validation — the shared function, not a
// second copy inside the engine.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { computeItemTotalRounded, sumInvoiceLines, toBaseQuantity } from '@hisabche/validation'

import { createLocalEngine } from '../index'
import { createTestDb, TEST_WAREHOUSE_ID } from './test-db'

describe('invoice unit conversion parity', () => {
  let db: ReturnType<typeof createTestDb>
  let engine: ReturnType<typeof createLocalEngine>

  beforeEach(() => {
    db = createTestDb()
    engine = createLocalEngine(db)
  })

  it('2 cartons × 24 = 48 pieces in inventory while the document keeps 2 cartons', async () => {
    const created = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/products',
      body: { name: 'Carton product', unit: 'piece', quantity: 0, warehouseId: TEST_WAREHOUSE_ID },
    })
    expect(created.status).toBe(201)
    const productId = created.data.id

    db.run(
      `INSERT INTO product_units
        (id, workspace_id, product_id, unit_code, conversion_factor_to_base,
         is_base_unit, is_purchase_default, is_sale_default, is_active,
         created_at, updated_at)
       VALUES ('u1', '11111111-1111-4111-8111-111111111111', ?, 'piece', 1, 1, 0, 0, 1, 'now', 'now'),
              ('u2', '11111111-1111-4111-8111-111111111111', ?, 'carton', 24, 0, 1, 0, 1, 'now', 'now')`,
      [productId, productId],
    )

    const expectedLine = computeItemTotalRounded(
      { quantity: 2, unitPrice: 1000, discount: 0 },
      'AFN',
    )
    const expected = sumInvoiceLines({ lineTotals: [expectedLine], currency: 'AFN' })

    const invoice = await engine.request<{
      total: number
      items: Array<{ quantity: number; unit: string }>
    }>({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [
          {
            productId,
            productName: 'Carton product',
            quantity: 2,
            unit: 'carton',
            unitPrice: 1000,
            discount: 0,
          },
        ],
      },
    })
    expect(invoice.status).toBe(201)
    expect(invoice.data.total).toBe(expected.total)
    // The DOCUMENT is in the unit the person typed.
    expect(invoice.data.items[0]?.quantity).toBe(2)
    expect(invoice.data.items[0]?.unit).toBe('carton')

    const movement = db.get<{ quantity: number }>(
      "SELECT quantity FROM inventory_movement WHERE product_id = ? AND type = 'sale'",
      [productId],
    )
    expect(Number(movement?.quantity)).toBe(48)
    const product = db.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [
      productId,
    ])
    expect(Number(product?.quantity)).toBe(-48)

    // The same pure function the server calls.
    const direct = toBaseQuantity(2, 'carton', [
      {
        unitId: 'u1',
        unitCode: 'piece',
        conversionFactorToBase: 1,
        isBaseUnit: true,
        isPurchaseDefault: false,
        isSaleDefault: false,
      },
      {
        unitId: 'u2',
        unitCode: 'carton',
        conversionFactorToBase: 24,
        isBaseUnit: false,
        isPurchaseDefault: true,
        isSaleDefault: false,
      },
    ])
    expect(direct).toEqual({ ok: true, baseQuantity: 48, baseUnitCode: 'piece' })
  })

  it('15 g × 33,000,000 = 495,000,000 and stock moves in grams', async () => {
    const created = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/products',
      body: { name: 'Necklace', unit: 'gram', quantity: 0, warehouseId: TEST_WAREHOUSE_ID },
    })
    const productId = created.data.id
    db.run(
      `INSERT INTO product_units
        (id, workspace_id, product_id, unit_code, conversion_factor_to_base,
         is_base_unit, is_purchase_default, is_sale_default, is_active, created_at, updated_at)
       VALUES ('g1', '11111111-1111-4111-8111-111111111111', ?, 'gram', 1, 1, 0, 0, 1, 'now', 'now')`,
      [productId],
    )

    const invoice = await engine.request<{ total: number }>({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [
          {
            productId,
            productName: 'Necklace',
            quantity: 15,
            unit: 'gram',
            unitPrice: 33_000_000,
            discount: 0,
          },
        ],
      },
    })
    expect(invoice.status).toBe(201)
    expect(invoice.data.total).toBe(495_000_000)
    const movement = db.get<{ quantity: number }>(
      'SELECT quantity FROM inventory_movement WHERE product_id = ?',
      [productId],
    )
    expect(Number(movement?.quantity)).toBe(15)
  })

  it('refuses a unit the product does not declare instead of storing it as base', async () => {
    const created = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/products',
      body: { name: 'Only pieces', unit: 'piece', quantity: 10, warehouseId: TEST_WAREHOUSE_ID },
    })
    const productId = created.data.id
    db.run(
      `INSERT INTO product_units
        (id, workspace_id, product_id, unit_code, conversion_factor_to_base,
         is_base_unit, is_purchase_default, is_sale_default, is_active, created_at, updated_at)
       VALUES ('p1', '11111111-1111-4111-8111-111111111111', ?, 'piece', 1, 1, 0, 0, 1, 'now', 'now')`,
      [productId],
    )
    const movementsBefore =
      db.get<{ n: number }>('SELECT COUNT(*) AS n FROM inventory_movement')?.n ?? 0
    const refused = await engine.request<{ error: string }>({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [
          {
            productId,
            productName: 'Only pieces',
            quantity: 1,
            unit: 'carton',
            unitPrice: 100,
            discount: 0,
          },
        ],
      },
    })
    expect(refused.status).toBe(400)
    expect(refused.data.error).toMatch(/UNIT_NOT_AVAILABLE_FOR_PRODUCT/)
    // Nothing was written: a refused line must never leave half a purchase.
    expect(db.get<{ n: number }>('SELECT COUNT(*) AS n FROM inventory_movement')?.n).toBe(
      movementsBefore,
    )
  })
})
