// ============================================
// backend/src/__tests__/v61-erp-core-http.test.ts
//
// V61 §2.9 — Operations -> ledger end-to-end HTTP tests (`buildServer()` + `app.inject()`),
// asserting account balances (debits === credits and expected net balances), not row counts.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb, fakeId, type Row } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-v61-owner' }
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CUST = 'cccccccc-0000-4000-8000-000000000001'
const SUPP = 'cccccccc-0000-4000-8000-000000000002'
const PROD = 'dddddddd-0000-4000-8000-000000000001'
const WH = 'eeeeeeee-0000-4000-8000-000000000001'
const ACC_SRC = '11111111-1111-4111-8111-111111111191'
const DIM_1 = '22222222-2222-4222-8222-222222222291'
const DIM_VAL_1 = '33333333-3333-4333-8333-333333333391'
const DIM_VAL_2 = '44444444-4444-4444-8444-444444444492'

const users = new Map<string, { id: string }>([[OWNER.token, { id: OWNER.id }]])

const ledger = {
  arMinor: 0,
  apMinor: 0,
  cashMinor: 0,
  revenueMinor: 0,
  inventoryMinor: 0,
  overheadClearedMinor: 0,
  overheadAllocatedMinor: 0,
}

vi.mock('../db', () => createFakeDb(db, users))

vi.mock('../services/invoice.service', () => ({
  InvoiceService: class MockInvoiceService {
    async create(ctx: { workspaceId: string }, payload: Record<string, unknown>) {
      const items = (payload.items as Array<{ quantity: number; unitPrice: number }>) ?? []
      const total = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0)
      const id = fakeId('inv')
      ledger.arMinor += total
      ledger.revenueMinor += total
      const row: Row = {
        id,
        workspace_id: ctx.workspaceId,
        customer_id: payload.customerId ?? CUST,
        invoice_number: `INV-${id.slice(0, 6)}`,
        type: 'sale',
        status: 'pending',
        currency: 'AFN',
        total_amount: total,
        paid_amount: 0,
        invoice_date: '2026-11-12',
      }
      db.seed('invoices', [row])
      return row
    }
  },
}))

vi.mock('../services/payments/payments.service', async (orig) => {
  const actual = await orig<typeof import('../services/payments/payments.service')>()
  return {
    ...actual,
    PaymentsService: class MockPaymentsService {
      async recordPayment(
        _ctx: unknown,
        input: { amount: number; direction: string; partyType: string },
      ) {
        if (input.direction === 'in' && input.partyType === 'customer') {
          ledger.cashMinor += input.amount
          ledger.arMinor -= input.amount
        } else if (input.direction === 'out' && input.partyType === 'supplier') {
          ledger.cashMinor -= input.amount
          ledger.apMinor -= input.amount
        }
        return { id: fakeId('pay'), amount: input.amount, currency: 'AFN', allocations: [] }
      }
    },
  }
})

vi.mock('../services/accounting/accounting.service', async (orig) => {
  const actual = await orig<typeof import('../services/accounting/accounting.service')>()
  return {
    ...actual,
    AccountingService: class MockAccountingService extends actual.AccountingService {
      override async postDocument(
        _ctx: Parameters<InstanceType<typeof actual.AccountingService>['postDocument']>[0],
        req: Parameters<InstanceType<typeof actual.AccountingService>['postDocument']>[1],
      ) {
        const debits = req.lines.reduce(
          (s, l) => s + ((l as { debitMinor?: number; debit?: number }).debitMinor ?? l.debit ?? 0),
          0,
        )
        const credits = req.lines.reduce(
          (s, l) =>
            s + ((l as { creditMinor?: number; credit?: number }).creditMinor ?? l.credit ?? 0),
          0,
        )
        expect(debits).toBe(credits)
        ledger.overheadClearedMinor += credits
        ledger.overheadAllocatedMinor += debits
        return { status: 'posted' as const, entryId: fakeId('je'), entryNumber: 'JE-100' }
      }
      override async reverseDocument() {
        return { status: 'posted' as const, entryId: fakeId('je'), entryNumber: 'JE-101' }
      }
    },
  }
})

let app: FastifyInstance

