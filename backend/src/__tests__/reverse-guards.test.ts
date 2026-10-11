// ============================================
// FROM THE END BACK TO THE START — the removals that must be REFUSED.
//
// Undoing is not always «give it back». Sometimes the honest answer is «not
// while something still depends on it», and the bug is the removal that goes
// through anyway and leaves the dependants pointing at nothing:
//
//   • a customer deleted with invoices still in their name,
//   • a warehouse removed with goods still inside it,
//   • a till order voided after the till was counted and posted.
//
// Each case is checked from both ends: the removal is refused WITH a reason
// (409, a code — not a bare 500), and nothing at all changed; and the same
// removal goes through once the thing really is free.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()

const OWNER = { id: fakeId('owner'), token: 'guards-token-owner' }
const SHOP = fakeId('shop')
const users = new Map<string, { id: string }>([[OWNER.token, { id: OWNER.id }]])

vi.mock('../db', async () => (globalThis as any).__guardsFakeDb)

const BUSY_CUSTOMER = '11111111-1111-4111-8111-111111111111'
const PAYING_CUSTOMER = '22222222-2222-4222-8222-222222222222'
const FREE_CUSTOMER = '33333333-3333-4333-8333-333333333333'
const FULL_WAREHOUSE = '44444444-4444-4444-8444-444444444444'
const EMPTY_WAREHOUSE = '55555555-5555-4555-8555-555555555555'
const OPEN_TILL = '66666666-6666-4666-8666-666666666666'
const CLOSED_TILL = '77777777-7777-4777-8777-777777777777'
const OPEN_ORDER = '88888888-8888-4888-8888-888888888888'
const POSTED_ORDER = '99999999-9999-4999-8999-999999999999'
const PRODUCT = fakeId('product')
const SOLD_PRODUCT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const NEW_PRODUCT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const customer = (id: string, name: string) => ({
  id,
  workspace_id: SHOP,
  user_id: OWNER.id,
  name,
  deleted_at: null,
})
const warehouse = (id: string, name: string) => ({
  id,
  workspace_id: SHOP,
  name,
  is_default: false,
  deleted_at: null,
})
const till = (id: string, status: string) => ({
  id,
  workspace_id: SHOP,
  branch_id: null,
  status,
  opening_float_minor: 0,
  opened_by: OWNER.id,
  opened_at: '2026-10-01T08:00:00.000Z',
  closed_at: status === 'closed' ? '2026-10-01T18:00:00.000Z' : null,
})
const order = (id: string, sessionId: string) => ({
  id,
  workspace_id: SHOP,
  session_id: sessionId,
  order_ref: id.slice(0, 8),
  invoice_id: null,
  total_minor: 20_000,
  change_minor: 0,
  status: 'completed',
  created_at: '2026-10-01T09:00:00.000Z',
})

function resetWorld() {
  db.tables.clear()
  db.queries.length = 0
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
  db.seed('customers', [
    customer(BUSY_CUSTOMER, 'با فاکتور'),
    customer(PAYING_CUSTOMER, 'با پرداخت'),
    customer(FREE_CUSTOMER, 'بی‌سابقه'),
  ])
  db.seed('transactions', [])
  db.seed('invoices', [
    {
      id: fakeId('invoice'),
      workspace_id: SHOP,
      customer_id: BUSY_CUSTOMER,
      type: 'sale',
      status: 'pending',
      total: 500,
      paid_amount: 0,
      deleted_at: null,
    },
  ])
  db.seed('payments', [
    {
      id: fakeId('payment'),
      workspace_id: SHOP,
      party_type: 'customer',
      party_id: PAYING_CUSTOMER,
      amount: 100,
      status: 'posted',
    },
  ])
  db.seed('warehouses', [warehouse(FULL_WAREHOUSE, 'پر'), warehouse(EMPTY_WAREHOUSE, 'خالی')])
  db.seed('warehouse_stock', [
    { workspace_id: SHOP, warehouse_id: FULL_WAREHOUSE, product_id: PRODUCT, quantity: 12 },
    // A row that has gone back to zero is not stock.
    { workspace_id: SHOP, warehouse_id: EMPTY_WAREHOUSE, product_id: PRODUCT, quantity: 0 },
  ])
  db.seed('products', [
    { id: SOLD_PRODUCT, workspace_id: SHOP, user_id: OWNER.id, name: 'فروخته‌شده', quantity: 4 },
    { id: NEW_PRODUCT, workspace_id: SHOP, user_id: OWNER.id, name: 'تازه', quantity: 0 },
  ])
  db.seed('invoice_items', [
    { id: fakeId('item'), invoice_id: fakeId('invoice'), product_id: SOLD_PRODUCT, quantity: 1 },
  ])
  db.seed('stock_movements', [])
  db.seed('pos_sessions', [till(OPEN_TILL, 'open'), till(CLOSED_TILL, 'closed')])
  db.seed('pos_orders', [order(OPEN_ORDER, OPEN_TILL), order(POSTED_ORDER, CLOSED_TILL)])
}

