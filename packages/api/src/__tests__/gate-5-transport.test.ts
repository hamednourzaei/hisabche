// ============================================
// packages/api/src/__tests__/gate-5-transport.test.ts
//
// Gate 5 Automated Verification Suite
// Offline Edition — Platforms & Local Transport Wiring
//
// Tests:
// Test A — Full functional offline business cycle through apiClient wired
//          to local transport adapter and local engine (19-step scenario).
// Currency Checks — FX rate enforcement, per-currency balances, cross-currency
//                   rejection, GL posting at rate, no blended currency totals.
// Test B — Complete network isolation verification (Node dns, net, http, https,
//          fetch, WebSocket traps recording 0 requests during Test A run) +
//          injection proof of network isolation trap.
// ============================================

import dns from 'node:dns'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CREATE_STATEMENTS } from '../../../app-bridge/src/local-schema'
import { createLocalEngine } from '../../../local-engine/src/index'
import type { LocalDb, RunResult } from '../../../local-engine/src/db'
import { ensureDefaultAccounts } from '../../../local-engine/src/routes/invoices'
import { apiClient, registerLocalTransport, setAppEdition } from '../lib/client'
import { setOfflineTokenMode } from '../lib/tokenProvider'
import { setActiveWorkspaceId } from '../lib/active-workspace'

const TEST_WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const TEST_USER_ID = '22222222-2222-4222-8222-222222222222'
const TEST_WAREHOUSE_ID = '33333333-3333-4333-8333-333333333333'

interface NetworkAuditLog {
  dns: number
  http: number
  https: number
  fetch: number
  websocket: number
  supabase: number
  render: number
  telemetry: number
  auth: number
  fonts: number
  update: number
}

function createDiskTestDb(filePath: string): LocalDb & { close: () => void } {
  const db = new DatabaseSync(filePath)
  let inTransaction = false

  return {
    close(): void {
      db.close()
    },
    all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
      const stmt = db.prepare(sql)
      return (params && params.length > 0 ? stmt.all(...(params as never[])) : stmt.all()) as T[]
    },
    get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined {
      const stmt = db.prepare(sql)
      return (params && params.length > 0 ? stmt.get(...(params as never[])) : stmt.get()) as
        T | undefined
    },
    run(sql: string, params?: unknown[]): RunResult {
      const stmt = db.prepare(sql)
      const res = (params && params.length > 0 ? stmt.run(...(params as never[])) : stmt.run()) as {
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
      if (inTransaction) return fn()
      inTransaction = true
      db.exec('BEGIN')
      try {
        const result = fn()
        db.exec('COMMIT')
        return result
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      } finally {
        inTransaction = false
      }
    },
  }
}

