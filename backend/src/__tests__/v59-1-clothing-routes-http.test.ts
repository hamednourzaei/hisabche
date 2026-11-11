// ============================================
// backend/src/__tests__/v59-1-clothing-routes-http.test.ts
//
// Real Fastify HTTP integration tests (buildServer + app.inject) for Item 3 (Clothing):
//   • GET /api/products/:id/variants/stock (returns active reservations for ATP)
//   • POST /api/invoices/:id/exchange (condition disposition routing + permission check)
//   • POST /api/transfer-requests/:id/action (short receive discrepancy tracking)
//   • GET /api/accounting/profit-report/variants (size / colour / brand report via report owner)
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb, fakeId, type Row } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-cl-owner' }
const SELLER = { id: '22222222-2222-4222-8222-222222222222', token: 'token-cl-seller' }
const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PROD = '33333333-3333-4333-8333-333333333333'
const VAR_L = '44444444-4444-4444-8444-444444444441'
const INV_1 = '55555555-5555-4555-8555-555555555551'
const LINE_1 = '66666666-6666-4666-8666-666666666661'
const TR_1 = '77777777-7777-4777-8777-777777777771'
const TR_LINE_1 = '88888888-8888-4888-8888-888888888881'
const WH_A = '99999999-9999-4999-8999-999999999991'
const WH_B = '99999999-9999-4999-8999-999999999992'

const users = new Map<string, { id: string }>([
  [OWNER.token, { id: OWNER.id }],
  [SELLER.token, { id: SELLER.id }],
])

vi.mock('../db', () => createFakeDb(db, users))

let app: FastifyInstance

function resetWorld() {
  db.tables.clear()
  db.failures.clear()
  db.rpcs.clear()
  db.queries.length = 0

  db.seed('workspaces', [
    { id: SHOP, name: 'Kabul Apparel', base_currency: 'AFN', time_zone: 'Asia/Kabul' },
  ])
  db.seed('workspace_members', [
    {
      id: fakeId('m'),
      workspace_id: SHOP,
      user_id: OWNER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
      joined_at: '2026-01-01T00:00:00Z',
    },
    {
      id: fakeId('m'),
      workspace_id: SHOP,
      user_id: SELLER.id,
      role: 'seller',
      has_access: true,
      suspended_at: null,
      joined_at: '2026-01-01T00:00:00Z',
    },
  ])
  db.seed('products', [{ id: PROD, workspace_id: SHOP, name: 'Jacket', quantity: 10 }])
  db.seed('product_variants', [
    {
      id: VAR_L,
      workspace_id: SHOP,
      template_product_id: PROD,
      sku: 'JKT-L-BLK',
      barcode: null,
      attributes: [
        { name: 'size', value: 'L' },
        { name: 'colour', value: 'Black' },
        { name: 'brand', value: 'Aria' },
      ],
      price_override_minor: null,
      is_active: true,
    },
  ])
  db.seed('stock_reservations', [
    {
      id: fakeId('res'),
      workspace_id: SHOP,
      product_id: PROD,
      variant_id: VAR_L,
      warehouse_id: WH_A,
      quantity: 3,
      status: 'active',
      expires_at: '2099-01-01T00:00:00Z',
    },
  ])
  db.seed('stock_movements', [
    {
      id: fakeId('sm'),
      workspace_id: SHOP,
      product_id: PROD,
      variant_id: VAR_L,
      quantity: 10,
      reference_type: 'adjustment',
    },
    {
      id: fakeId('sm'),
      workspace_id: SHOP,
      product_id: PROD,
      variant_id: VAR_L,
      quantity: -2,
      reference_type: 'invoice',
    },
  ])
  db.seed('warehouses', [
    { id: WH_A, workspace_id: SHOP, name: 'Main', deleted_at: null },
    { id: WH_B, workspace_id: SHOP, name: 'Branch', deleted_at: null },
  ])
  db.seed('invoices', [
    {
      id: INV_1,
      workspace_id: SHOP,
      currency: 'AFN',
      customer_id: null,
      warehouse_id: WH_A,
      branch_id: null,
    },
  ])
  db.seed('invoice_items', [
    {
      id: LINE_1,
      invoice_id: INV_1,
      workspace_id: SHOP,
      product_id: PROD,
      variant_id: VAR_L,
      product_name: 'Jacket',
    },
  ])
  db.seed('invoice_returns', [])
  db.seed('stock_transfers', [
    {
      id: TR_1,
      workspace_id: SHOP,
      transfer_number: 'TR-100',
      status: 'shipped',
      from_warehouse_id: WH_A,
      to_warehouse_id: WH_B,
      requested_at: '2026-11-10T00:00:00Z',
    },
  ])
  const trLine = {
    id: TR_LINE_1,
    workspace_id: SHOP,
    transfer_id: TR_1,
    product_id: PROD,
    quantity: 5,
    unit_id: null,
    received_quantity: null,
    notes: null,
  }
  db.seed('stock_transfer_lines', [trLine])
  // The fake does not invent joins: an embed (`lines:stock_transfer_lines(...)`)
  // is read from the parent row, so the transfer carries its lines nested.
  db.rows('stock_transfers')[0]!.lines = [{ ...trLine }]

  db.rpc('product_variant_stock', () => [{ variant_id: VAR_L, warehouse_id: WH_A, quantity: 8 }])
  // A transfer receipt is always keyed (transfer-<id>-<line>), so the keyed function is what runs.
  db.rpc('warehouse_transfer_stock_keyed', () => ({ ok: true }))
  db.rpc('invoice_return_create', (args: Row) => {
    const ret = args.p_return as Row
    const row = {
      id: fakeId('ret'),
      workspace_id: args.p_workspace_id,
      original_invoice_id: ret.originalInvoiceId,
      return_number: ret.returnNumber,
      grandTotalMinor: 1000,
    }
    db.seed('invoice_returns', [row])
    return row
  })
}

