// ============================================
// packages/local-engine/src/__tests__/engine.test.ts
//
// Comprehensive test suite for Hisabche Local Engine (Phase 4).
// Verifies:
// 1. Two currencies across all money paths (AFN and USD)
// 2. Parity with backend response shapes and status codes
// 3. Complete reverse effects on cancellations (invoices, payments, journals)
// 4. Exact business rule error codes
// 5. Atomic transaction safety
// 6. 501 OfflineNotAvailable on unsupported routes
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import { createTestDb, TEST_WAREHOUSE_ID, TEST_WORKSPACE_ID } from './test-db'

describe('Hisabche Local Business Engine', () => {
  let db: ReturnType<typeof createTestDb>
  let engine: ReturnType<typeof createLocalEngine>

  beforeEach(() => {
    db = createTestDb()
    engine = createLocalEngine(db)
  })

  // ─── 1. Route Dispatching & 501 Honest Errors ────────────────
  describe('Dispatching & Honest 501 Fallback', () => {
    it('returns 501 OFFLINE_NOT_AVAILABLE for unimplemented routes', async () => {
      const res = await engine.request({
        method: 'GET',
        path: '/api/ai-pipeline/run',
      })

      expect(res.status).toBe(501)
      const data = res.data as { error: string; code: string; feature: string }
      expect(data.code).toBe('OFFLINE_NOT_AVAILABLE')
      expect(data.error).toBe('This feature is not available offline')
      expect(data.feature).toBe('/api/ai-pipeline/run')
    })
  })

  // ─── 2. Me & Governance Capabilities ─────────────────────────
  describe('Identity & Governance', () => {
    it('returns owner role and all capabilities for the local user', async () => {
      const res = await engine.request({
        method: 'GET',
        path: '/governance/my-capabilities',
      })

      expect(res.status).toBe(200)
      const data = res.data as {
        role: string
        capabilities: string[]
        blockedModules: string[]
        hiddenModules: string[]
      }
      expect(data.role).toBe('owner')
      expect(data.blockedModules).toEqual([])
      expect(data.hiddenModules).toEqual([])
      expect(data.capabilities).toContain('invoice.create')
      expect(data.capabilities).toContain('ledger.post')
      expect(data.capabilities).toContain('ledger.lock_period')
      expect(data.capabilities).toContain('payment.record')
    })

    it('returns user profile from /auth/me', async () => {
      const res = await engine.request({
        method: 'GET',
        path: '/api/auth/me',
      })

      expect(res.status).toBe(200)
      const data = res.data as {
        user: { id: string; email: string; fullName: string; role: string }
      }
      expect(data.user.role).toBe('owner')
      expect(data.user.email).toBe('test@hisabche.local')
      expect(data.user.fullName).toBe('مدیر فروشگاه')
    })
  })

  // ─── 3. Workspaces & Settings ────────────────────────────────
  describe('Workspaces & Base Currency', () => {
    it('retrieves active workspace', async () => {
      const res = await engine.request({
        method: 'GET',
        path: '/workspaces',
      })

      expect(res.status).toBe(200)
      const list = res.data as Array<{
        id: string
        name: string
        myRole: string
        baseCurrency: string
      }>
      expect(list.length).toBe(1)
      expect(list[0]?.name).toBe('فروشگاه تستی')
      expect(list[0]?.myRole).toBe('owner')
      expect(list[0]?.baseCurrency).toBe('AFN')
    })

    it('updates workspace details', async () => {
      const updateRes = await engine.request({
        method: 'PATCH',
        path: `/workspaces/${TEST_WORKSPACE_ID}`,
        body: { name: 'فروشگاه جدید' },
      })

      expect(updateRes.status).toBe(200)
      const updated = updateRes.data as { name: string }
      expect(updated.name).toBe('فروشگاه جدید')
    })

    it('refuses request for unknown workspace id with 404 (Workspace Boundary Rule 1)', async () => {
      const wrongId = '99999999-9999-4999-8999-999999999999'
      const res = await engine.request({
        method: 'PATCH',
        path: `/workspaces/${wrongId}`,
        body: { name: 'نفوذ نامعتبر' },
      })
      expect(res.status).toBe(404)
    })

    it('manages base currency while books are empty, locks once documents exist', async () => {
      // Books are empty -> changeable
      const descRes = await engine.request({
        method: 'GET',
        path: '/settings/base-currency',
      })
      expect(descRes.status).toBe(200)
      const desc = descRes.data as { currency: string; changeable: boolean }
      expect(desc.currency).toBe('AFN')
      expect(desc.changeable).toBe(true)

      // Change currency to USD
      const putRes = await engine.request({
        method: 'PUT',
        path: '/settings/base-currency',
        body: { currency: 'USD' },
      })
      expect(putRes.status).toBe(200)

      // Post an invoice in USD
      await engine.request({
        method: 'POST',
        path: '/invoices',
        body: {
          type: 'sale',
          currency: 'USD',
          items: [{ productName: 'کالای نمونه', quantity: 1, unitPrice: 100 }],
        },
      })

      // Changing base currency now must be refused with BASE_CURRENCY_LOCKED
      const putLocked = await engine.request({
        method: 'PUT',
        path: '/settings/base-currency',
        body: { currency: 'EUR' },
      })
      expect(putLocked.status).toBe(409)
      const err = putLocked.data as { code: string }
      expect(err.code).toBe('BASE_CURRENCY_LOCKED')
    })
  })

  // ─── 4. Multi-Currency Exchange Rates ────────────────────────
  describe('Exchange Rates (Two Currencies: AFN & USD)', () => {
    it('sets and retrieves exchange rates, refusing base currency or non-positive rates', async () => {
      // Refuse setting rate for base currency (AFN)
      const baseRefuse = await engine.request({
        method: 'PUT',
        path: '/finance/currency/rates',
        body: { currency: 'AFN', rate: 1, onDate: '2026-10-19' },
      })
      expect(baseRefuse.status).toBe(400)
      expect((baseRefuse.data as { message: string }).message).toBe('RATE_BASE_CURRENCY')

      // Refuse negative rate
      const negRefuse = await engine.request({
        method: 'PUT',
        path: '/finance/currency/rates',
        body: { currency: 'USD', rate: -5, onDate: '2026-10-19' },
      })
      expect(negRefuse.status).toBe(400)
      expect((negRefuse.data as { message: string }).message).toBe('RATE_INVALID')

      // Set valid rate: 1 USD = 70.5 AFN
      const okRes = await engine.request({
        method: 'PUT',
        path: '/finance/currency/rates',
        body: { currency: 'USD', rate: 70.5, onDate: '2026-10-19' },
      })
      expect(okRes.status).toBe(200)

      // Retrieve list
      const listRes = await engine.request({
        method: 'GET',
        path: '/finance/currency/rates',
      })
      expect(listRes.status).toBe(200)
      const rates = listRes.data as Array<{ currency: string; rate: number; onDate: string }>
      expect(rates.length).toBe(1)
      expect(rates[0]?.currency).toBe('USD')
      expect(rates[0]?.rate).toBe(70.5)
      expect(rates[0]?.onDate).toBe('2026-10-19')
    })
  })

  // ─── 5. Products & Opening Stock ─────────────────────────────
  describe('Products & Inventory Movements', () => {
    it('creates product with opening stock and buy_price layer, enforcing barcode uniqueness', async () => {
      const prodRes = await engine.request({
        method: 'POST',
        path: '/products',
        body: {
          name: 'روغن نباتی ۵ لیتری',
          barcode: '6260123456789',
          buyPrice: 400,
          sellPrice: 500,
          quantity: 20,
          warehouseId: TEST_WAREHOUSE_ID,
        },
      })

      expect(prodRes.status).toBe(201)
      const product = prodRes.data as { id: string; name: string; quantity: number }
      expect(product.name).toBe('روغن نباتی ۵ لیتری')
      expect(product.quantity).toBe(20)

      // Duplicate barcode in same workspace must fail with ConflictError('BARCODE_TAKEN')
      const dupRes = await engine.request({
        method: 'POST',
        path: '/products',
        body: {
          name: 'روغن نباتی دیگر',
          barcode: '6260123456789',
          buyPrice: 400,
          sellPrice: 500,
        },
      })
      expect(dupRes.status).toBe(409)
      expect((dupRes.data as { code: string }).code).toBe('BARCODE_TAKEN')

      // Verify stock in product_stock and cost_layer
      const stock = db.get<{ qty: number }>(
        `SELECT qty FROM product_stock WHERE product_id = ? AND warehouse_id = '${TEST_WAREHOUSE_ID}'`,
        [product.id],
      )
      expect(stock?.qty).toBe(20)

      const layer = db.get<{ remaining_qty: number; unit_cost: number }>(
        'SELECT remaining_qty, unit_cost FROM cost_layer WHERE product_id = ?',
        [product.id],
      )
      expect(layer?.remaining_qty).toBe(20)
      expect(layer?.unit_cost).toBe(400)
    })
  })

  // ─── 6. Customers & Party Balance ────────────────────────────
  describe('Customers & Balance Calculation', () => {
    it('creates customer and calculates balance using shared partyBalancesByCurrency', async () => {
      const custRes = await engine.request({
        method: 'POST',
        path: '/customers',
        body: {
          fullName: 'احمد ظاهر',
          phone: '0799123456',
          openingBalance: 1500,
        },
      })

      expect(custRes.status).toBe(201)
      const customer = custRes.data as { id: string; fullName: string; openingBalance: number }
      expect(customer.fullName).toBe('احمد ظاهر')
      expect(customer.openingBalance).toBe(1500)

      // Check balance endpoint
      const balRes = await engine.request({
        method: 'GET',
        path: `/customers/${customer.id}/balance`,
      })
      expect(balRes.status).toBe(200)
      const balData = balRes.data as { balance: number; currency: string; isDebtor: boolean }
      expect(balData.balance).toBe(1500)
      expect(balData.isDebtor).toBe(true)
    })
  })

  // ─── 7. Invoices: Two Currencies, Derivation & Reversal ───────
  describe('Invoices (Two Currencies, Atomic Math & Reversal)', () => {
    it('creates AFN and USD invoices, derives line totals, posts to ledger, and reverses completely on cancel', async () => {
      // 1. Create a product with stock 10 @ buyPrice 100 AFN
      const pRes = await engine.request({
        method: 'POST',
        path: '/products',
        body: {
          name: 'چای سبز',
          buyPrice: 100,
          sellPrice: 150,
          quantity: 10,
          warehouseId: TEST_WAREHOUSE_ID,
        },
      })
      const product = pRes.data as { id: string }

      // 2. Create customer
      const cRes = await engine.request({
        method: 'POST',
        path: '/customers',
        body: { fullName: 'فرهاد دریا', openingBalance: 0 },
      })
      const customer = cRes.data as { id: string }

      // 3. Post a Sale Invoice for 4 units @ sellPrice 150 AFN
      // Pass wrong line totalPrice (client attempt to tamper: 9999) -> Server derives correct 600
      const invRes = await engine.request({
        method: 'POST',
        path: '/invoices',
        body: {
          type: 'sale',
          customerId: customer.id,
          currency: 'AFN',
          warehouseId: TEST_WAREHOUSE_ID,
          items: [
            {
              productId: product.id,
              productName: 'چای سبز',
              quantity: 4,
              unitPrice: 150,
              totalPrice: 9999, // tampered client value!
            },
          ],
        },
      })

      expect(invRes.status).toBe(201)
      const invoice = invRes.data as {
        id: string
        total: number
        subtotal: number
        items: Array<{ totalPrice: number; quantity: number }>
      }
      expect(invoice.total).toBe(600)
      expect(invoice.subtotal).toBe(600)
      expect(invoice.items[0]?.totalPrice).toBe(600)

      // Stock should be decremented to 6
      const stockAfter = db.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [
        product.id,
      ])
      expect(stockAfter?.quantity).toBe(6)

      // Cost layer remaining_qty should be 6
      const layerAfter = db.get<{ remaining_qty: number }>(
        'SELECT remaining_qty FROM cost_layer WHERE product_id = ?',
        [product.id],
      )
      expect(layerAfter?.remaining_qty).toBe(6)

      // Ledger entry was created
      const je = db.get<{ id: string }>('SELECT id FROM journal_entry WHERE source_id = ?', [
        invoice.id,
      ])
      expect(je).toBeDefined()
      const lines = db.all<{ debit: number; credit: number }>(
        'SELECT debit, credit FROM journal_line WHERE journal_id = ?',
        [je!.id],
      )
      const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
      const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)
      expect(totalDebit).toBe(1000)
      expect(totalCredit).toBe(1000)

      // 4. Now CANCEL the invoice: must restore stock to 10, cost layer to 10, and reverse journal
      const cancelRes = await engine.request({
        method: 'POST',
        path: `/invoices/${invoice.id}/cancel`,
      })
      expect(cancelRes.status).toBe(200)

      // Stock restored to 10
      const stockRestored = db.get<{ quantity: number }>(
        'SELECT quantity FROM product WHERE id = ?',
        [product.id],
      )
      expect(stockRestored?.quantity).toBe(10)

      // Layer restored to 10
      const layerRestored = db.get<{ remaining_qty: number }>(
        'SELECT remaining_qty FROM cost_layer WHERE product_id = ?',
        [product.id],
      )
      expect(layerRestored?.remaining_qty).toBe(10)

      // Journal entry marked reversed
      const revJe = db.get<{ id: string; status: string }>(
        'SELECT id, status FROM journal_entry WHERE source_id = ?',
        [invoice.id],
      )
      expect(revJe).toBeDefined()
      expect(revJe?.status).toBe('reversed')
    })

    it('creates USD purchase invoice in second currency with required exchangeRate', async () => {
      const invRes = await engine.request({
        method: 'POST',
        path: '/invoices',
        body: {
          type: 'purchase',
          currency: 'USD',
          exchangeRate: 70,
          warehouseId: TEST_WAREHOUSE_ID,
          items: [
            {
              productName: 'قطعات کامپیوتر',
              quantity: 2,
              unitPrice: 250,
            },
          ],
        },
      })

      expect(invRes.status).toBe(201)
      const inv = invRes.data as { currency: string; total: number; exchangeRate: number }
      expect(inv.currency).toBe('USD')
      expect(inv.total).toBe(500)
      expect(inv.exchangeRate).toBe(70)
    })

    it('refuses foreign-currency invoice without rate (INVOICE_EXCHANGE_RATE_REQUIRED)', async () => {
      const invRes = await engine.request({
        method: 'POST',
        path: '/invoices',
        body: {
          type: 'sale',
          currency: 'USD',
          warehouseId: TEST_WAREHOUSE_ID,
          items: [{ productName: 'کالا بدون نرخ', quantity: 1, unitPrice: 50 }],
        },
      })
      expect(invRes.status).toBe(400)
      expect((invRes.data as { code: string }).code).toBe('INVOICE_EXCHANGE_RATE_REQUIRED')
    })

    it('costs sale using weighted average (AVCO) when costing_method is avco', async () => {
      // 1. Set costing_method to avco in inventory_settings
      db.run(
        `INSERT INTO inventory_settings (workspace_id, costing_method, updated_at)
         VALUES ('${TEST_WORKSPACE_ID}', 'avco', datetime('now'))
         ON CONFLICT(workspace_id) DO UPDATE SET costing_method = 'avco'`,
      )

      // 2. Create product
      const pRes = await engine.request({
        method: 'POST',
        path: '/products',
        body: {
          name: 'شکر AVCO',
          buyPrice: 0,
          sellPrice: 100,
          quantity: 0,
          warehouseId: TEST_WAREHOUSE_ID,
        },
      })
      const prod = pRes.data as { id: string }

      // 3. Purchase batch 1: 10 units @ 40 AFN
      await engine.request({
        method: 'POST',
        path: '/invoices',
        body: {
          type: 'purchase',
          currency: 'AFN',
          warehouseId: TEST_WAREHOUSE_ID,
          items: [{ productId: prod.id, productName: 'شکر AVCO', quantity: 10, unitPrice: 40 }],
        },
      })

      // 4. Purchase batch 2: 10 units @ 60 AFN (total 20 units, total cost = 1000 AFN => avg 50 AFN)
      await engine.request({
        method: 'POST',
        path: '/invoices',
        body: {
          type: 'purchase',
          currency: 'AFN',
          warehouseId: TEST_WAREHOUSE_ID,
          items: [{ productId: prod.id, productName: 'شکر AVCO', quantity: 10, unitPrice: 60 }],
        },
      })

      // 5. Sale of 5 units: under FIFO it would be 40 AFN/unit. Under AVCO it MUST be 50 AFN/unit!
      const saleRes = await engine.request({
        method: 'POST',
        path: '/invoices',
        body: {
          type: 'sale',
          currency: 'AFN',
          warehouseId: TEST_WAREHOUSE_ID,
          items: [{ productId: prod.id, productName: 'شکر AVCO', quantity: 5, unitPrice: 100 }],
        },
      })
      expect(saleRes.status).toBe(201)
      const sale = saleRes.data as { id: string }

      // Check cost_consumption unit_cost: MUST be 50, NOT 40
      const consumptions = db.all<{ quantity: number; unit_cost: number }>(
        'SELECT quantity, unit_cost FROM cost_consumption WHERE consumer_id = ?',
        [sale.id],
      )
      expect(consumptions.length).toBeGreaterThan(0)
      for (const c of consumptions) {
        expect(c.unit_cost).toBe(50)
      }
    })
  })

  // ─── 8. Payments: Multi-Currency & Reversal ──────────────────
  describe('Payments (Multi-Currency & Allocation)', () => {
    it('allocates payment in invoice currency and reverses on cancel', async () => {
      // Create invoice for 1000 AFN
      const invRes = await engine.request({
        method: 'POST',
        path: '/invoices',
        body: {
          type: 'sale',
          currency: 'AFN',
          items: [{ productName: 'کالای تست', quantity: 1, unitPrice: 1000 }],
        },
      })
      const invoice = invRes.data as { id: string }

      // Try allocating payment with currency mismatch (USD payment to AFN invoice) -> Refused
      const mismatchRes = await engine.request({
        method: 'POST',
        path: '/payments',
        body: {
          direction: 'in',
          partyType: 'customer',
          partyId: null,
          amount: 500,
          currency: 'USD',
          allocations: [{ invoiceId: invoice.id, amount: 500 }],
        },
      })
      expect(mismatchRes.status).toBe(409)
      expect((mismatchRes.data as { code: string }).code).toBe('PAYMENT_CURRENCY_MISMATCH')

      // Record matching AFN payment of 600 AFN
      const payRes = await engine.request({
        method: 'POST',
        path: '/payments',
        body: {
          direction: 'in',
          partyType: 'customer',
          partyId: null,
          amount: 600,
          currency: 'AFN',
          allocations: [{ invoiceId: invoice.id, amount: 600 }],
        },
      })
      expect(payRes.status).toBe(201)
      const payment = payRes.data as { id: string }

      // Invoice status is partially_paid, paid_amount is 600
      const invAfter = db.get<{ paid_amount: number; status: string }>(
        'SELECT paid_amount, status FROM invoice WHERE id = ?',
        [invoice.id],
      )
      expect(invAfter?.paid_amount).toBe(600)
      expect(invAfter?.status).toBe('partial')

      // Cancel payment -> invoice paid_amount goes back to 0, status to unpaid
      const cancelRes = await engine.request({
        method: 'POST',
        path: `/payments/${payment.id}/cancel`,
        body: { reason: 'اشتباه کاربر' },
      })
      expect(cancelRes.status).toBe(200)

      const invRestored = db.get<{ paid_amount: number; status: string }>(
        'SELECT paid_amount, status FROM invoice WHERE id = ?',
        [invoice.id],
      )
      expect(invRestored?.paid_amount).toBe(0)
      expect(invRestored?.status).toBe('unpaid')
    })
  })

  // ─── 9. Warehouses & Transfers ───────────────────────────────
  describe('Warehouses & Stock Transfers', () => {
    it('prevents deleting a warehouse that holds stock, and performs stock transfer atomically', async () => {
      // Create secondary warehouse
      const wh2Res = await engine.request({
        method: 'POST',
        path: '/warehouses',
        body: { name: 'انبار هرات', location: 'هرات' },
      })
      expect(wh2Res.status).toBe(201)
      const wh2 = wh2Res.data as { id: string }

      // Put stock in TEST_WAREHOUSE_ID
      const pRes = await engine.request({
        method: 'POST',
        path: '/products',
        body: {
          name: 'برنج سیله',
          quantity: 50,
          buyPrice: 200,
          sellPrice: 250,
          warehouseId: TEST_WAREHOUSE_ID,
        },
      })
      const product = pRes.data as { id: string }

      // Attempt to delete TEST_WAREHOUSE_ID -> ConflictError('WAREHOUSE_HOLDS_STOCK')
      const delWh = await engine.request({
        method: 'DELETE',
        path: `/warehouses/${TEST_WAREHOUSE_ID}`,
      })
      expect(delWh.status).toBe(409)
      expect((delWh.data as { code: string }).code).toBe('WAREHOUSE_HOLDS_STOCK')

      // Transfer 20 units from TEST_WAREHOUSE_ID to wh-secondary
      const xferRes = await engine.request({
        method: 'POST',
        path: '/stock-transfers',
        body: {
          productId: product.id,
          sourceWarehouseId: TEST_WAREHOUSE_ID,
          destinationWarehouseId: wh2.id,
          quantity: 20,
        },
      })
      expect([200, 201]).toContain(xferRes.status)

      // Verify stock in both warehouses
      const s1 = db.get<{ qty: number }>(
        `SELECT qty FROM product_stock WHERE product_id = ? AND warehouse_id = '${TEST_WAREHOUSE_ID}'`,
        [product.id],
      )
      expect(s1?.qty).toBe(30)

      const s2 = db.get<{ qty: number }>(
        'SELECT qty FROM product_stock WHERE product_id = ? AND warehouse_id = ?',
        [product.id, wh2.id],
      )
      expect(s2?.qty).toBe(20)
    })
  })

  // ─── 10. Accounting & Period Lock ────────────────────────────
  describe('Accounting (Balanced Journal, Period Lock & Profit Report)', () => {
    it('enforces debits === credits and respects period lock', async () => {
      // Create accounts
      await engine.request({
        method: 'POST',
        path: '/accounting/accounts',
        body: { code: '1010', name: 'صندوق', type: 'asset' },
      })
      await engine.request({
        method: 'POST',
        path: '/accounting/accounts',
        body: { code: '4010', name: 'درآمد فروش', type: 'revenue' },
      })

      // Try posting unbalanced entry -> JOURNAL_ENTRY_UNBALANCED
      const unbal = await engine.request({
        method: 'POST',
        path: '/accounting/journal',
        body: {
          date: '2026-10-15',
          description: 'تست نامتعادل',
          lines: [
            { accountCode: '1010', debit: 500, credit: 0 },
            { accountCode: '4010', debit: 0, credit: 400 },
          ],
        },
      })
      expect(unbal.status).toBe(409)
      expect((unbal.data as { code: string }).code).toBe('JOURNAL_ENTRY_UNBALANCED')

      // Post balanced entry
      const balRes = await engine.request({
        method: 'POST',
        path: '/accounting/journal',
        body: {
          date: '2026-10-15',
          description: 'تست متعادل',
          lines: [
            { accountCode: '1010', debit: 500, credit: 0 },
            { accountCode: '4010', debit: 0, credit: 500 },
          ],
        },
      })
      expect(balRes.status).toBe(201)

      // Lock period up to 2026-10-16
      const lockRes = await engine.request({
        method: 'PUT',
        path: '/accounting/period-lock',
        body: { lockedUntil: '2026-10-16' },
      })
      expect(lockRes.status).toBe(200)

      // Try posting in locked period (2026-10-10) -> ACCOUNTING_PERIOD_LOCKED
      const lockedRes = await engine.request({
        method: 'POST',
        path: '/accounting/journal',
        body: {
          date: '2026-10-10',
          description: 'تست در دوره قفل شده',
          lines: [
            { accountCode: '1010', debit: 100, credit: 0 },
            { accountCode: '4010', debit: 0, credit: 100 },
          ],
        },
      })
      expect(lockedRes.status).toBe(409)
      expect((lockedRes.data as { code: string }).code).toBe('ACCOUNTING_PERIOD_LOCKED')

      // Trial balance is balanced
      const tbRes = await engine.request({
        method: 'GET',
        path: '/accounting/trial-balance',
      })
      expect(tbRes.status).toBe(200)
      const tb = tbRes.data as { isBalanced: boolean; totalDebit: number; totalCredit: number }
      expect(tb.isBalanced).toBe(true)
      expect(tb.totalDebit).toBe(tb.totalCredit)
    })

    it('generates profit report via shared buildProfitReport', async () => {
      const repRes = await engine.request({
        method: 'GET',
        path: '/accounting/profit-report?from=2026-01-01&to=2026-12-31&currency=AFN',
      })
      expect(repRes.status).toBe(200)
      const report = repRes.data as { currency: string; products: unknown[] }
      expect(report.currency).toBe('AFN')
      expect(Array.isArray(report.products)).toBe(true)
    })
  })

  // ─── 11. Dashboard & Analytics (Honest Currency Split) ───────
  describe('Dashboard Analytics (No Currency Mixing)', () => {
    it('splits KPIs honestly in byCurrency without summing across currencies', async () => {
      // 100 AFN sale
      await engine.request({
        method: 'POST',
        path: '/invoices',
        body: {
          type: 'sale',
          currency: 'AFN',
          items: [{ productName: 'کالا ۱', quantity: 1, unitPrice: 100 }],
        },
      })

      // 50 USD sale
      await engine.request({
        method: 'POST',
        path: '/invoices',
        body: {
          type: 'sale',
          currency: 'USD',
          exchangeRate: 70,
          items: [{ productName: 'کالا ۲', quantity: 1, unitPrice: 50 }],
        },
      })

      const dRes = await engine.request({
        method: 'GET',
        path: '/analytics/dashboard',
      })
      expect(dRes.status).toBe(200)
      const dash = dRes.data as {
        totalSales: number
        byCurrency: Record<string, { totalSales: number }>
      }

      // Base currency headline is only AFN
      expect(dash.totalSales).toBe(100)
      // byCurrency keeps them separate, never 150!
      expect(dash.byCurrency['AFN']?.totalSales).toBe(100)
      expect(dash.byCurrency['USD']?.totalSales).toBe(50)
    })
  })

  // ─── 12. Backup & Migrations ─────────────────────────────────
  describe('Backup & Migration Import', () => {
    it('generates full JSON backup dump', async () => {
      const bRes = await engine.request({
        method: 'GET',
        path: '/workspaces/backup',
      })
      expect(bRes.status).toBe(200)
      const backup = bRes.data as { meta: { restorable: boolean; totalRows: number } }
      expect(backup.meta.restorable).toBe(false)
      expect(backup.meta.totalRows).toBeGreaterThan(0)
    })

    it('inspects and commits migration records', async () => {
      const inspectRes = await engine.request({
        method: 'POST',
        path: '/migrations/inspect',
        body: {
          filename: 'customers.csv',
          content: 'نام,تلفن\nحامد,0700111222\nسهراب,0788333444',
        },
      })
      expect(inspectRes.status).toBe(200)
      const ins = inspectRes.data as { rowCount: number; headers: string[] }
      expect(ins.rowCount).toBe(2)
      expect(ins.headers).toContain('نام')

      const commitRes = await engine.request({
        method: 'POST',
        path: '/migrations/commit',
        body: {
          entity: 'customers',
          records: [
            { name: 'مشتری وارداتی ۱', phone: '0700999888' },
            { name: 'مشتری وارداتی ۲', phone: '0700999777' },
          ],
        },
      })
      expect(commitRes.status).toBe(201)
      const com = commitRes.data as { imported: number }
      expect(com.imported).toBe(2)
    })
  })
})