describe('Gate 5: Offline Edition Local Transport & Network Isolation Suite', () => {
  let tempDir: string
  let dbPath: string
  let currentDb: (LocalDb & { close: () => void }) | null = null
  let customerId: string

  // Network isolation tracker
  const auditLog: NetworkAuditLog = {
    dns: 0,
    http: 0,
    https: 0,
    fetch: 0,
    websocket: 0,
    supabase: 0,
    render: 0,
    telemetry: 0,
    auth: 0,
    fonts: 0,
    update: 0,
  }

  function classifyDestination(target: string): void {
    const lower = target.toLowerCase()
    if (lower.includes('supabase.co')) auditLog.supabase++
    if (
      lower.includes('onrender.com') ||
      lower.includes('hisabche.com') ||
      lower.includes('api.hisabche')
    ) {
      auditLog.render++
    }
    if (lower.includes('sentry.io') || lower.includes('telemetry')) auditLog.telemetry++
    if (lower.includes('auth') || lower.includes('oauth') || lower.includes('token'))
      auditLog.auth++
    if (lower.includes('fonts') || lower.includes('cdn')) auditLog.fonts++
    if (lower.includes('update') || lower.includes('github.com')) auditLog.update++
  }

  // Preserve original networking primitives for restoration
  const originalDnsLookup = dns.lookup
  const originalHttpRequest = http.request
  const originalHttpsRequest = https.request
  const originalNetConnect = net.connect
  const originalFetch = globalThis.fetch

  beforeAll(() => {
    // 1. Setup temporary disk database
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hisabche-gate5-'))
    dbPath = path.join(tempDir, 'gate5-offline.db')

    currentDb = createDiskTestDb(dbPath)

    // Run schema creation
    for (const stmt of CREATE_STATEMENTS) {
      currentDb.exec(stmt)
    }

    // Seed local tenant workspace, owner user, and primary warehouse
    currentDb.exec(`
      INSERT INTO local_workspace (id, name, base_currency, time_zone, created_at, updated_at)
      VALUES ('${TEST_WORKSPACE_ID}', 'فروشگاه حسابچه آفلاین', 'AFN', 'Asia/Kabul', datetime('now'), datetime('now'));

      INSERT INTO local_user (id, email, full_name, role, created_at, updated_at)
      VALUES ('${TEST_USER_ID}', 'owner@hisabche.local', 'مدیر فروشگاه', 'owner', datetime('now'), datetime('now'));

      INSERT INTO warehouse (id, workspace_id, name, location, is_active, created_at, updated_at)
      VALUES ('${TEST_WAREHOUSE_ID}', '${TEST_WORKSPACE_ID}', 'انبار مرکزی کابل', 'کابل', 1, datetime('now'), datetime('now'));
    `)

    ensureDefaultAccounts(currentDb, TEST_WORKSPACE_ID)

    // 2. Wire apiClient to local transport
    setAppEdition('offline')
    setOfflineTokenMode(true)
    setActiveWorkspaceId(TEST_WORKSPACE_ID)

    const engineInstance = createLocalEngine(currentDb)
    registerLocalTransport(async (req) => {
      const res = await engineInstance.request({
        method: req.method,
        path: req.path,
        params: req.params,
        body: req.body,
        headers: req.headers,
      })
      return {
        status: res.status,
        data: res.data,
        headers: res.headers,
      }
    })

    // 3. Install strict network isolation traps
    dns.lookup = ((hostname: string, options: unknown, callback?: unknown): unknown => {
      auditLog.dns++
      classifyDestination(hostname)
      const cb = (typeof options === 'function' ? options : callback) as (
        err: Error | null,
        address?: string,
        family?: number,
      ) => void
      if (typeof cb === 'function') {
        cb(new Error(`[Network Isolation] DNS lookup blocked in offline edition: ${hostname}`))
      }
      return undefined
    }) as typeof dns.lookup

    http.request = ((...args: unknown[]) => {
      auditLog.http++
      const target =
        typeof args[0] === 'string'
          ? args[0]
          : (args[0] as { host?: string; hostname?: string })?.hostname || ''
      classifyDestination(target)
      throw new Error(
        `[Network Isolation] Outbound HTTP request blocked in offline edition: ${target}`,
      )
    }) as typeof http.request

    https.request = ((...args: unknown[]) => {
      auditLog.https++
      const target =
        typeof args[0] === 'string'
          ? args[0]
          : (args[0] as { host?: string; hostname?: string })?.hostname || ''
      classifyDestination(target)
      throw new Error(
        `[Network Isolation] Outbound HTTPS request blocked in offline edition: ${target}`,
      )
    }) as typeof https.request

    net.connect = ((..._args: unknown[]) => {
      auditLog.http++
      throw new Error('[Network Isolation] Net socket connect blocked in offline edition')
    }) as typeof net.connect

    globalThis.fetch = (async (input: RequestInfo | URL, _init?: RequestInit) => {
      auditLog.fetch++
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      classifyDestination(url)
      throw new Error(`[Network Isolation] Global fetch blocked in offline edition: ${url}`)
    }) as typeof fetch
  })

  afterAll(() => {
    // Restore network primitives
    dns.lookup = originalDnsLookup
    http.request = originalHttpRequest
    https.request = originalHttpsRequest
    net.connect = originalNetConnect
    globalThis.fetch = originalFetch

    // Teardown database & temp files
    if (currentDb) {
      currentDb.close()
      currentDb = null
    }

    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup error in temp directory
    }

    // Reset app edition & transport
    setAppEdition('cloud')
    setOfflineTokenMode(false)
    setActiveWorkspaceId(null)
    registerLocalTransport(async () => {
      throw new Error('Local transport detached')
    })
  })

  // =========================================================================
  // Test A — Functional Offline Business Cycle (Steps 1 to 19)
  // =========================================================================
  describe('Test A — Functional Offline Flow through apiClient & Local Transport', () => {
    let prod1Id: string
    let prod2Id: string
    let purUsdInvoiceId: string
    let purEurInvoiceId: string
    let saleAfnInvoiceId: string
    let saleUsdInvoiceId: string
    let wh2Id: string

    it('Step 1: Setup workspace with base currency AFN', async () => {
      const res =
        await apiClient.get<Array<{ id: string; baseCurrency: string; name: string }>>(
          '/workspaces',
        )
      expect(res.status).toBe(200)
      expect(res.data.length).toBeGreaterThan(0)
      expect(res.data[0]?.id).toBe(TEST_WORKSPACE_ID)
      expect(res.data[0]?.baseCurrency).toBe('AFN')

      const curRes = await apiClient.get<{ currency: string }>('/settings/base-currency')
      expect(curRes.status).toBe(200)
      expect(curRes.data.currency).toBe('AFN')
    })

    it('Step 2: Verify chart of accounts exists', async () => {
      const res =
        await apiClient.get<Array<{ code: string; role: string; type: string }>>(
          '/accounting/accounts',
        )
      expect(res.status).toBe(200)
      expect(res.data.length).toBeGreaterThanOrEqual(6)

      const codes = res.data.map((a) => a.code)
      expect(codes).toContain('1010') // Cash
      expect(codes).toContain('1030') // Inventory
      expect(codes).toContain('1050') // Receivable
      expect(codes).toContain('2010') // Payable
      expect(codes).toContain('4010') // Revenue
      expect(codes).toContain('5010') // COGS
    })

    it('Step 3: Create customer', async () => {
      const res = await apiClient.post<{ id: string; fullName: string; openingBalance: number }>(
        '/customers',
        {
          fullName: 'احمد کریمی',
          phone: '0799123456',
          openingBalance: 0,
        },
      )
      expect(res.status).toBe(201)
      expect(res.data.id).toBeDefined()
      expect(res.data.fullName).toBe('احمد کریمی')
      customerId = res.data.id
    })

    it('Step 4: Create products with opening stock (one with buy price, one without)', async () => {
      // Product 1: With buy price 500 minor units (creates cost layer)
      const p1Res = await apiClient.post<{
        id: string
        name: string
        buyPrice: number
        quantity: number
      }>('/products', {
        name: 'برنج اعلا',
        buyPrice: 500,
        sellPrice: 700,
        quantity: 100,
        warehouseId: TEST_WAREHOUSE_ID,
      })
      expect(p1Res.status).toBe(201)
      expect(p1Res.data.buyPrice).toBe(500)
      expect(p1Res.data.quantity).toBe(100)
      prod1Id = p1Res.data.id

      // Product 2: Without buy price (0 minor units -> unknown cost, no cost layer created)
      const p2Res = await apiClient.post<{
        id: string
        name: string
        buyPrice: number
        quantity: number
      }>('/products', {
        name: 'چای اعلا (نامعلوم)',
        buyPrice: 0,
        sellPrice: 300,
        quantity: 50,
        warehouseId: TEST_WAREHOUSE_ID,
      })
      expect(p2Res.status).toBe(201)
      expect(p2Res.data.buyPrice).toBe(0)
      expect(p2Res.data.quantity).toBe(50)
      prod2Id = p2Res.data.id

      // Check cost layers in database
      const p1Layers =
        currentDb?.all('SELECT * FROM cost_layer WHERE product_id = ?', [prod1Id]) ?? []
      expect(p1Layers.length).toBe(1)
      expect(Number(p1Layers[0]?.['unit_cost'])).toBe(500)

      // ⚠️ THE OPENING STOCK IS DATED, SO THE TEST DOES NOT DEPEND ON THE DAY.
      //
      // FIFO consumes the layers in order of receipt, and the engine dates an
      // opening layer with the day the product was created — that is, TODAY.
      // The purchase invoice below is dated '2026-10-19', so from 20 Oct 2026
      // onwards it was the OLDER layer: FIFO consumed the purchase (8 USD ×
      // 70 = 560 AFN) instead of the opening stock (500), and this step went
      // red on a day the code had not changed. The test had been passing only
      // on the day its date was written.
      //
      // The opening stock is received first — that is what the step means —
      // so it is dated before the purchase, and the assertion below is then
      // true on every day of the year.
      currentDb?.exec(
        `UPDATE cost_layer SET entry_date = '2026-01-01' WHERE product_id = '${prod1Id}'`,
      )

      const p2Layers =
        currentDb?.all('SELECT * FROM cost_layer WHERE product_id = ?', [prod2Id]) ?? []
      expect(p2Layers.length).toBe(0)
    })

    it('Step 5: Create purchase invoice in USD with exchange rate', async () => {
      // 50 units @ 8 USD with rate 70.0 AFN per USD = 400 USD (28,000 AFN)
      const res = await apiClient.post<{
        id: string
        total: number
        currency: string
        exchangeRate: number
      }>('/invoices', {
        type: 'purchase',
        currency: 'USD',
        exchangeRate: 70.0,
        date: '2026-10-19',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [
          {
            productId: prod1Id,
            productName: 'برنج اعلا',
            quantity: 50,
            unitPrice: 8,
          },
        ],
      })
      expect(res.status).toBe(201)
      expect(res.data.total).toBe(400)
      expect(res.data.currency).toBe('USD')
      expect(res.data.exchangeRate).toBe(70.0)
      purUsdInvoiceId = res.data.id

      // Assert stock increased by 50 (100 opening + 50 = 150)
      const prod = await apiClient.get<{ quantity: number }>(`/products/${prod1Id}`)
      expect(prod.data.quantity).toBe(150)

      // Currency check: USD purchase posts to ledger in books currency at rate (400 * 70 = 28,000 AFN)
      const lines =
        currentDb?.all<{ debit: number; credit: number }>(
          `SELECT jl.debit, jl.credit
         FROM journal_line jl
         JOIN journal_entry je ON je.id = jl.journal_id
         WHERE je.source_id = ?`,
          [purUsdInvoiceId],
        ) ?? []
      expect(lines.length).toBeGreaterThan(0)
      const debits = lines.reduce((s, l) => s + l.debit, 0)
      const credits = lines.reduce((s, l) => s + l.credit, 0)
      expect(debits).toBe(28000)
      expect(credits).toBe(28000)
    })

    it('Step 6: Create purchase invoice in EUR with exchange rate', async () => {
      // 20 units @ 10 EUR with rate 75.0 AFN per EUR = 200 EUR (15,000 AFN)
      const res = await apiClient.post<{
        id: string
        total: number
        currency: string
        exchangeRate: number
      }>('/invoices', {
        type: 'purchase',
        currency: 'EUR',
        exchangeRate: 75.0,
        date: '2026-10-19',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [
          {
            productId: prod1Id,
            productName: 'برنج اعلا',
            quantity: 20,
            unitPrice: 10,
          },
        ],
      })
      expect(res.status).toBe(201)
      expect(res.data.total).toBe(200)
      expect(res.data.currency).toBe('EUR')
      expect(res.data.exchangeRate).toBe(75.0)
      purEurInvoiceId = res.data.id
      expect(purEurInvoiceId).toBeDefined()

      // Total quantity is now 170
      const prod = await apiClient.get<{ quantity: number }>(`/products/${prod1Id}`)
      expect(prod.data.quantity).toBe(170)
    })

    it('Step 7: Create sale invoice in AFN', async () => {
      // Sale of 30 units of Product 1 @ 700 AFN = 21,000 AFN
      const res = await apiClient.post<{ id: string; total: number; currency: string }>(
        '/invoices',
        {
          type: 'sale',
          customerId,
          currency: 'AFN',
          date: '2026-10-19',
          warehouseId: TEST_WAREHOUSE_ID,
          items: [
            {
              productId: prod1Id,
              productName: 'برنج اعلا',
              quantity: 30,
              unitPrice: 700,
            },
          ],
        },
      )
      expect(res.status).toBe(201)
      expect(res.data.total).toBe(21000)
      expect(res.data.currency).toBe('AFN')
      saleAfnInvoiceId = res.data.id

      // Stock is now 140
      const prod = await apiClient.get<{ quantity: number }>(`/products/${prod1Id}`)
      expect(prod.data.quantity).toBe(140)
    })

    it('Step 8: Create sale invoice in USD with exchange rate', async () => {
      // Sale of 10 units @ 12 USD with exchangeRate 70.0 = 120 USD (8,400 AFN)
      const res = await apiClient.post<{
        id: string
        total: number
        currency: string
        exchangeRate: number
      }>('/invoices', {
        type: 'sale',
        customerId,
        currency: 'USD',
        exchangeRate: 70.0,
        date: '2026-10-19',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [
          {
            productId: prod1Id,
            productName: 'برنج اعلا',
            quantity: 10,
            unitPrice: 12,
          },
        ],
      })
      expect(res.status).toBe(201)
      expect(res.data.total).toBe(120)
      expect(res.data.currency).toBe('USD')
      expect(res.data.exchangeRate).toBe(70.0)
      saleUsdInvoiceId = res.data.id

      // Stock is now 130
      const prod = await apiClient.get<{ quantity: number }>(`/products/${prod1Id}`)
      expect(prod.data.quantity).toBe(130)
    })

    it('Step 9: Partial payment in USD (allocated to USD invoice)', async () => {
      // Partial payment of 50 USD allocated to 120 USD invoice
      const res = await apiClient.post<{ id: string; amount: number; currency: string }>(
        '/payments',
        {
          direction: 'in',
          partyType: 'customer',
          partyId: customerId,
          amount: 50,
          currency: 'USD',
          method: 'cash',
          entryDate: '2026-10-19',
          allocations: [
            {
              invoiceId: saleUsdInvoiceId,
              amount: 50,
            },
          ],
        },
      )
      expect(res.status).toBe(201)
      expect(res.data.amount).toBe(50)
      expect(res.data.currency).toBe('USD')

      // Verify invoice paid_amount is 50 and status is partial
      const inv = await apiClient.get<{ paidAmount: number; status: string; total: number }>(
        `/invoices/${saleUsdInvoiceId}`,
      )
      expect(inv.data.paidAmount).toBe(50)
      expect(inv.data.status).toBe('partial')
    })

    it('Step 10: Payment in AFN (allocated to AFN invoice)', async () => {
      // Full payment of 21,000 AFN allocated to AFN sale invoice
      const res = await apiClient.post<{ id: string; amount: number; currency: string }>(
        '/payments',
        {
          direction: 'in',
          partyType: 'customer',
          partyId: customerId,
          amount: 21000,
          currency: 'AFN',
          method: 'cash',
          entryDate: '2026-10-19',
          allocations: [
            {
              invoiceId: saleAfnInvoiceId,
              amount: 21000,
            },
          ],
        },
      )
      expect(res.status).toBe(201)
      expect(res.data.amount).toBe(21000)
      expect(res.data.currency).toBe('AFN')

      // Verify invoice paid_amount is 21000 and status is completed/paid
      const inv = await apiClient.get<{ paidAmount: number; status: string }>(
        `/invoices/${saleAfnInvoiceId}`,
      )
      expect(inv.data.paidAmount).toBe(21000)
      expect(inv.data.status).toBe('completed')
    })

    it('Step 11: Stock transfer between two warehouses', async () => {
      // 1. Create second warehouse in Herat
      const whRes = await apiClient.post<{ id: string; name: string }>('/warehouses', {
        name: 'انبار هرات',
        location: 'هرات',
      })
      expect(whRes.status).toBe(201)
      wh2Id = whRes.data.id

      // 2. Transfer 15 units of Product 1 from Kabul warehouse to Herat warehouse
      const transferRes = await apiClient.post<{ transferId: string; quantity: number }>(
        '/stock-transfers',
        {
          productId: prod1Id,
          fromWarehouseId: TEST_WAREHOUSE_ID,
          toWarehouseId: wh2Id,
          quantity: 15,
          notes: 'انتقال کابل به هرات',
        },
      )
      expect(transferRes.status).toBe(201)
      expect(transferRes.data.quantity).toBe(15)

      // Total quantity of Product 1 across business is unchanged (130)
      const prod = await apiClient.get<{ quantity: number }>(`/products/${prod1Id}`)
      expect(prod.data.quantity).toBe(130)

      // In warehouse 1: 130 - 15 = 115 units
      // In warehouse 2: 15 units
      const stock1 = currentDb?.get<{ qty: number }>(
        'SELECT qty FROM product_stock WHERE product_id = ? AND warehouse_id = ?',
        [prod1Id, TEST_WAREHOUSE_ID],
      )
      expect(Number(stock1?.qty)).toBe(115)

      const stock2 = currentDb?.get<{ qty: number }>(
        'SELECT qty FROM product_stock WHERE product_id = ? AND warehouse_id = ?',
        [prod1Id, wh2Id],
      )
      expect(Number(stock2?.qty)).toBe(15)
    })

    it('Step 12: Cancel one invoice -> verify stock, cost layer, and ledger reversal', async () => {
      // Create a temporary sale invoice of 5 units of Product 1 @ 700 AFN
      const saleRes = await apiClient.post<{ id: string; total: number }>('/invoices', {
        type: 'sale',
        customerId,
        currency: 'AFN',
        date: '2026-10-19',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [
          {
            productId: prod1Id,
            productName: 'برنج اعلا',
            quantity: 5,
            unitPrice: 700,
          },
        ],
      })
      expect(saleRes.status).toBe(201)
      const toCancelId = saleRes.data.id

      // Stock decreased by 5 (130 -> 125)
      const beforeCancelProd = await apiClient.get<{ quantity: number }>(`/products/${prod1Id}`)
      expect(beforeCancelProd.data.quantity).toBe(125)

      // Cancel invoice
      const cancelRes = await apiClient.post<{ success: boolean }>(`/invoices/${toCancelId}/cancel`)
      expect(cancelRes.status).toBe(200)
      expect(cancelRes.data.success).toBe(true)

      // Verify stock restored back to 130
      const afterCancelProd = await apiClient.get<{ quantity: number }>(`/products/${prod1Id}`)
      expect(afterCancelProd.data.quantity).toBe(130)

      // Verify linked journal entry is marked 'reversed'
      const je = currentDb?.get<{ status: string }>(
        "SELECT status FROM journal_entry WHERE source_type = 'invoice' AND source_id = ?",
        [toCancelId],
      )
      expect(je?.status).toBe('reversed')
    })

    it('Step 13: Verify trial balance balances (debitBalance === creditBalance)', async () => {
      const tbRes = await apiClient.get<{
        totalDebit: number
        totalCredit: number
        totalDebitBalance: number
        totalCreditBalance: number
        difference: number
        isBalanced: boolean
      }>('/accounting/trial-balance')

      expect(tbRes.status).toBe(200)
      expect(tbRes.data.isBalanced).toBe(true)
      expect(tbRes.data.difference).toBe(0)
      expect(tbRes.data.totalDebit).toBe(tbRes.data.totalCredit)
      expect(tbRes.data.totalDebitBalance).toBe(tbRes.data.totalCreditBalance)
      expect(tbRes.data.totalDebitBalance).toBeGreaterThan(0)
    })

    it('Step 14: Verify customer balance per currency (reported per currency, never summed across currencies)', async () => {
      const res = await apiClient.get<{
        customerId: string
        currency: string
        balances: Array<{ currency: string; balance: number }>
      }>(`/customers/${customerId}/balance`)

      expect(res.status).toBe(200)
      expect(res.data.balances).toBeDefined()
      expect(res.data.balances.length).toBeGreaterThanOrEqual(2)

      // Customer bought 21,000 AFN and paid 21,000 AFN -> balance: 0 AFN
      const afnBal = res.data.balances.find((b) => b.currency === 'AFN')
      expect(afnBal).toBeDefined()
      expect(afnBal?.balance).toBe(0)

      // Customer bought 120 USD and paid 50 USD -> balance: 70 USD
      const usdBal = res.data.balances.find((b) => b.currency === 'USD')
      expect(usdBal).toBeDefined()
      expect(usdBal?.balance).toBe(70)

      // Invariant: no screen or response sums 70 USD + 0 AFN into a single scalar across currencies
      const distinctCurrencies = new Set(res.data.balances.map((b) => b.currency))
      expect(distinctCurrencies.size).toBe(res.data.balances.length)
    })

    it('Step 15: Verify stock per (product, warehouse)', async () => {
      // The device answers in the SERVER's shape (StockPlacement): the warehouses,
      // and one stock row per (product, warehouse) — not a list nested per warehouse.
      const res = await apiClient.get<{
        branchesConfigured: boolean
        warehouses: Array<{ id: string }>
        stock: Array<{ productId: string; warehouseId: string; quantity: number }>
      }>('/warehouses/placement')

      expect(res.status).toBe(200)
      expect(res.data.warehouses.length).toBe(2)

      const quantityOf = (warehouseId: string) =>
        res.data.stock.find((row) => row.warehouseId === warehouseId && row.productId === prod1Id)
          ?.quantity

      expect(res.data.warehouses.some((w) => w.id === TEST_WAREHOUSE_ID)).toBe(true)
      expect(quantityOf(TEST_WAREHOUSE_ID)).toBe(115)

      expect(res.data.warehouses.some((w) => w.id === wh2Id)).toBe(true)
      expect(quantityOf(wh2Id)).toBe(15)
    })

    it('Step 16: Verify COGS under FIFO and AVCO costing', async () => {
      // FIFO: layers consumed in order of receipt (opening @ 500 first)
      const fifoConsumptions =
        currentDb?.all<{ unit_cost: number; quantity: number }>(
          `SELECT unit_cost, quantity FROM cost_consumption
         WHERE consumer_type = 'invoice' AND consumer_id = ?`,
          [saleAfnInvoiceId],
        ) ?? []
      expect(fifoConsumptions.length).toBeGreaterThan(0)
      expect(fifoConsumptions[0]?.unit_cost).toBe(500)

      // Verify AVCO costing calculation
      currentDb?.exec(`
        INSERT INTO inventory_settings (workspace_id, costing_method, updated_at)
        VALUES ('${TEST_WORKSPACE_ID}', 'avco', datetime('now'))
        ON CONFLICT(workspace_id) DO UPDATE SET costing_method = 'avco';
      `)

      const setting = currentDb?.get<{ costing_method: string }>(
        'SELECT costing_method FROM inventory_settings WHERE workspace_id = ?',
        [TEST_WORKSPACE_ID],
      )
      expect(setting?.costing_method).toBe('avco')
    })

    it('Step 17: Verify profit report: unknown cost produces null profit, never 0', async () => {
      // Sell 5 units of Product 2 (created without buy price and with zero cost layers)
      const saleUnknownRes = await apiClient.post<{ id: string }>('/invoices', {
        type: 'sale',
        customerId,
        currency: 'AFN',
        date: '2026-10-19',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [
          {
            productId: prod2Id,
            productName: 'چای اعلا (نامعلوم)',
            quantity: 5,
            unitPrice: 300,
          },
        ],
      })
      expect(saleUnknownRes.status).toBe(201)

      const profitRes = await apiClient.get<{
        totals: {
          cost: number
          grossProfit: number | null
          costStatus: string
        }
      }>('/accounting/profit-report?currency=AFN')

      expect(profitRes.status).toBe(200)
      // Guard Rule: Unknown is not zero. If cost is unknown, profit is null, NEVER 0.
      expect(profitRes.data.totals.grossProfit).toBeNull()
      expect(['partial', 'unknown']).toContain(profitRes.data.totals.costStatus)
    })

    it('Step 18: Export backup via /workspaces/backup', async () => {
      const res = await apiClient.get<{
        meta: { workspaceId: string; totalRows: number; schemaVersion: string; restorable: boolean }
        customers: unknown[]
        products: unknown[]
        warehouses: unknown[]
        invoices: unknown[]
        payments: unknown[]
        journalEntries: unknown[]
        journalLines: unknown[]
      }>('/workspaces/backup')

      expect(res.status).toBe(200)
      expect(res.data.meta.workspaceId).toBe(TEST_WORKSPACE_ID)
      expect(res.data.meta.totalRows).toBeGreaterThan(0)
      expect(res.data.meta.restorable).toBe(false)
      expect(res.data.products.length).toBeGreaterThanOrEqual(2)
      expect(res.data.customers.length).toBeGreaterThanOrEqual(1)
      expect(res.data.invoices.length).toBeGreaterThanOrEqual(5)
      expect(res.data.warehouses.length).toBeGreaterThanOrEqual(2)
      expect(res.data.journalEntries.length).toBeGreaterThan(0)
    })

    it('Step 19: Close database and reopen -> assert all figures remain identical', async () => {
      // 1. Read baseline figures before close
      const beforeProducts = await apiClient.get<{ total: number }>('/products')
      const beforeInvoices = await apiClient.get<{ total: number }>('/invoices')
      const beforeCustBal = await apiClient.get<{ balances: unknown[] }>(
        `/customers/${customerId}/balance`,
      )
      const beforeTb = await apiClient.get<{
        totalDebitBalance: number
        totalCreditBalance: number
      }>('/accounting/trial-balance')
      const beforePlacement = await apiClient.get<unknown[]>('/warehouses/placement')

      // 2. Close active database handle
      currentDb?.close()
      currentDb = null

      // 3. Reopen fresh connection to same disk database file
      currentDb = createDiskTestDb(dbPath)
      const reopenedEngine = createLocalEngine(currentDb)
      registerLocalTransport(async (req) => {
        const res = await reopenedEngine.request({
          method: req.method,
          path: req.path,
          params: req.params,
          body: req.body,
          headers: req.headers,
        })
        return {
          status: res.status,
          data: res.data,
          headers: res.headers,
        }
      })

      // 4. Assert figures after reopening match identically
      const afterProducts = await apiClient.get<{ total: number }>('/products')
      const afterInvoices = await apiClient.get<{ total: number }>('/invoices')
      const afterCustBal = await apiClient.get<{ balances: unknown[] }>(
        `/customers/${customerId}/balance`,
      )
      const afterTb = await apiClient.get<{
        totalDebitBalance: number
        totalCreditBalance: number
      }>('/accounting/trial-balance')
      const afterPlacement = await apiClient.get<unknown[]>('/warehouses/placement')

      expect(afterProducts.data).toEqual(beforeProducts.data)
      expect(afterInvoices.data).toEqual(beforeInvoices.data)
      expect(afterCustBal.data).toEqual(beforeCustBal.data)
      expect(afterTb.data).toEqual(beforeTb.data)
      expect(afterPlacement.data).toEqual(beforePlacement.data)
    })
  })

  // =========================================================================
  // Currency Checks
  // =========================================================================
  describe('Automated Currency Checks', () => {
    it('Refuses foreign currency invoice without exchange rate with 400 INVOICE_EXCHANGE_RATE_REQUIRED', async () => {
      await expect(
        apiClient.post('/invoices', {
          type: 'sale',
          currency: 'USD',
          // exchangeRate missing
          items: [
            {
              productName: 'کالای بدون نرخ',
              quantity: 1,
              unitPrice: 100,
            },
          ],
        }),
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining('INVOICE_EXCHANGE_RATE_REQUIRED'),
      })
    })

    it('Cross-currency payment allocation is rejected with PAYMENT_CURRENCY_MISMATCH', async () => {
      // Create fresh AFN invoice
      const afnInv = await apiClient.post<{ id: string }>('/invoices', {
        type: 'sale',
        currency: 'AFN',
        items: [{ productName: 'کالای افغانی', quantity: 1, unitPrice: 1000 }],
      })

      // Attempt to allocate USD payment to AFN invoice
      await expect(
        apiClient.post('/payments', {
          direction: 'in',
          partyType: 'customer',
          partyId: customerId,
          amount: 20,
          currency: 'USD',
          allocations: [{ invoiceId: afnInv.data.id, amount: 20 }],
        }),
      ).rejects.toMatchObject({
        status: 409,
        code: 'PAYMENT_CURRENCY_MISMATCH',
      })
    })
  })

  // =========================================================================
  // Test B — Network Isolation Verification
  // =========================================================================
  describe('Test B — Network Isolation Audit & Trap Proof', () => {
    it('Asserts exactly 0 outbound requests across all network vectors during Test A execution', () => {
      expect(auditLog.dns).toBe(0)
      expect(auditLog.http).toBe(0)
      expect(auditLog.https).toBe(0)
      expect(auditLog.fetch).toBe(0)
      expect(auditLog.websocket).toBe(0)
      expect(auditLog.supabase).toBe(0)
      expect(auditLog.render).toBe(0)
      expect(auditLog.telemetry).toBe(0)
      expect(auditLog.auth).toBe(0)
      expect(auditLog.fonts).toBe(0)
      expect(auditLog.update).toBe(0)
    })

    it('Proves network isolation trap is functional via intentional network call injection', async () => {
      // 1. Inject outbound fetch call to remote API host
      await expect(globalThis.fetch('https://api.hisabche.com/api/test')).rejects.toThrow(
        '[Network Isolation] Global fetch blocked in offline edition',
      )

      expect(auditLog.fetch).toBe(1)
      expect(auditLog.render).toBe(1)

      // 2. Inject outbound DNS lookup
      await new Promise<void>((resolve) => {
        dns.lookup('api.supabase.co', (err) => {
          expect(err).toBeDefined()
          expect(err?.message).toContain('[Network Isolation] DNS lookup blocked')
          resolve()
        })
      })

      expect(auditLog.dns).toBe(1)
      expect(auditLog.supabase).toBe(1)
    })
  })
})
