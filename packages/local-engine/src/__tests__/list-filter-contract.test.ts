// ============================================
// The device obeys the same filter contract as the server: an UNSET filter is
// NO filter (undefined, null, '' and the words a URL leaves behind); only an
// explicit false is «the false ones».
//
// The server twin is backend/src/__tests__/list-filter-contract-http.test.ts.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import type { LocalDb } from '../db'
import { createTestDb, TEST_WAREHOUSE_ID, TEST_WORKSPACE_ID } from './test-db'

const UNSET_FORMS: Array<Record<string, unknown>> = [
  {},
  { isActive: undefined },
  { isActive: null },
  { isActive: '' },
  { isActive: 'undefined' },
  { isActive: 'null' },
]

describe('list filters on the device', () => {
  let db: LocalDb
  let engine: ReturnType<typeof createLocalEngine>

  const get = async (path: string, params: Record<string, unknown> = {}) => {
    const res = await engine.request({ method: 'GET', path, params: params as never })
    expect(res.status).toBe(200)
    return res.data as Record<string, unknown[]> & unknown[]
  }

  beforeEach(async () => {
    db = createTestDb()
    engine = createLocalEngine(db)
    for (const name of ['علی', 'کریم', 'حاجی']) {
      const res = await engine.request({
        method: 'POST',
        path: '/customers',
        body: { fullName: name, type: 'cash' },
      })
      expect(res.status).toBe(201)
    }
    db.run("UPDATE customer SET is_active = 0 WHERE full_name = 'کریم'")
    db.run(
      `INSERT INTO supplier (id, workspace_id, name, is_active, created_at, updated_at, origin, sync_state)
       VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', ?, 'تأمین‌کننده‌ی فعال', 1, datetime('now'), datetime('now'), 'local', 'local_only'),
              ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', ?, 'تأمین‌کننده‌ی غیرفعال', 0, datetime('now'), datetime('now'), 'local', 'local_only')`,
      [TEST_WORKSPACE_ID, TEST_WORKSPACE_ID],
    )
  })

  it('customers: every spelling of «unset» lists everyone', async () => {
    for (const params of UNSET_FORMS) {
      const page = await get('/customers', params)
      expect(page.customers, JSON.stringify(params)).toHaveLength(3)
    }
  })

  it('customers: explicit false is the inactive ones, explicit true the active ones', async () => {
    expect((await get('/customers', { isActive: 'false' })).customers).toHaveLength(1)
    expect((await get('/customers', { isActive: false })).customers).toHaveLength(1)
    expect((await get('/customers', { isActive: 'true' })).customers).toHaveLength(2)
  })

  it('customers: an unset hasBalance is no filter', async () => {
    for (const hasBalance of [undefined, null, '', 'null']) {
      const page = await get('/customers', { hasBalance })
      expect(page.customers, String(hasBalance)).toHaveLength(3)
    }
  })

  it('suppliers: unset isActive lists everyone; false and true filter', async () => {
    for (const params of UNSET_FORMS) {
      const page = await get('/suppliers', params)
      // The engine answers a bare array, like the server.
      expect(page as unknown as unknown[], JSON.stringify(params)).toHaveLength(2)
    }
    expect(await get('/suppliers', { isActive: 'false' })).toHaveLength(1)
    expect(await get('/suppliers', { isActive: 'true' })).toHaveLength(1)
  })

  // The owner's real case: «طلا» ten grams in «خانه», and the invoice picker
  // asks with the filters it always sends, none of them set.
  it('the gold in the warehouse is listed, with its 10 grams, when no filter is set', async () => {
    const created = await engine.request({
      method: 'POST',
      path: '/products',
      body: {
        name: 'طلای ابشده',
        unit: 'gram',
        buyPrice: 30000000,
        sellPrice: 25000000,
        quantity: 10,
        warehouseId: TEST_WAREHOUSE_ID,
      },
    })
    expect(created.status).toBe(201)

    const picker = {
      warehouseId: TEST_WAREHOUSE_ID,
      limit: 100,
      page: 1,
      search: '',
      sortBy: 'created_at',
      sortDirection: 'desc',
      isActive: undefined,
      lowStock: undefined,
      category: undefined,
      barcode: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      includeSummary: undefined,
      cursor: undefined,
    }
    const list = await get('/products', picker)
    expect((list.products as Array<{ name: string }>).map((p) => p.name)).toEqual(['طلای ابشده'])

    const placement = (await get('/warehouses/placement')) as unknown as {
      stock: Array<{ productId: string; warehouseId: string; quantity: number }>
    }
    expect(placement.stock).toHaveLength(1)
    expect(placement.stock[0]).toMatchObject({ warehouseId: TEST_WAREHOUSE_ID, quantity: 10 })
  })

  it('another warehouse does not list the gold', async () => {
    await engine.request({
      method: 'POST',
      path: '/products',
      body: { name: 'طلا', unit: 'gram', quantity: 10, warehouseId: TEST_WAREHOUSE_ID },
    })
    const other = await get('/products', { warehouseId: '99999999-9999-4999-8999-999999999999' })
    expect(other.products).toHaveLength(0)
  })
})
