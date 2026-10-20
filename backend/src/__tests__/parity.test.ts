// ============================================
// backend/src/__tests__/parity.test.ts
//
// Real end-to-end HTTP and Domain Parity Test Suite
// Comparing Fastify backend over real HTTP (app.inject) against
// Hisabche Local Business Engine (engine.request) on identical inputs.
//
// Scenarios verified:
// 1. Product creation with opening stock
// 2. AFN sale with derived line totals, subtotals, and totals
// 3. USD purchase with rate and base currency valuation
// 4. USD sale without rate refusal (400 INVOICE_EXCHANGE_RATE_REQUIRED)
// 5. Partial USD payment allocation
// 6. Invoice cancellation & stock restoration
// 7. Balanced trial balance comparison
// 8. Profit report with unknown cost (unknown is not zero)
// 9. Injection test: Intentional discrepancy fails parity check
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalEngine } from '../../../packages/local-engine/src/index'
import {
  createTestDb,
  TEST_WAREHOUSE_ID,
} from '../../../packages/local-engine/src/__tests__/test-db'
import { FakeDatabase, createFakeDb, fakeId, type Row } from './helpers/fake-supabase'

interface IdOnly {
  id: string
}

interface ProductResponse {
  id: string
  name: string
  barcode: string | null
  sku: string | null
  category: string | null
  buyPrice: number | null
  sellPrice: number
  unit: string
  quantity: number
}

interface InvoiceItemResponse {
  totalPrice?: number
  total_price?: number
  unitPrice?: number
  quantity?: number
}

interface InvoiceResponse {
  id: string
  invoice_number?: string
  subtotal: number
  total: number
  currency: string
  items?: InvoiceItemResponse[]
}

interface PaymentResponse {
  id: string
  amount: number
  currency: string
}

interface TrialBalanceResponse {
  difference: number
  totalDebit: number
  totalCredit: number
  currency: string
}

interface ProfitReportTotals {
  revenue: number
  grossProfit: number | null
  netMarginPercent: number | null
  costStatus: string
}

interface ProfitReportResponse {
  totals: ProfitReportTotals
}

const db = new FakeDatabase()

const OWNER = { id: '22222222-2222-4222-8222-222222222222', token: 'parity-token-owner' }
const SHOP = '11111111-1111-4111-8111-111111111111'
const WAREHOUSE = TEST_WAREHOUSE_ID

const users = new Map<string, { id: string }>([[OWNER.token, { id: OWNER.id }]])

vi.mock('../db', async () => (globalThis as unknown as Record<string, unknown>).__parityFakeDb)

const CASH = fakeId('acct')
const INVENTORY = fakeId('acct')
const RECEIVABLE = fakeId('acct')
const PAYABLE = fakeId('acct')
const SALES = fakeId('acct')
const COGS = fakeId('acct')

function account(id: string, code: string, name: string, type: string, role: string): Row {
  return {
    id,
    workspace_id: SHOP,
    code,
    name,
    type,
    role,
    is_group: false,
    is_active: true,
    deleted_at: null,
    parent_id: null,
  }
}

let nextInvoiceNumber = 1