const headersOf = (user: { token: string }) => ({
  authorization: `Bearer ${user.token}`,
  'x-workspace-id': SHOP,
})

beforeAll(async () => {
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
})

afterAll(async () => {
  await app?.close()
})

beforeEach(() => {
  resetWorld()
})

describe('V59.1 Clothing routes (ATP, Exchange Condition Disposition, Transfer Discrepancy, Attribute Reports)', () => {
  it('returns active reservations alongside variant stock for ATP calculation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/products/${PROD}/variants/stock`,
      headers: headersOf(OWNER),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      data: { reservations: Array<{ quantity: number; variantId: string }> }
    }
    expect(body.data.reservations).toHaveLength(1)
    expect(body.data.reservations[0]!.variantId).toBe(VAR_L)
    expect(body.data.reservations[0]!.quantity).toBe(3)
  })

  it('refuses defective quarantine exchange without stock.adjust and processes sound variant exchange', async () => {
    const denied = await app.inject({
      method: 'POST',
      url: `/api/invoices/${INV_1}/exchange`,
      headers: { ...headersOf(SELLER), 'idempotency-key': 'exch-deny-1' },
      payload: {
        returnNumber: 'EX-001',
        returnDate: '2026-11-11',
        returnedLines: [
          {
            originalLineId: LINE_1,
            variantId: VAR_L,
            quantity: 1,
            conditionCode: 'defective',
            restockChoice: 'restock',
          },
        ],
      },
    })
    expect(denied.statusCode).toBe(403)

    const allowed = await app.inject({
      method: 'POST',
      url: `/api/invoices/${INV_1}/exchange`,
      headers: { ...headersOf(OWNER), 'idempotency-key': 'exch-ok-1' },
      payload: {
        returnNumber: 'EX-002',
        returnDate: '2026-11-11',
        returnedLines: [
          {
            originalLineId: LINE_1,
            variantId: VAR_L,
            quantity: 1,
            conditionCode: 'sealed',
            restockChoice: 'restock',
          },
        ],
      },
    })
    expect(allowed.statusCode, allowed.body).toBe(201)
    const payload = allowed.json() as {
      data: { dispositions: Array<{ bucket: string }> }
    }
    expect(payload.data.dispositions[0]!.bucket).toBe('sellable_stock')
  })

  it('records short-received transfer discrepancy and rejects receivedQuantity exceeding shipped', async () => {
    const over = await app.inject({
      method: 'POST',
      url: `/api/transfer-requests/${TR_1}/action`,
      headers: headersOf(OWNER),
      payload: {
        action: 'receive',
        receivedLines: [{ lineId: TR_LINE_1, receivedQuantity: 9 }],
      },
    })
    expect(over.statusCode).toBe(400)

    const shortOk = await app.inject({
      method: 'POST',
      url: `/api/transfer-requests/${TR_1}/action`,
      headers: headersOf(OWNER),
      payload: {
        action: 'receive',
        receivedLines: [
          { lineId: TR_LINE_1, receivedQuantity: 4, reason: '1 shirt missing in transit' },
        ],
      },
    })
    expect(shortOk.statusCode, shortOk.body).toBe(200)
    const trLine = db.rows('stock_transfer_lines')[0]
    expect(trLine!.received_quantity).toBe(4)
    expect(String(trLine!.notes)).toContain('discrepancy: 1')
  })

  it('serves size / colour / brand report via AccountingService report owner with null unknown margin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/accounting/profit-report/variants?attribute=size',
      headers: headersOf(OWNER),
    })
    expect(res.statusCode, res.body).toBe(200)
    const rows = (
      res.json() as {
        data: Array<{
          attributeValue: string
          onHand: number
          sold: number
          marginMinor: number | null
        }>
      }
    ).data
    expect(rows[0]).toEqual({
      attributeName: 'size',
      attributeValue: 'L',
      onHand: 8,
      sold: 2,
      marginMinor: null,
    })
  })
})