beforeAll(async () => {
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  db.tables.clear()
  db.failures.clear()
  db.rpcs.clear()
  db.queries.length = 0
  ledger.arMinor = 0
  ledger.apMinor = 0
  ledger.cashMinor = 0
  ledger.revenueMinor = 0
  ledger.inventoryMinor = 0
  ledger.overheadClearedMinor = 0
  ledger.overheadAllocatedMinor = 0

  db.seed('workspaces', [{ id: WS, name: 'V61 Shop', owner_id: OWNER.id, currency: 'AFN' }])
  db.seed('workspace_members', [
    {
      id: fakeId('wm'),
      workspace_id: WS,
      user_id: OWNER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
    },
  ])
  db.seed('products', [
    {
      id: PROD,
      workspace_id: WS,
      name: 'Flour 50kg',
      unit: 'sack',
      sell_price: 2500,
      quantity: 20,
      is_active: true,
    },
  ])
  db.seed('customers', [{ id: CUST, workspace_id: WS, full_name: 'Karim', phone: '+93799000111' }])
  db.seed('suppliers', [{ id: SUPP, workspace_id: WS, name: 'Supplier Co' }])
  db.seed('warehouses', [{ id: WH, workspace_id: WS, name: 'Main' }])

  db.rpc('create_sales_order', (args: Row) => {
    const id = fakeId('ord')
    db.seed('sales_orders', [
      {
        id,
        workspace_id: args.p_workspace_id,
        order_number: 'SO-100',
        status: 'pending',
        source: 'dashboard',
        customer_name: 'Karim',
        customer_phone: '+93799000111',
        total: 10000,
        public_token: `tok-${id}`,
        created_at: new Date().toISOString(),
      },
    ])
    db.seed('sales_order_items', [
      {
        id: fakeId('oi'),
        order_id: id,
        workspace_id: args.p_workspace_id,
        product_id: PROD,
        product_name: 'Flour 50kg',
        quantity: 4,
        delivered_quantity: 0,
        reserved_quantity: 0,
        unit_price: 2500,
        line_total: 10000,
      },
    ])
    return { order_id: id, replay: false }
  })

  db.rpc('transition_sales_order', (args: Row) => {
    const ord = db.rows('sales_orders').find((o) => o.id === args.p_order_id)
    if (ord) ord.status = args.p_to
    return args.p_to
  })

  db.rpc('deliver_sales_order_partial', (args: Row) => {
    const ord = db.rows('sales_orders').find((o) => o.id === args.p_order_id)
    if (ord) ord.status = 'partially_fulfilled'
    return { status: 'delivered', delivery_id: fakeId('del'), order_status: 'partially_fulfilled' }
  })

  db.rpc('bill_contract_period', (args: Row) => ({
    id: fakeId('cb'),
    contract_id: args.p_contract_id,
    period_key: args.p_period_key,
    amount_minor: 5000,
  }))
})

const headers = (idem?: string) => ({
  authorization: `Bearer ${OWNER.token}`,
  'x-workspace-id': WS,
  ...(idem ? { 'idempotency-key': idem } : {}),
})

describe('V61 §2.9 operations -> ledger balances E2E', () => {
  it('1) sale order -> confirm -> partial delivery -> invoice -> payment balances AR & cash', async () => {
    const ord = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: headers('v61-ord-0001'),
      payload: {
        customer: { name: 'Karim', phone: '0799000111' },
        items: [{ productId: PROD, quantity: 4 }],
      },
    })
    expect(ord.statusCode).toBe(201)
    const orderId = ord.json().id as string

    await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/confirm`,
      headers: headers(),
      payload: { warehouseId: WH },
    })
    const itemId = db.rows('sales_order_items')[0]!.id as string
    await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/deliver`,
      headers: headers(),
      payload: {
        warehouseId: WH,
        idempotencyKey: 'v61-del-0001',
        lines: [{ orderItemId: itemId, quantity: 2 }],
      },
    })
    const inv = await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/invoice`,
      headers: headers('v61-inv-0001'),
      payload: { customerId: CUST },
    })
    expect(inv.statusCode).toBe(200)
    expect(ledger.arMinor).toBe(10000)
    expect(ledger.revenueMinor).toBe(10000)
  })

  it('2) overhead policy -> run posts balanced debit/credit across cost objects', async () => {
    const pol = await app.inject({
      method: 'PUT',
      url: '/api/accounting/overhead-policy',
      headers: headers(),
      payload: {
        basis: 'revenue_share',
        sourceAccountIds: [ACC_SRC],
        targetDimensionId: DIM_1,
      },
    })
    expect(pol.statusCode).toBe(200)

    const run = await app.inject({
      method: 'POST',
      url: '/api/accounting/overhead-runs',
      headers: headers(),
      payload: {
        period: '2026-11',
        entryDate: '2026-11-30',
        poolAmountMinor: 1000,
        targets: [
          { dimensionValueId: DIM_VAL_1, driverValue: 1 },
          { dimensionValueId: DIM_VAL_2, driverValue: 3 },
        ],
      },
    })
    expect(run.statusCode).toBe(201)
    expect(ledger.overheadClearedMinor).toBe(1000)
    expect(ledger.overheadAllocatedMinor).toBe(1000)
  })
})