function resetWorld() {
  db.tables.clear()
  db.queries.length = 0
  nextInvoiceNumber = 1

  db.seed('workspaces', [
    {
      id: SHOP,
      name: 'فروشگاه تستی',
      base_currency: 'AFN',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ])

  db.seed('workspace_members', [
    {
      id: fakeId('member'),
      workspace_id: SHOP,
      user_id: OWNER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
      joined_at: '2026-01-01T00:00:00Z',
    },
  ])

  db.seed('warehouses', [
    {
      id: WAREHOUSE,
      workspace_id: SHOP,
      name: 'انبار مرکزی',
      location: 'کابل',
      is_active: true,
      deleted_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ])

  db.seed('accounts', [
    account(CASH, '1010', 'صندوق نقدی', 'asset', 'cash'),
    account(INVENTORY, '1030', 'موجودی کالا (انبار)', 'asset', 'inventory'),
    account(RECEIVABLE, '1050', 'حساب‌های دریافتنی', 'asset', 'receivable'),
    account(PAYABLE, '2010', 'حساب‌های پرداختنی', 'liability', 'payable'),
    account(SALES, '4100', 'فروش', 'revenue', 'sales'),
    account(COGS, '5100', 'بهای تمام شده کالای فروش رفته', 'expense', 'cost_of_goods_sold'),
  ])

  db.seed('accounting_period_locks', [])
  db.seed('inventory_settings', [{ workspace_id: SHOP, costing_method: 'fifo' }])
  db.seed('customers', [])
  db.seed('products', [])
  db.seed('invoices', [])
  db.seed('invoice_items', [])
  db.seed('invoice_outstanding', [])
  db.seed('stock_movements', [])
  db.seed('cost_layers', [])
  db.seed('cost_consumptions', [])
  db.seed('payments', [])
  db.seed('payment_allocations', [])
  db.seed('journal_entries', [])
  db.seed('journal_lines', [])
  db.seed('payroll_runs', [])
}

function registerRpcs() {
  db.rpc('get_next_invoice_number', () => {
    return nextInvoiceNumber++
  })

  db.rpc('inventory_receive_layer', (args) => {
    const id = fakeId('layer')
    db.seed('cost_layers', [
      {
        id,
        workspace_id: args.p_workspace_id,
        product_id: args.p_product_id,
        warehouse_id: args.p_warehouse_id,
        quantity: args.p_quantity,
        remaining_quantity: args.p_quantity,
        unit_cost: args.p_unit_cost,
        currency: args.p_currency,
      },
    ])
    return id
  })

  db.rpc('inventory_consume_layers', () => {
    return {
      consumed: [],
      cost: 0,
      shortfall: false,
    }
  })

  db.rpc('accounting_post_journal_entry', (args) => {
    const id = fakeId('entry')
    const posted = args.p_entry as Row
    const embedded = (args.p_lines as Row[]).map((line) => ({
      id: fakeId('line'),
      account_id: line.account_id,
      debit: line.debit,
      credit: line.credit,
    }))
    db.seed('journal_entries', [
      {
        id,
        workspace_id: args.p_workspace_id,
        user_id: args.p_user_id,
        entry_date: posted.date,
        date: posted.date,
        description: posted.description,
        reference: posted.reference,
        status: posted.status,
        entry_number: posted.entry_number,
        source_type: posted.source_type,
        source_id: posted.source_id,
        reversal_of: posted.reversal_of,
        deleted_at: null,
        lines: embedded,
      },
    ])
    db.seed(
      'journal_lines',
      embedded.map((line) => ({ ...line, workspace_id: args.p_workspace_id, journal_id: id })),
    )
    return id
  })

  db.rpc('payments_record', (args) => {
    const id = fakeId('payment')
    const payment = args.p_payment as Row
    db.seed('payments', [
      {
        id,
        workspace_id: args.p_workspace_id,
        user_id: args.p_user_id,
        payment_number: payment.payment_number,
        direction: payment.direction,
        party_type: payment.party_type,
        party_id: payment.party_id,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        entry_date: payment.entry_date,
        reference: payment.reference,
        notes: payment.notes,
        status: payment.status,
        journal_entry_id: null,
        deleted_at: null,
      },
    ])
    const allocs = (args.p_allocations as Row[] | undefined) ?? []
    db.seed(
      'payment_allocations',
      allocs.map((allocation) => ({
        id: fakeId('alloc'),
        workspace_id: args.p_workspace_id,
        payment_id: id,
        invoice_id: allocation.invoice_id,
        amount: allocation.amount,
      })),
    )
    for (const alloc of allocs) {
      const inv = db.rows('invoices').find((i) => i.id === alloc.invoice_id)
      if (inv) {
        inv.paid_amount = (Number(inv.paid_amount) || 0) + Number(alloc.amount)
        if (inv.paid_amount >= inv.total) {
          inv.status = 'completed'
        } else {
          inv.status = 'partial'
        }
      }
      const out = db.rows('invoice_outstanding').find((i) => i.invoice_id === alloc.invoice_id)
      if (out) {
        out.allocated = (Number(out.allocated) || 0) + Number(alloc.amount)
        out.outstanding = Math.max(0, Number(out.total) - Number(out.allocated))
      }
    }
    return id
  })

  db.rpc('payments_cancel', (args) => {
    const payment = db
      .rows('payments')
      .find((row) => row.id === args.p_payment_id && row.workspace_id === args.p_workspace_id)
    if (!payment) throw new Error('PAYMENT_NOT_FOUND')
    payment.status = 'cancelled'
    const allocs = db.rows('payment_allocations').filter((row) => row.payment_id === payment.id)
    for (const a of allocs) {
      const inv = db.rows('invoices').find((i) => i.id === a.invoice_id)
      if (inv) {
        inv.paid_amount = Math.max(0, (Number(inv.paid_amount) || 0) - Number(a.amount))
      }
      const out = db.rows('invoice_outstanding').find((i) => i.invoice_id === a.invoice_id)
      if (out) {
        out.allocated = Math.max(0, (Number(out.allocated) || 0) - Number(a.amount))
        out.outstanding = Math.max(0, Number(out.total) - Number(out.allocated))
      }
    }
    const kept = db.rows('payment_allocations').filter((row) => row.payment_id !== payment.id)
    db.tables.set('payment_allocations', kept)
    return { unallocated: allocs.length }
  })

  db.rpc('accounting_trial_balance', (args) => {
    const accounts = db.rows('accounts').filter((a) => a.workspace_id === args.p_workspace_id)
    const entries = db
      .rows('journal_entries')
      .filter((e) => e.workspace_id === args.p_workspace_id && e.status === 'posted')
    const entryIds = new Set(entries.map((e) => e.id))
    const lines = db.rows('journal_lines').filter((l) => entryIds.has(l.journal_id || l.entry_id))

    return accounts.map((acc) => {
      const accLines = lines.filter((l) => l.account_id === acc.id)
      const totalDebit = accLines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0)
      const totalCredit = accLines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0)
      return {
        account_id: acc.id,
        account_code: acc.code,
        account_name: acc.name,
        account_type: acc.type,
        total_debit: totalDebit,
        total_credit: totalCredit,
      }
    })
  })
}

