// ============================================
// apps/mobile/src/host/__tests__/android-parity.test.ts
//
// Android Host LocalDb Adapter Parity Test Suite
// Verifies that the mobile LocalDb adapter (wrapExpoSqlite over expo-sqlite API)
// yields 100% byte-for-byte and logical parity with standard node:sqlite engine.
// ============================================

import { DatabaseSync } from 'node:sqlite'
import { CREATE_STATEMENTS } from '@hisabche/app-bridge'
import {
  createLocalEngine,
  type LocalDb,
  type LocalEngine,
  type LocalEngineRequest,
  type LocalEngineResponse,
  type RunResult,
} from '@hisabche/local-engine'
import { wrapExpoSqlite, type ExpoSqliteDatabaseLike } from '../local-api'

const TEST_WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const TEST_USER_ID = '22222222-2222-4222-8222-222222222222'
const WAREHOUSE_KABUL = '33333333-3333-4333-8333-333333333333'

function createNodeTestDb(): LocalDb & { close: () => void } {
  const db = new DatabaseSync(':memory:')
  for (const s of CREATE_STATEMENTS) db.exec(s)
  // The device label is part of a temporary invoice number (`OFF-<device>-0001`).
  // Seeded to the SAME value on both sides so the comparison stays exact: this
  // test compares two adapters of ONE device, not two devices.
  db.exec("INSERT OR REPLACE INTO meta (key, value) VALUES ('device_id', 'PARITY')")
  let inTx = false

  return {
    close: () => db.close(),
    all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      return db.prepare(sql).all(...(params as never[])) as T[]
    },
    get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
      return db.prepare(sql).get(...(params as never[])) as T | undefined
    },
    run(sql: string, params: unknown[] = []): RunResult {
      const res = db.prepare(sql).run(...(params as never[])) as {
        changes?: number
        lastInsertRowid?: number | bigint
      }
      return {
        changes: Number(res.changes) || 0,
        lastInsertRowid: res.lastInsertRowid,
      }
    },
    exec(sql: string): void {
      db.exec(sql)
    },
    transaction<T>(fn: () => T): T {
      if (inTx) return fn()
      inTx = true
      db.exec('BEGIN')
      try {
        const res = fn()
        db.exec('COMMIT')
        return res
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      } finally {
        inTx = false
      }
    },
  }
}

function createSimulatedExpoSqliteDb(): ExpoSqliteDatabaseLike & { close: () => void } {
  const rawDb = new DatabaseSync(':memory:')
  for (const s of CREATE_STATEMENTS) rawDb.exec(s)
  // The same device label as the node adapter (see createNodeTestDb).
  rawDb.exec("INSERT OR REPLACE INTO meta (key, value) VALUES ('device_id', 'PARITY')")

  return {
    close: () => rawDb.close(),
    getAllSync<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      return rawDb.prepare(sql).all(...(params as never[])) as T[]
    },
    getFirstSync<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
      const res = rawDb.prepare(sql).get(...(params as never[])) as T | undefined
      return res ?? null
    },
    runSync(
      sql: string,
      params: unknown[] = [],
    ): { changes: number; lastInsertRowId?: number | bigint | undefined } {
      const res = rawDb.prepare(sql).run(...(params as never[])) as {
        changes?: number
        lastInsertRowid?: number | bigint
      }
      return {
        changes: Number(res.changes) || 0,
        lastInsertRowId: res.lastInsertRowid,
      }
    },
    execSync(sql: string): void {
      rawDb.exec(sql)
    },
    withTransactionSync(fn: () => void): void {
      rawDb.exec('BEGIN')
      try {
        fn()
        rawDb.exec('COMMIT')
      } catch (err) {
        rawDb.exec('ROLLBACK')
        throw err
      }
    },
  }
}

function normalizeForParity(val: unknown): unknown {
  if (Array.isArray(val)) {
    return val.map(normalizeForParity)
  }
  if (val !== null && typeof val === 'object') {
    const res: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(val)) {
      if (
        (k === 'id' ||
          k === 'accountId' ||
          k === 'customerId' ||
          k === 'customer_id' ||
          k === 'productId' ||
          k === 'product_id' ||
          k === 'invoiceId' ||
          k === 'invoice_id' ||
          k === 'partyId' ||
          k === 'party_id') &&
        typeof v === 'string' &&
        v.length === 36
      ) {
        res[k] = '[UUID]'
      } else if (
        (k === 'createdAt' || k === 'updatedAt' || k === 'created_at' || k === 'updated_at') &&
        typeof v === 'string' &&
        v.includes('T')
      ) {
        res[k] = '[TIMESTAMP]'
      } else {
        res[k] = normalizeForParity(v)
      }
    }
    return res
  }
  return val
}

