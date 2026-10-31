// ============================================
// What the offline fixes actually DO when called, not that the functions exist.
//
//  - backup: every table of the local schema is in the file, not a hand-picked
//    twelve, and a failed table is named instead of vanishing;
//  - import: opening stock lands as a movement + warehouse figure + cost layer
//    (the same write the product form makes), a repeat of the same file creates
//    nothing twice, and a queued import reaches the outbox;
//  - price lists reach the outbox when the device is queueing.
// ============================================

import { localTableSchema } from '@hisabche/app-bridge'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, TEST_WORKSPACE_ID, createTestEngine } from './test-db'

const QUEUE = { 'x-hisabche-queue': '1', 'x-workspace-id': TEST_WORKSPACE_ID }

describe('offline fixes behave when called', () => {
  let db: ReturnType<typeof createTestDb>
  let engine: ReturnType<typeof createTestEngine>

  beforeEach(() => {
    db = createTestDb()
    engine = createTestEngine(db)
  })

  const queued = (entity: string) =>
    db.all<{ client_id: string; operation: string }>(
      'SELECT client_id, operation FROM sync_queue WHERE entity = ?',
      [entity],
    )

  it('backup carries every table of the local schema and the pending queue', async () => {
    const res = await engine.request<
      Record<string, unknown> & { meta: { failedTables: string[] } }
    >({ method: 'GET', path: '/workspaces/backup' })

    expect(res.status).toBe(200)
    for (const table of [...localTableSchema.options, 'sync_queue']) {
      expect(Object.keys(res.data), `table ${table} missing from the backup`).toContain(table)
    }
    expect(res.data.meta.failedTables).toEqual([])
  })

  it('import writes opening stock as movement + warehouse figure + cost layer', async () => {
    const res = await engine.request<{ imported: number; skipped: number; failed: number }>({
      method: 'POST',
      path: '/migrations/commit',
      body: {
        entity: 'products',
        records: [{ name: 'برنج', barcode: 'B-1', sellPrice: 90, buyPrice: 60, quantity: 12 }],
      },
    })
    expect(res.status).toBe(201)
    expect(res.data).toMatchObject({ imported: 1, skipped: 0, failed: 0 })

    const product = db.get<{ id: string; quantity: number }>(
      "SELECT id, quantity FROM product WHERE barcode = 'B-1'",
    )!
    expect(product.quantity).toBe(12)
    expect(
      db.get<{ qty: number }>('SELECT qty FROM product_stock WHERE product_id = ?', [product.id])
        ?.qty,
    ).toBe(12)
    expect(
      db.get<{ remaining_qty: number; unit_cost: number }>(
        'SELECT remaining_qty, unit_cost FROM cost_layer WHERE product_id = ?',
        [product.id],
      ),
    ).toMatchObject({ remaining_qty: 12 })
    expect(
      db.get<{ n: number }>('SELECT COUNT(*) AS n FROM inventory_movement WHERE product_id = ?', [
        product.id,
      ])?.n,
    ).toBe(1)
  })

  it('a price-less import makes stock but no cost layer (unknown is not zero)', async () => {
    await engine.request({
      method: 'POST',
      path: '/migrations/commit',
      body: { entity: 'products', records: [{ name: 'بی‌قیمت', barcode: 'B-2', quantity: 5 }] },
    })
    const id = db.get<{ id: string }>("SELECT id FROM product WHERE barcode = 'B-2'")!.id
    expect(
      db.get<{ n: number }>('SELECT COUNT(*) AS n FROM cost_layer WHERE product_id = ?', [id])?.n,
    ).toBe(0)
  })

  it('importing the same file twice creates nothing twice and says what it skipped', async () => {
    const body = {
      entity: 'customers',
      records: [
        { name: 'احمد', phone: '0700000001' },
        { name: 'محمود', phone: '0700000002' },
        { name: '' },
      ],
    }
    const first = await engine.request<{ imported: number; skipped: number }>({
      method: 'POST',
      path: '/migrations/commit',
      body,
    })
    const second = await engine.request<{ imported: number; skipped: number }>({
      method: 'POST',
      path: '/migrations/commit',
      body,
    })

    expect(first.data).toMatchObject({ imported: 2, skipped: 1 })
    expect(second.data).toMatchObject({ imported: 0, skipped: 3 })
    expect(db.get<{ n: number }>('SELECT COUNT(*) AS n FROM customer')?.n).toBe(2)
  })

  it('a queued import reaches the outbox, one entry per row, keyed by the row id', async () => {
    await engine.request({
      method: 'POST',
      path: '/migrations/commit',
      headers: QUEUE,
      body: { entity: 'customers', records: [{ name: 'احمد', phone: '0700000001' }] },
    })

    const rows = queued('customer')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.operation).toBe('create')
    expect(db.get<{ id: string }>("SELECT id FROM customer WHERE phone = '0700000001'")?.id).toBe(
      rows[0]?.client_id,
    )
  })

  it('a price list made on a queueing device reaches the outbox', async () => {
    const res = await engine.request({
      method: 'POST',
      path: '/price-lists',
      headers: QUEUE,
      body: { name: 'عمده', currency: 'AFN', validFrom: null, validTo: null },
    })
    expect(res.status).toBe(201)
    expect(queued('price_list')).toHaveLength(1)
  })
})