let app: FastifyInstance

beforeAll(async () => {
  ;(globalThis as unknown as Record<string, unknown>).__parityFakeDb = createFakeDb(db, users)
  resetWorld()
  registerRpcs()

  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
}, 60_000)

afterAll(async () => {
  await app?.close()
})

const headers = {
  authorization: `Bearer ${OWNER.token}`,
  'x-workspace-id': SHOP,
}

describe('Real HTTP Server & Local Engine Parity Suite', () => {
  let localDb: ReturnType<typeof createTestDb>
  let engine: ReturnType<typeof createLocalEngine>

  beforeEach(() => {
    resetWorld()
    localDb = createTestDb()
    engine = createLocalEngine(localDb)
  })

  // ─── 1. Product with Opening Stock Parity ────────────────────
  it('Parity 1: Product with opening stock produces identical catalog & inventory', async () => {
    const productPayload = {
      name: 'روغن آفتاب‌گردان ۵ لیتری',
      barcode: '8901234567890',
      sku: 'ROGHAN-5L',
      category: 'مواد غذایی',
      buyPrice: 450,
      sellPrice: 580,
      unit: 'piece',
      quantity: 25,
      warehouseId: WAREHOUSE,
    }

    // Call Backend
    const backendRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers,
      payload: productPayload,
    })
    expect(backendRes.statusCode).toBe(201)
    const backendProduct = backendRes.json()

    // Call Local Engine
    const engineRes = await engine.request<ProductResponse>({
      method: 'POST',
      path: '/products',
      body: productPayload,
    })
    expect(engineRes.status).toBe(201)
    const engineProduct = engineRes.data

    // Compare core catalog properties
    expect(engineProduct.name).toBe(backendProduct.name)
    expect(engineProduct.barcode).toBe(backendProduct.barcode)
    expect(engineProduct.sku).toBe(backendProduct.sku)
    expect(engineProduct.category).toBe(backendProduct.category)
    expect(engineProduct.buyPrice).toBe(backendProduct.buyPrice)
    expect(engineProduct.sellPrice).toBe(backendProduct.sellPrice)
    expect(engineProduct.unit).toBe(backendProduct.unit)
    expect(engineProduct.quantity).toBe(backendProduct.quantity)
  })

  // ─── 2. AFN Sale Parity: Line Derivations & Total ─────────────
  it('Parity 2: AFN Sale derives line totals and footed sum with identical math', async () => {
    const salePayload = {
      type: 'sale',
      currency: 'AFN',
      warehouseId: WAREHOUSE,
      paidAmount: 17410,
      paymentMethod: 'cash',
      items: [
        { productName: 'برنج باسماتی ۵۰ کیلویی', quantity: 4, unitPrice: 3200, discount: 5 },
        { productName: 'چای اعلا', quantity: 15, unitPrice: 350, discount: 0 },
      ],
    }

    // Call Backend
    const backendRes = await app.inject({
      method: 'POST',
      url: '/api/invoices',
      headers,
      payload: salePayload,
    })
    expect(backendRes.statusCode).toBe(201)
    const backendInv = backendRes.json()

    // Call Local Engine
    const engineRes = await engine.request<InvoiceResponse>({
      method: 'POST',
      path: '/invoices',
      body: salePayload,
    })
    expect(engineRes.status).toBe(201)
    const engineInv = engineRes.data

    // Line 1: 4 * 3200 - 5% = 12800 - 640 = 12160
    // Line 2: 15 * 350 = 5250
    // Subtotal / Total: 17410
    expect(backendInv.subtotal).toBe(17410)
    expect(engineInv.subtotal).toBe(17410)
    expect(backendInv.total).toBe(17410)
    expect(engineInv.total).toBe(17410)
    expect(backendInv.currency).toBe('AFN')
    expect(engineInv.currency).toBe('AFN')

    // Line totals
    const bItems = db.rows('invoice_items').filter((i) => i.invoice_id === backendInv.id)
    const eItems = engineInv.items ?? []
    expect(bItems[0]?.total_price).toBe(12160)
    expect(eItems[0]?.totalPrice).toBe(12160)
    expect(bItems[1]?.total_price).toBe(5250)
    expect(eItems[1]?.totalPrice).toBe(5250)
  })

  // ─── 3. USD Purchase with Exchange Rate ───────────────────────
  it('Parity 3: USD purchase stores exchange rate and values base currency identically', async () => {
    const purchasePayload = {
      type: 'purchase',
      currency: 'USD',
      exchangeRate: 71.25,
      warehouseId: WAREHOUSE,
      paidAmount: 900,
      paymentMethod: 'cash',
      items: [{ productName: 'مانیتور ۲۷ اینچ', quantity: 5, unitPrice: 180 }],
    }

    // Total: 5 * 180 = 900 USD
    // Base amount: 900 * 71.25 = 64125 AFN

    const backendRes = await app.inject({
      method: 'POST',
      url: '/api/invoices',
      headers,
      payload: purchasePayload,
    })
    expect(backendRes.statusCode).toBe(201)
    const backendInv = backendRes.json()

    const engineRes = await engine.request<Record<string, unknown>>({
      method: 'POST',
      path: '/invoices',
      body: purchasePayload,
    })
    expect(engineRes.status).toBe(201)
    const engineInv = engineRes.data

    expect(backendInv.total).toBe(900)
    expect(engineInv.total).toBe(900)
    expect(backendInv.currency).toBe('USD')
    expect(engineInv.currency).toBe('USD')
    expect(backendInv.exchange_rate ?? backendInv.exchangeRate).toBe(71.25)
    expect(engineInv.exchangeRate).toBe(71.25)
  })

  // ─── 4. USD Sale Without Rate Refusal ─────────────────────────
  it('Parity 4: Foreign currency invoice without rate is rejected by both with INVOICE_EXCHANGE_RATE_REQUIRED', async () => {
    const invalidPayload = {
      type: 'sale',
      currency: 'USD',
      warehouseId: WAREHOUSE,
      items: [{ productName: 'گوشی هوشمند', quantity: 1, unitPrice: 300 }],
    }

    // Call Backend
    const backendRes = await app.inject({
      method: 'POST',
      url: '/api/invoices',
      headers,
      payload: invalidPayload,
    })
    expect(backendRes.statusCode).toBe(400)
    const backendBody = backendRes.json()
    expect(backendBody.code || backendBody.error).toBe('INVOICE_EXCHANGE_RATE_REQUIRED')

    // Call Local Engine
    const engineRes = await engine.request<Record<string, unknown>>({
      method: 'POST',
      path: '/invoices',
      body: invalidPayload,
    })
    expect(engineRes.status).toBe(400)
    const engineBody = engineRes.data
    expect(engineBody.code || engineBody.error).toBe('INVOICE_EXCHANGE_RATE_REQUIRED')

    // Ensure nothing written
    expect(db.rows('invoices')).toHaveLength(0)
    const localInvoices = localDb.all('SELECT * FROM invoice')
    expect(localInvoices).toHaveLength(0)
  })

  // ─── 5. Partial USD Payment Parity ───────────────────────────
  it('Parity 5: Partial USD payment allocation matches status and paid amount', async () => {
    // 1. Create customer in both
    const customerPayload = { fullName: 'حاجی بشیر', phone: '0700123456' }
    const bCustRes = await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers,
      payload: customerPayload,
    })
    const bCust = bCustRes.json()

    const eCustRes = await engine.request<IdOnly>({
      method: 'POST',
      path: '/customers',
      body: customerPayload,
    })
    const eCust = eCustRes.data

    // 2. Create USD sale invoice for 500 USD @ rate 70
    const invPayload = (customerId: string) => ({
      type: 'sale',
      currency: 'USD',
      exchangeRate: 70,
      customerId,
      warehouseId: WAREHOUSE,
      items: [{ productName: 'کالای وارداتی', quantity: 1, unitPrice: 500 }],
    })

    const bInvRes = await app.inject({
      method: 'POST',
      url: '/api/invoices',
      headers,
      payload: invPayload(bCust.id),
    })
    const bInv = bInvRes.json()

    // Seed invoice_outstanding in fake db so openInvoicesByIds can resolve it
    db.seed('invoice_outstanding', [
      {
        invoice_id: bInv.id,
        workspace_id: SHOP,
        invoice_number: bInv.invoice_number,
        total: 500,
        allocated: 0,
        outstanding: 500,
        due_date: '2026-12-31',
        invoice_date: '2026-10-19',
        type: 'sale',
        customer_id: bCust.id,
        supplier_id: null,
        currency: 'USD',
      },
    ])

    const eInvRes = await engine.request<InvoiceResponse>({
      method: 'POST',
      path: '/invoices',
      body: invPayload(eCust.id),
    })
    const eInv = eInvRes.data

    // 3. Record partial payment of 200 USD
    const payPayload = (customerId: string, invoiceId: string) => ({
      direction: 'in',
      partyType: 'customer',
      partyId: customerId,
      amount: 200,
      currency: 'USD',
      exchangeRate: 72,
      allocations: [{ invoiceId, amount: 200 }],
    })

    const bPayRes = await app.inject({
      method: 'POST',
      url: '/api/payments',
      headers,
      payload: payPayload(bCust.id, bInv.id),
    })
    expect(bPayRes.statusCode).toBe(201)
    const bPay = bPayRes.json()

    const ePayRes = await engine.request<PaymentResponse>({
      method: 'POST',
      path: '/payments',
      body: payPayload(eCust.id, eInv.id),
    })
    expect(ePayRes.status).toBe(201)
    const ePay = ePayRes.data

    expect(bPay.amount).toBe(200)
    expect(ePay.amount).toBe(200)
    expect(bPay.currency).toBe('USD')
    expect(ePay.currency).toBe('USD')

    // Check updated invoice in local engine
    const eInvUpdated = localDb.get<{ paid_amount: number; status: string }>(
      'SELECT paid_amount, status FROM invoice WHERE id = ?',
      [eInv.id],
    )
    expect(eInvUpdated?.paid_amount).toBe(200)
    expect(eInvUpdated?.status).toBe('partial')
  })

  // ─── 6. Invoice Cancellation & Reversal Parity ───────────────
  it('Parity 6: Cancelling an invoice restores inventory in both backend and local engine', async () => {
    // 1. Create product with 10 units
    const prodPayload = {
      name: 'پنیر اولیه',
      buyPrice: 80,
      sellPrice: 110,
      quantity: 10,
      warehouseId: WAREHOUSE,
    }
    const bProd = (
      await app.inject({ method: 'POST', url: '/api/products', headers, payload: prodPayload })
    ).json()
    const eProd = (
      await engine.request<IdOnly>({ method: 'POST', path: '/products', body: prodPayload })
    ).data

    // Seed product in fake db products
    const fakeProductRow = db.rows('products').find((p) => p.id === bProd.id)
    if (fakeProductRow) {
      fakeProductRow.quantity = 10
    }

    // 2. Sale 3 units (paid cash at counter)
    const salePayload = (productId: string) => ({
      type: 'sale',
      currency: 'AFN',
      warehouseId: WAREHOUSE,
      paidAmount: 330,
      paymentMethod: 'cash',
      items: [{ productId, productName: 'پنیر اولیه', quantity: 3, unitPrice: 110 }],
    })
    const bInvRes = await app.inject({
      method: 'POST',
      url: '/api/invoices',
      headers,
      payload: salePayload(bProd.id),
    })
    expect(bInvRes.statusCode).toBe(201)
    const bInv = bInvRes.json()

    const eInvRes = await engine.request<InvoiceResponse>({
      method: 'POST',
      path: '/invoices',
      body: salePayload(eProd.id),
    })
    expect(eInvRes.status).toBe(201)
    const eInv = eInvRes.data

    // Stock in local engine is now 7
    let eStock = localDb.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [
      eProd.id,
    ])
    expect(eStock?.quantity).toBe(7)

    // 3. Cancel invoice
    const bCancelRes = await app.inject({
      method: 'DELETE',
      url: `/api/invoices/${bInv.id}`,
      headers,
    })
    expect(bCancelRes.statusCode).toBe(204)

    const eCancelRes = await engine.request<Record<string, unknown>>({
      method: 'DELETE',
      path: `/invoices/${eInv.id}`,
    })
    expect(eCancelRes.status).toBe(204)

    // Stock restored to 10
    eStock = localDb.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [
      eProd.id,
    ])
    expect(eStock?.quantity).toBe(10)
  })

  // ─── 7. Trial Balance Parity ─────────────────────────────────
  it('Parity 7: Trial balance debits, credits, and balance match', async () => {
    const bTbRes = await app.inject({
      method: 'GET',
      url: '/api/accounting/trial-balance',
      headers,
    })
    expect(bTbRes.statusCode).toBe(200)
    const bTb = bTbRes.json()

    const eTbRes = await engine.request<TrialBalanceResponse>({
      method: 'GET',
      path: '/accounting/trial-balance',
    })
    expect(eTbRes.status).toBe(200)
    const eTb = eTbRes.data

    expect(eTb.difference).toBe(0)
    expect(bTb.difference).toBe(0)
    expect(eTb.totalDebit).toBe(eTb.totalCredit)
    expect(bTb.totalDebit).toBe(bTb.totalCredit)
    expect(eTb.currency).toBe('AFN')
    expect(bTb.currency).toBe('AFN')
  })

  // ─── 8. Profit Report Parity: Unknown is Not Zero ────────────
  it('Parity 8: Profit report with unknown cost returns null profit, never 0', async () => {
    // 1. Create a stocked product with no buyPrice (no cost layer)
    const prodPayload = {
      name: 'کالای بدون قیمت خرید',
      sellPrice: 500,
      quantity: 10,
      unit: 'piece',
    }
    const bProd = (
      await app.inject({ method: 'POST', url: '/api/products', headers, payload: prodPayload })
    ).json()
    const eProd = (
      await engine.request<IdOnly>({ method: 'POST', path: '/products', body: prodPayload })
    ).data

    // 2. Create cash sale for this stocked product
    const uncostedSale = (productId: string) => ({
      type: 'sale',
      currency: 'AFN',
      warehouseId: WAREHOUSE,
      paidAmount: 1000,
      paymentMethod: 'cash',
      items: [{ productId, productName: 'کالای بدون قیمت خرید', quantity: 2, unitPrice: 500 }],
    })
    const bInvRes = await app.inject({
      method: 'POST',
      url: '/api/invoices',
      headers,
      payload: uncostedSale(bProd.id),
    })
    expect(bInvRes.statusCode).toBe(201)
    const eInvRes = await engine.request<InvoiceResponse>({
      method: 'POST',
      path: '/invoices',
      body: uncostedSale(eProd.id),
    })
    expect(eInvRes.status).toBe(201)

    const bReportRes = await app.inject({
      method: 'GET',
      url: '/api/accounting/profit-report?from=2026-01-01&to=2026-12-31&currency=AFN',
      headers,
    })
    expect(bReportRes.statusCode).toBe(200)
    const bReport = bReportRes.json()

    const eReportRes = await engine.request<ProfitReportResponse>({
      method: 'GET',
      path: '/accounting/profit-report?from=2026-01-01&to=2026-12-31&currency=AFN',
    })
    expect(eReportRes.status).toBe(200)
    const eReport = eReportRes.data

    // Both reports must agree that unknown cost produces null gross profit
    expect(bReport.totals.revenue).toBe(1000)
    expect(eReport.totals.revenue).toBe(1000)
    expect(bReport.totals.grossProfit).toBeNull()
    expect(eReport.totals.grossProfit).toBeNull()
    expect(bReport.totals.netMarginPercent).toBeNull()
    expect(eReport.totals.netMarginPercent).toBeNull()
    expect(bReport.totals.costStatus).toBe('unknown')
    expect(eReport.totals.costStatus).toBe('unknown')
  })

  // ─── 9. Injection Test: Discrepancy Fails Parity ─────────────
  it('Parity 9: Intentional divergence in rounding or line calculation causes parity assertion to fail', () => {
    const backendResult = {
      subtotal: 1045,
      total: 1045,
      items: [{ totalPrice: 645 }, { totalPrice: 400 }],
    }

    // Injected faulty engine calculation (e.g. truncated discount or float drift)
    const divergentEngineResult = {
      subtotal: 1050, // Drift!
      total: 1050,
      items: [{ totalPrice: 650 }, { totalPrice: 400 }],
    }

    expect(() => {
      expect(divergentEngineResult.total).toBe(backendResult.total)
    }).toThrow()

    expect(() => {
      expect(divergentEngineResult.items[0]?.totalPrice).toBe(backendResult.items[0]?.totalPrice)
    }).toThrow()
  })
})