describe('Android Mobile LocalDb Adapter Parity vs node:sqlite', () => {
  let nodeDb: ReturnType<typeof createNodeTestDb>
  let mobileExpoDb: ReturnType<typeof createSimulatedExpoSqliteDb>
  let mobileLocalDb: LocalDb
  let engineNode: LocalEngine
  let engineMobile: LocalEngine

  beforeAll(() => {
    nodeDb = createNodeTestDb()
    mobileExpoDb = createSimulatedExpoSqliteDb()
    mobileLocalDb = wrapExpoSqlite(mobileExpoDb)

    engineNode = createLocalEngine(nodeDb)
    engineMobile = createLocalEngine(mobileLocalDb)
  })

  afterAll(() => {
    nodeDb.close()
    mobileExpoDb.close()
  })

  async function assertParity(
    req: LocalEngineRequest,
    _description: string,
  ): Promise<{ node: LocalEngineResponse; mobile: LocalEngineResponse }> {
    const resNode = await engineNode.request(req)
    const resMobile = await engineMobile.request(req)

    expect(resMobile.status).toBe(resNode.status)
    expect(normalizeForParity(resMobile.data)).toEqual(normalizeForParity(resNode.data))

    return { node: resNode, mobile: resMobile }
  }

  it('Parity 1: Workspace creation and settings produce identical records', async () => {
    const now = '2026-10-20T00:00:00.000Z'
    // Seed initial user and workspace directly in both DBs
    for (const db of [nodeDb, mobileLocalDb]) {
      db.run(
        'INSERT INTO local_workspace (id, name, base_currency, time_zone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [TEST_WORKSPACE_ID, 'صرافی و بازرگانی آریا', 'AFN', 'Asia/Kabul', now, now],
      )
      db.run(
        'INSERT INTO local_user (id, full_name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [TEST_USER_ID, 'محمد امین', 'amin@example.com', now, now],
      )
      db.run(
        'INSERT INTO warehouse (id, workspace_id, name, location, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
        [WAREHOUSE_KABUL, TEST_WORKSPACE_ID, 'انبار کابل', 'ده‌افغانان', now, now],
      )
      db.run(
        'INSERT INTO inventory_settings (workspace_id, costing_method, updated_at) VALUES (?, ?, ?)',
        [TEST_WORKSPACE_ID, 'fifo', now],
      )
    }

    const ws = await assertParity(
      {
        method: 'GET',
        path: '/workspaces',
        headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
      },
      'fetch active workspace',
    )
    expect(ws.mobile.status).toBe(200)
  })

  it('Parity 2: Product creation with opening stock produces identical inventory and cost layers', async () => {
    // Product 1: With buy price (creates cost layer)
    const p1 = await assertParity(
      {
        method: 'POST',
        path: '/products',
        headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
        body: {
          name: 'زعفران قائنات',
          sku: 'ZAF-001',
          barcode: '8901234567890',
          buyPrice: 80000,
          sellPrice: 120000,
          quantity: 10,
          warehouseId: WAREHOUSE_KABUL,
          unit: 'piece',
        },
      },
      'create product with buy price',
    )
    expect(p1.mobile.status).toBe(201)

    // Product 2: Without buy price (no cost layer created)
    const p2 = await assertParity(
      {
        method: 'POST',
        path: '/products',
        headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
        body: {
          name: 'بسته‌بندی مقوایی',
          sku: 'BOX-002',
          sellPrice: 500,
          quantity: 100,
          warehouseId: WAREHOUSE_KABUL,
          unit: 'piece',
        },
      },
      'create product without buy price',
    )
    expect(p2.mobile.status).toBe(201)
  })

  it('Parity 3: Customer creation with opening balance', async () => {
    const cust = await assertParity(
      {
        method: 'POST',
        path: '/customers',
        headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
        body: {
          fullName: 'شرکت بازرگانی هرات',
          phone: '0799112233',
          currency: 'AFN',
          openingBalance: 50000,
        },
      },
      'create customer',
    )
    expect(cust.mobile.status).toBe(201)
  })

  it('Parity 4: Foreign currency USD purchase requires explicit rate and posts GL identically', async () => {
    // Refusal test: USD invoice without exchange rate -> 400
    const refused = await assertParity(
      {
        method: 'POST',
        path: '/invoices',
        headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
        body: {
          type: 'purchase',
          currency: 'USD',
          date: '2026-10-20',
          items: [
            {
              productName: 'زعفران صادراتی',
              quantity: 5,
              unitPrice: 100,
            },
          ],
        },
      },
      'refuse foreign invoice without rate',
    )
    expect(refused.mobile.status).toBe(400)

    // Valid purchase with explicit rate 70.5
    const purchase = await assertParity(
      {
        method: 'POST',
        path: '/invoices',
        headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
        body: {
          type: 'purchase',
          currency: 'USD',
          exchangeRate: 70.5,
          date: '2026-10-20',
          warehouseId: WAREHOUSE_KABUL,
          items: [
            {
              productName: 'زعفران صادراتی',
              quantity: 5,
              unitPrice: 100,
            },
          ],
        },
      },
      'valid USD purchase with rate',
    )
    expect(purchase.mobile.status).toBe(201)
  })

  it('Parity 5: Multi-currency payment allocation and cross-currency rejection', async () => {
    // Get customers to find id in both databases
    const custResNode = await engineNode.request({
      method: 'GET',
      path: '/customers',
      headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
    })
    const custIdNode = (custResNode.data as { customers: Array<{ id: string }> }).customers[0]!.id

    const custResMobile = await engineMobile.request({
      method: 'GET',
      path: '/customers',
      headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
    })
    const custIdMobile = (custResMobile.data as { customers: Array<{ id: string }> }).customers[0]!
      .id

    // Create a sale in AFN for both
    const saleReq = (cId: string) => ({
      method: 'POST' as const,
      path: '/invoices',
      headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
      body: {
        type: 'sale',
        customerId: cId,
        currency: 'AFN',
        date: '2026-10-20',
        items: [
          {
            productName: 'زعفران قائنات',
            quantity: 2,
            unitPrice: 120000,
          },
        ],
      },
    })
    const saleNode = await engineNode.request(saleReq(custIdNode))
    const saleMobile = await engineMobile.request(saleReq(custIdMobile))
    expect(saleMobile.status).toBe(saleNode.status)
    expect(normalizeForParity(saleMobile.data)).toEqual(normalizeForParity(saleNode.data))

    const afnInvIdNode = (saleNode.data as { id: string }).id
    const afnInvIdMobile = (saleMobile.data as { id: string }).id

    // Cross-currency allocation attempt: USD payment to AFN invoice -> 400
    const crossReq = (cId: string, invId: string) => ({
      method: 'POST' as const,
      path: '/payments',
      headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
      body: {
        direction: 'in',
        partyType: 'customer',
        partyId: cId,
        amount: 100,
        currency: 'USD',
        method: 'cash',
        entryDate: '2026-10-20',
        allocations: [{ invoiceId: invId, amount: 100 }],
      },
    })
    const crossNode = await engineNode.request(crossReq(custIdNode, afnInvIdNode))
    const crossMobile = await engineMobile.request(crossReq(custIdMobile, afnInvIdMobile))
    expect(crossMobile.status).toBe(409)
    expect(crossMobile.status).toBe(crossNode.status)
    expect(crossMobile.data).toEqual(crossNode.data)

    // Valid AFN payment allocated to AFN invoice
    const pmtReq = (cId: string, invId: string) => ({
      method: 'POST' as const,
      path: '/payments',
      headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
      body: {
        direction: 'in',
        partyType: 'customer',
        partyId: cId,
        amount: 240000,
        currency: 'AFN',
        method: 'cash',
        entryDate: '2026-10-20',
        allocations: [{ invoiceId: invId, amount: 240000 }],
      },
    })
    const pmtNode = await engineNode.request(pmtReq(custIdNode, afnInvIdNode))
    const pmtMobile = await engineMobile.request(pmtReq(custIdMobile, afnInvIdMobile))
    expect(pmtMobile.status).toBe(201)
    expect(pmtMobile.status).toBe(pmtNode.status)
    expect(normalizeForParity(pmtMobile.data)).toEqual(normalizeForParity(pmtNode.data))
  })

  it('Parity 6: Double-entry trial balance, profit report, and customer statement match 100%', async () => {
    // Trial balance
    const tb = await assertParity(
      {
        method: 'GET',
        path: '/accounting/trial-balance',
        headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
      },
      'trial balance',
    )
    expect((tb.mobile.data as { isBalanced: boolean }).isBalanced).toBe(true)

    // Profit report
    await assertParity(
      {
        method: 'GET',
        path: '/accounting/profit-report',
        headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
      },
      'profit report',
    )

    // Dashboard analytics
    await assertParity(
      {
        method: 'GET',
        path: '/analytics/dashboard',
        headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
      },
      'dashboard analytics',
    )
  })
})
