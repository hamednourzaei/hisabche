// ============================================
// UNKNOWN IS NOT ZERO — the cost of goods, from every way stock comes in.
//
// The bug this is shaped around (INV-000077, 11 Oct 2026): fifteen bottles sold
// at 30,000 each, on a product that had a purchase price. The invoice said
// «cost of goods 0 · gross profit 450,000 · margin 100%».
//
// Why six thousand green tests did not see it:
//
//   1. Every costing test bought the goods with a PURCHASE INVOICE first, so a
//      cost layer always existed. The way a shop really starts — «make the
//      product with a quantity and a purchase price, then sell it» — was never
//      a fixture. A cost layer was written by a purchase and by nothing else.
//   2. The one test that did reach «no cost» asserted `cost: 0, costMissing:
//      true` and stopped there. It locked the zero in and never looked at the
//      profit and the margin that were built on it.
//
// So this suite is a MATRIX, not a scenario: each way stock can arrive, then a
// sale, then the question «what did it cost — or do we say we do not know?».
// A new way to bring stock in gets a row here.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId, type Row } from './helpers/fake-supabase'
import {
  buildProfitReport,
  invoiceMargins,
  isCostDeterminate,
} from '../services/accounting/profit-report.domain'
import { explainInvoiceProfit } from '../services/accounting/evidence.domain'
import { breakEven, runScenario } from '../services/analytics/break-even.domain'
import { peerFactsFrom } from '../services/analytics/benchmark.domain'
import { findUnvaluedStock } from '../services/inventory-costing/unvalued-stock.domain'

const db = new FakeDatabase()

const OWNER = { id: fakeId('owner'), token: 'cost-token-owner' }
const SHOP = fakeId('shop')
const users = new Map<string, { id: string }>([[OWNER.token, { id: OWNER.id }]])

vi.mock('../db', async () => (globalThis as any).__costFakeDb)

const RECEIVABLE = fakeId('acct')
const SALES = fakeId('acct')
const COGS = fakeId('acct')
const INVENTORY = fakeId('acct')
const BOTTLE = fakeId('product')
const INVOICE = fakeId('invoice')
const ITEM = fakeId('item')

const SOLD = 15
const PRICE = 30_000
const BOUGHT_AT = 20_000

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

const soldLine = {
  id: ITEM,
  invoice_id: INVOICE,
  product_id: BOTTLE,
  product_name: 'شیشه بطری',
  quantity: SOLD,
  unit_price: PRICE,
  total_price: SOLD * PRICE,
}

/** A shop with one product on the shelf and one sale of it, not yet in the books. */
function resetWorld(product: { quantity: number; buyPrice: number }) {
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
  db.seed('workspaces', [{ id: SHOP, base_currency: 'IRR' }])
  db.seed('accounts', [
    account(RECEIVABLE, '1200', 'دریافتنی', 'asset', 'receivable'),
    account(SALES, '4000', 'فروش', 'revenue', 'sales'),
    account(COGS, '5000', 'بهای تمام‌شده', 'expense', 'cogs'),
    account(INVENTORY, '1000', 'موجودی کالا', 'asset', 'inventory'),
  ])
  db.seed('accounting_period_locks', [])
  db.seed('warehouses', [])
  db.seed('cost_layers', [])
  db.seed('cost_consumptions', [])
  db.seed('journal_entries', [])
  db.seed('journal_lines', [])
  db.seed('stock_movements', [])
  db.seed('payment_allocations', [])
  db.seed('payments', [])
  db.seed('products', [
    {
      id: BOTTLE,
      workspace_id: SHOP,
      user_id: OWNER.id,
      name: 'شیشه بطری',
      quantity: product.quantity,
      buy_price: product.buyPrice,
      sell_price: PRICE,
      deleted_at: null,
    },
  ])
  db.seed('invoices', [
    {
      id: INVOICE,
      workspace_id: SHOP,
      user_id: OWNER.id,
      invoice_number: 'INV-000077',
      type: 'sale',
      status: 'completed',
      document_status: 'draft',
      subtotal: SOLD * PRICE,
      discount_total: 0,
      total: SOLD * PRICE,
      paid_amount: 0,
      currency: 'IRR',
      date: '2026-10-11',
      customer_id: null,
      warehouse_id: null,
      deleted_at: null,
      // The detail read embeds the lines; the reports read the table.
      invoice_items: [soldLine],
    },
  ])
  db.seed('invoice_items', [soldLine])
}