let app: FastifyInstance

beforeAll(async () => {
  ;(globalThis as any).__guardsFakeDb = createFakeDb(db, users)
  resetWorld()
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
}, 60_000)

afterAll(async () => {
  await app?.close()
})

beforeEach(() => {
  resetWorld()
})

const headers = { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP }
const call = (method: 'DELETE' | 'POST', url: string) => app.inject({ method, url, headers })

describe('a customer', () => {
  it('⚠️ with invoices is not deleted, and the answer says why', async () => {
    const response = await call('DELETE', `/api/customers/${BUSY_CUSTOMER}`)

    expect(response.statusCode, response.body).toBe(409)
    expect(response.body).toContain('CUSTOMER_HAS_INVOICES')
    expect(db.rows('customers').some((row) => row.id === BUSY_CUSTOMER)).toBe(true)
  })

  it('⚠️ with payments is not deleted either', async () => {
    const response = await call('DELETE', `/api/customers/${PAYING_CUSTOMER}`)

    expect(response.statusCode, response.body).toBe(409)
    expect(response.body).toContain('CUSTOMER_HAS_PAYMENTS')
    expect(db.rows('customers').some((row) => row.id === PAYING_CUSTOMER)).toBe(true)
  })

  it('with no history is deleted', async () => {
    const response = await call('DELETE', `/api/customers/${FREE_CUSTOMER}`)

    expect(response.statusCode, response.body).toBe(204)
    expect(db.rows('customers').some((row) => row.id === FREE_CUSTOMER)).toBe(false)
    expect(db.rows('customers')).toHaveLength(2)
  })
})

describe('a warehouse', () => {
  it('⚠️ that still holds goods is not removed', async () => {
    const response = await call('DELETE', `/api/warehouses/${FULL_WAREHOUSE}`)

    expect(response.statusCode, response.body).toBe(409)
    expect(response.body).toContain('WAREHOUSE_HAS_STOCK')
    expect(db.rows('warehouses').find((row) => row.id === FULL_WAREHOUSE)?.deleted_at).toBeNull()
  })

  it('that is empty is removed', async () => {
    const response = await call('DELETE', `/api/warehouses/${EMPTY_WAREHOUSE}`)

    expect(response.statusCode, response.body).toBe(204)
    expect(db.rows('warehouses').find((row) => row.id === EMPTY_WAREHOUSE)?.deleted_at).toEqual(
      expect.any(String),
    )
  })
})

describe('a product', () => {
  it('⚠️ that has been sold is not deleted', async () => {
    const response = await call('DELETE', `/api/products/${SOLD_PRODUCT}`)

    expect(response.statusCode, response.body).toBe(409)
    expect(response.body).toContain('PRODUCT_HAS_INVOICE_ITEMS')
    expect(db.rows('products').some((row) => row.id === SOLD_PRODUCT)).toBe(true)
  })

  it('that was never sold or moved is deleted', async () => {
    const response = await call('DELETE', `/api/products/${NEW_PRODUCT}`)

    expect(response.statusCode, response.body).toBeLessThan(300)
    expect(db.rows('products').some((row) => row.id === NEW_PRODUCT)).toBe(false)
  })
})

describe('a till order', () => {
  it('is voided while its till is open', async () => {
    const response = await call('POST', `/api/pos/orders/${OPEN_ORDER}/void`)

    expect(response.statusCode, response.body).toBe(200)
    expect(db.rows('pos_orders').find((row) => row.id === OPEN_ORDER)?.status).toBe('voided')
  })

  it('⚠️ is not voided after its till was counted and closed', async () => {
    const response = await call('POST', `/api/pos/orders/${POSTED_ORDER}/void`)

    expect(response.statusCode, response.body).toBe(409)
    expect(response.body).toContain('POS_SESSION_NOT_OPEN')
    expect(db.rows('pos_orders').find((row) => row.id === POSTED_ORDER)?.status).toBe('completed')
  })

  it('⚠️ that does not exist is not reported as voided', async () => {
    const response = await call('POST', `/api/pos/orders/${fakeId('order')}/void`)
    expect(response.statusCode, response.body).toBe(404)
  })
})