function registerRpcs() {
  db.rpc('accounting_post_journal_entry', (args) => {
    const posted = args.p_entry as Row
    const taken = db
      .rows('journal_entries')
      .find(
        (row) =>
          row.workspace_id === args.p_workspace_id &&
          posted.source_id &&
          row.source_type === posted.source_type &&
          row.source_id === posted.source_id,
      )
    if (taken) return taken.id
    const id = fakeId('entry')
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

  // inventory_receive_layer, as docs/inventory-costing-migration.sql writes it:
  // one layer per (source_type, source_id, source_line).
  db.rpc('inventory_receive_layer', (args) => {
    const payload = args.p_payload as Row
    const same = db
      .rows('cost_layers')
      .find(
        (row) =>
          row.workspace_id === args.p_workspace_id &&
          row.source_type === payload.source_type &&
          row.source_id === payload.source_id &&
          row.source_line === payload.source_line,
      )
    if (same) return same.id
    const id = fakeId('layer')
    db.seed('cost_layers', [
      {
        id,
        workspace_id: args.p_workspace_id,
        product_id: payload.product_id,
        warehouse_id: payload.warehouse_id ?? null,
        received_qty: Number(payload.quantity),
        remaining_qty: Number(payload.quantity),
        unit_cost: Number(payload.unit_cost),
        currency: payload.currency,
        entry_date: payload.entry_date,
        created_at: new Date(
          Date.UTC(2026, 9, 1, 0, 0, db.rows('cost_layers').length),
        ).toISOString(),
        source_type: payload.source_type,
        source_id: payload.source_id,
        source_line: payload.source_line,
      },
    ])
    return id
  })

  // inventory_consume_layers: oldest layer first, refused when the layers do
  // not hold the quantity (the default «block» policy), once per consumer line.
  db.rpc('inventory_consume_layers', (args) => {
    const payload = args.p_payload as Row
    const mine = (row: Row) =>
      row.workspace_id === args.p_workspace_id &&
      row.consumer_type === payload.consumer_type &&
      row.consumer_id === payload.consumer_id &&
      row.consumer_line === payload.consumer_line &&
      row.product_id === payload.product_id
    const before = db.rows('cost_consumptions').filter(mine)
    if (before.length > 0) {
      return {
        status: 'already_consumed',
        quantity: before.reduce((sum, row) => sum + Number(row.quantity), 0),
        total_cost: before.reduce((sum, row) => sum + Number(row.amount), 0),
        shortfall: 0,
      }
    }
    const needed = Number(payload.quantity)
    const open = db
      .rows('cost_layers')
      .filter(
        (row) =>
          row.workspace_id === args.p_workspace_id &&
          row.product_id === payload.product_id &&
          Number(row.remaining_qty) > 0,
      )
      .sort((a, b) =>
        String(a.entry_date) === String(b.entry_date)
          ? String(a.created_at).localeCompare(String(b.created_at))
          : String(a.entry_date).localeCompare(String(b.entry_date)),
      )
    const available = open.reduce((sum, row) => sum + Number(row.remaining_qty), 0)
    if (available < needed) throw new Error('INVENTORY_INSUFFICIENT_STOCK')

    let left = needed
    let total = 0
    for (const layer of open) {
      if (left <= 0) break
      const take = Math.min(Number(layer.remaining_qty), left)
      layer.remaining_qty = Number(layer.remaining_qty) - take
      left -= take
      total += take * Number(layer.unit_cost)
      db.seed('cost_consumptions', [
        {
          id: fakeId('consumption'),
          workspace_id: args.p_workspace_id,
          layer_id: layer.id,
          product_id: payload.product_id,
          consumer_type: payload.consumer_type,
          consumer_id: payload.consumer_id,
          consumer_line: payload.consumer_line,
          quantity: take,
          unit_cost: Number(layer.unit_cost),
          amount: take * Number(layer.unit_cost),
          is_estimated: false,
          entry_date: payload.entry_date,
          created_at: new Date().toISOString(),
        },
      ])
    }
    return { status: 'consumed', quantity: needed, total_cost: total, shortfall: 0 }
  })
}

let app: FastifyInstance

beforeAll(async () => {
  ;(globalThis as any).__costFakeDb = createFakeDb(db, users)
  resetWorld({ quantity: 20, buyPrice: BOUGHT_AT })
  registerRpcs()
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
}, 60_000)

afterAll(async () => {
  await app?.close()
})

beforeEach(async () => {
  const { memoryCache } = await import('../utils/pagination')
  await memoryCache.invalidate('')
})

const headers = { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP }

const post = (url: string, payload?: Record<string, unknown>) =>
  app.inject({ method: 'POST', url, headers, ...(payload ? { payload } : {}) })
const get = (url: string) => app.inject({ method: 'GET', url, headers })

/** Debits minus credits on one account, over every line in the books. */
function held(accountId: string): number {
  return db
    .rows('journal_lines')
    .filter((line) => line.account_id === accountId)
    .reduce((sum, line) => sum + Number(line.debit ?? 0) - Number(line.credit ?? 0), 0)
}

async function evidence() {
  const response = await get(`/api/accounting/evidence/invoices/${INVOICE}`)
  expect(response.statusCode).toBe(200)
  return response.json()
}

// ─── The rule, with no database ──────────────────────────────────────────────

describe('the rule: a cost nobody recorded is unknown, never zero', () => {
  const invoice = { id: 'i', currency: 'IRR', subtotal: 450_000, discountTotal: 0 }
  const line = {
    invoiceId: 'i',
    productId: 'bottle',
    productName: 'شیشه بطری',
    quantity: 15,
    totalPrice: 450_000,
  }
  const report = (consumptions: Parameters<typeof buildProfitReport>[0]['consumptions']) =>
    buildProfitReport({
      from: '',
      to: '',
      currency: 'IRR',
      invoices: [invoice],
      lines: [line],
      consumptions,
      payrolls: [],
    })

  it('⚠️ INV-000077: no consumption → no profit and no margin, not 450,000 and 100%', () => {
    const { products, totals } = report([])
    expect(products[0]).toMatchObject({
      costStatus: 'unknown',
      costMissing: true,
      uncostedQuantity: 15,
      profit: null,
      marginPercent: null,
    })
    expect(totals).toMatchObject({
      revenue: 450_000,
      costStatus: 'unknown',
      uncostedRevenue: 450_000,
      grossProfit: null,
      netProfit: null,
      netMarginPercent: null,
    })
    // The number the screen used to show must not be reachable from the report.
    expect(Object.values(totals)).not.toContain(100)
  })

  it('the cost is known → 150,000 and 33.33%', () => {
    const { totals, products } = report([
      { invoiceId: 'i', productId: 'bottle', amount: 300_000, isEstimated: false, quantity: 15 },
    ])
    expect(products[0]).toMatchObject({ costStatus: 'known', profit: 150_000 })
    expect(totals).toMatchObject({ grossProfit: 150_000, netMarginPercent: 33.33 })
  })

  it('ten units costed and five not → partial: the 200,000 is stated, the profit is not', () => {
    const { totals, products } = report([
      { invoiceId: 'i', productId: 'bottle', amount: 200_000, isEstimated: false, quantity: 10 },
    ])
    expect(products[0]).toMatchObject({
      costStatus: 'partial',
      cost: 200_000,
      uncostedQuantity: 5,
      profit: null,
      marginPercent: null,
    })
    expect(totals.grossProfit).toBeNull()
  })

  it('a layer bought at zero is a KNOWN zero: 100% is then a real margin', () => {
    const { totals, products } = report([
      { invoiceId: 'i', productId: 'bottle', amount: 0, isEstimated: false, quantity: 15 },
    ])
    expect(products[0]).toMatchObject({ costStatus: 'known', profit: 450_000 })
    expect(totals.netMarginPercent).toBe(100)
  })

  it('a service line has no cost to miss', () => {
    const { totals } = buildProfitReport({
      from: '',
      to: '',
      currency: 'IRR',
      invoices: [invoice],
      lines: [{ ...line, productId: null }],
      consumptions: [],
      payrolls: [],
    })
    expect(totals).toMatchObject({ costStatus: 'none', grossProfit: 450_000 })
    expect(isCostDeterminate('none')).toBe(true)
  })

  it('one uncosted product does not hide the profit that IS known', () => {
    const { totals } = buildProfitReport({
      from: '',
      to: '',
      currency: 'IRR',
      invoices: [{ ...invoice, subtotal: 550_000 }],
      lines: [
        line,
        { ...line, productId: 'cap', productName: 'درب', quantity: 10, totalPrice: 100_000 },
      ],
      consumptions: [
        { invoiceId: 'i', productId: 'cap', amount: 60_000, isEstimated: false, quantity: 10 },
      ],
      payrolls: [],
    })
    expect(totals).toMatchObject({
      costStatus: 'partial',
      grossProfit: null,
      knownGrossProfit: 40_000,
      uncostedRevenue: 450_000,
    })
  })

  it('every reader of the report says «unknown» the same way', () => {
    const unknown = report([])
    expect(invoiceMargins([invoice], [line], []).get('i')).toMatchObject({
      marginPercent: null,
      costStatus: 'unknown',
      costMissing: true,
    })
    const explained = explainInvoiceProfit({
      invoice,
      lines: [line],
      consumptions: [],
      ledger: [],
      payments: [],
    })
    expect(explained).toMatchObject({
      grossProfit: null,
      marginPercent: null,
      costStatus: 'unknown',
    })
    expect(explained.lines[0]).toMatchObject({ profit: null, uncostedQuantity: 15 })
    expect(explained.warnings).toContain('COST_MISSING')

    // Break-even: revenue is not a contribution.
    expect(breakEven(unknown, { salaries: 0, other: 1_000 }).rows[0]).toMatchObject({
      contribution: null,
      breakEvenQuantity: null,
      breakEvenReason: 'COST_UNKNOWN',
    })
    // A what-if on a profit nobody knows is not a finding.
    expect(runScenario(unknown, { kind: 'price_change', percent: 10 }).meaningful).toBe(false)
    // And it is not a margin to compare with other shops.
    expect(peerFactsFrom('w', unknown, 30).grossMarginPercent).toBeNull()
  })
})

describe('stock with no cost behind it', () => {
  it('is found by the gap between the shelf and the layers; no price → blocked, never zero', () => {
    const found = findUnvaluedStock([
      { productId: 'a', name: 'a', quantity: 20, buyPrice: 20_000, layeredQuantity: 5 },
      { productId: 'b', name: 'b', quantity: 4, buyPrice: 0, layeredQuantity: 0 },
      { productId: 'c', name: 'c', quantity: 3, buyPrice: 10, layeredQuantity: 3 },
    ])
    expect(found.rows.map((row) => [row.productId, row.quantity, row.value, row.status])).toEqual([
      ['a', 15, 300_000, 'ready'],
      ['b', 4, null, 'no_buy_price'],
    ])
    expect(found.ready).toEqual({ products: 1, quantity: 15, value: 300_000 })
    expect(found.blocked).toEqual({ products: 1, quantity: 4 })
  })
})

// ─── The matrix, over real HTTP ──────────────────────────────────────────────

describe('each way stock arrives × a sale', () => {
  it('⚠️ a product made with a quantity and a purchase price writes its cost layer', async () => {
    resetWorld({ quantity: 20, buyPrice: BOUGHT_AT })
    const response = await post('/api/products', {
      name: 'شیشه دارو',
      quantity: 40,
      buyPrice: 12_000,
      sellPrice: 18_000,
    })
    expect(response.statusCode).toBeLessThan(300)
    const id = response.json().id ?? response.json().data?.id
    const layers = db.rows('cost_layers').filter((row) => row.product_id === id)
    expect(layers).toHaveLength(1)
    expect(layers[0]).toMatchObject({
      source_type: 'opening',
      received_qty: 40,
      unit_cost: 12_000,
      currency: 'IRR',
    })
  })

  it('a product made with NO purchase price gets no layer — a zero layer would be a lie', async () => {
    resetWorld({ quantity: 20, buyPrice: BOUGHT_AT })
    const response = await post('/api/products', { name: 'بی‌قیمت', quantity: 9, sellPrice: 100 })
    expect(response.statusCode).toBeLessThan(300)
    const id = response.json().id ?? response.json().data?.id
    expect(db.rows('cost_layers').filter((row) => row.product_id === id)).toHaveLength(0)
  })

  it('opening stock with its layer, then the sale → cost 300,000, profit 150,000, COGS in the books', async () => {
    resetWorld({ quantity: 20, buyPrice: BOUGHT_AT })
    db.seed('cost_layers', [
      {
        id: fakeId('layer'),
        workspace_id: SHOP,
        product_id: BOTTLE,
        warehouse_id: null,
        received_qty: 20,
        remaining_qty: 20,
        unit_cost: BOUGHT_AT,
        currency: 'IRR',
        entry_date: '2026-10-01',
        created_at: '2026-10-01T00:00:00.000Z',
        source_type: 'opening',
        source_id: BOTTLE,
        source_line: 'none',
      },
    ])

    const posted = await post(`/api/invoices/${INVOICE}/post-to-ledger`)
    expect(posted.statusCode).toBe(200)
    expect(posted.json()).toMatchObject({ status: 'posted' })

    expect(held(COGS)).toBe(300_000)
    expect(held(INVENTORY)).toBe(-300_000)
    expect(await evidence()).toMatchObject({
      netSales: 450_000,
      cost: 300_000,
      costStatus: 'known',
      grossProfit: 150_000,
      marginPercent: 33.33,
    })
  })

  it('⚠️ stock with no layer, then the sale → the books hold revenue only and the profit is UNKNOWN', async () => {
    resetWorld({ quantity: 20, buyPrice: BOUGHT_AT })

    const posted = await post(`/api/invoices/${INVOICE}/post-to-ledger`)
    expect(posted.json()).toMatchObject({ status: 'posted', uncostedProducts: [BOTTLE] })
    expect(held(SALES)).toBe(-450_000)
    expect(held(COGS)).toBe(0)

    const explained = await evidence()
    expect(explained).toMatchObject({
      netSales: 450_000,
      cost: 0,
      costStatus: 'unknown',
      grossProfit: null,
      marginPercent: null,
    })
    expect(explained.warnings).toContain('COST_MISSING')
  })

  it('⚠️ that sale is then given its cost — once, as its own entry, without touching the shelf', async () => {
    // 20 were on the shelf, 15 were sold with no cost: 5 remain.
    resetWorld({ quantity: 5, buyPrice: BOUGHT_AT })
    await post(`/api/invoices/${INVOICE}/post-to-ledger`)
    expect(held(COGS)).toBe(0)

    // What is still on the shelf is valued first, the way a person would.
    const unvalued = (await get('/api/inventory/unvalued')).json()
    expect(unvalued.ready).toEqual({ products: 1, quantity: 5, value: 100_000 })
    const valued = await post('/api/inventory/unvalued/value')
    expect(valued.json()).toMatchObject({ valued: 1, quantity: 5, value: 100_000 })
    expect((await get('/api/inventory/unvalued')).json().rows).toEqual([])

    const first = await post(`/api/invoices/${INVOICE}/cost`)
    expect(first.statusCode).toBe(200)
    expect(first.json()).toMatchObject({ status: 'costed', cost: 300_000, posted: 300_000 })
    expect(held(COGS)).toBe(300_000)
    expect(held(INVENTORY)).toBe(-300_000)

    // The five on the shelf still have their own cost: the sale did not eat it.
    const shelf = db
      .rows('cost_layers')
      .filter((row) => row.product_id === BOTTLE)
      .reduce((sum, row) => sum + Number(row.remaining_qty), 0)
    expect(shelf).toBe(5)

    // The entry is keyed by a real UUID: journal_entries.source_id is a uuid
    // column, and a readable key would be refused by Postgres.
    const { lateCostKey } = await import('../services/invoice.service')
    const late = db.rows('journal_entries').find((row) => row.source_type === 'cost_repost')
    expect(late?.source_id).toBe(lateCostKey(INVOICE))
    expect(String(late?.source_id)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )

    // Asked again: nothing more is posted.
    const second = await post(`/api/invoices/${INVOICE}/cost`)
    expect(second.json()).toMatchObject({ status: 'nothing_to_cost', posted: 0 })
    expect(held(COGS)).toBe(300_000)

    expect(await evidence()).toMatchObject({
      costStatus: 'known',
      cost: 300_000,
      grossProfit: 150_000,
      marginPercent: 33.33,
    })
  })

  it('⚠️ deleting that sale takes its late cost out of the books with it', async () => {
    resetWorld({ quantity: 5, buyPrice: BOUGHT_AT })
    await post('/api/invoices/' + INVOICE + '/post-to-ledger')
    const costed = await post('/api/invoices/' + INVOICE + '/cost')
    expect(costed.json()).toMatchObject({ status: 'costed', posted: 300_000 })
    expect(held(COGS)).toBe(300_000)

    const removed = await app.inject({ method: 'DELETE', url: '/api/invoices/' + INVOICE, headers })
    expect(removed.statusCode, removed.body).toBeLessThan(300)

    // Balances, not row counts: the reversing entries stay beside the originals.
    expect(held(SALES)).toBe(0)
    expect(held(RECEIVABLE)).toBe(0)
    expect(held(COGS)).toBe(0)
    expect(held(INVENTORY)).toBe(0)
  })

  it('a product with no purchase price stays unknown — nothing is invented for it', async () => {
    resetWorld({ quantity: 5, buyPrice: 0 })
    await post(`/api/invoices/${INVOICE}/post-to-ledger`)

    expect((await get('/api/inventory/unvalued')).json()).toMatchObject({
      ready: { products: 0, quantity: 0, value: 0 },
      blocked: { products: 1, quantity: 5 },
    })
    expect((await post('/api/inventory/unvalued/value')).json()).toMatchObject({ valued: 0 })

    const costed = await post(`/api/invoices/${INVOICE}/cost`)
    expect(costed.json()).toMatchObject({
      status: 'still_uncosted',
      cost: 0,
      posted: 0,
      uncostedProducts: [BOTTLE],
    })
    expect(db.rows('cost_layers')).toHaveLength(0)
    expect(held(COGS)).toBe(0)
    expect(await evidence()).toMatchObject({ costStatus: 'unknown', grossProfit: null })
  })
})
