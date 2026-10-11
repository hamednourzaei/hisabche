// ============================================
// FROM THE END BACK TO THE START — an invoice.
//
// Every other suite walks forward: make the document, check what it wrote.
// This one starts from what a posted, paid sale has LEFT BEHIND — a journal
// entry, a stock movement, a payment and its allocation — removes the invoice
// over real HTTP, and asks whether the business is back where it began.
//
// The bug it is shaped around: `InvoiceService.delete` was two table deletes.
// The invoice vanished from the list and stayed in the books, on the shelf and
// in the cash, and nothing anywhere was red.
//
// What «back where it began» means: BALANCES, not row counts. The reversing
// entry stays in the ledger beside the original — money is reversed, never
// erased — so each account nets to zero while the journal grows.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId, type Row } from './helpers/fake-supabase'

const db = new FakeDatabase()

const OWNER = { id: fakeId('owner'), token: 'reverse-token-owner' }
const SHOP = fakeId('shop')
const users = new Map<string, { id: string }>([[OWNER.token, { id: OWNER.id }]])

vi.mock('../db', async () => (globalThis as any).__reverseFakeDb)

const CASH = fakeId('acct')
const SALES = fakeId('acct')
const RECEIVABLE = fakeId('acct')
const CUSTOMER = fakeId('customer')
const PRODUCT = fakeId('product')
const INVOICE = fakeId('invoice')
const OTHER_INVOICE = fakeId('invoice')
const PAYMENT = fakeId('payment')
const INVOICE_ENTRY = fakeId('entry')
const PAYMENT_ENTRY = fakeId('entry')

const TOTAL = 1000
const SOLD = 3

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

function entry(
  id: string,
  number: string,
  sourceType: string,
  sourceId: string,
  lines: Array<{ account: string; debit: number; credit: number }>,
) {
  const embedded = lines.map((line) => ({
    id: fakeId('line'),
    account_id: line.account,
    debit: line.debit,
    credit: line.credit,
  }))
  db.seed('journal_entries', [
    {
      id,
      workspace_id: SHOP,
      user_id: OWNER.id,
      entry_date: '2026-10-01',
      date: '2026-10-01',
      description: number,
      reference: '',
      status: 'posted',
      entry_number: number,
      source_type: sourceType,
      source_id: sourceId,
      reversal_of: null,
      deleted_at: null,
      lines: embedded,
    },
  ])
  db.seed(
    'journal_lines',
    embedded.map((line) => ({ ...line, workspace_id: SHOP, journal_id: id })),
  )
}

/** The world a posted, fully paid sale of three units leaves behind. */
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
  db.seed('accounts', [
    account(CASH, '1100', 'نقد', 'asset', 'cash'),
    account(SALES, '4100', 'فروش', 'revenue', 'sales'),
    account(RECEIVABLE, '1200', 'دریافتنی', 'asset', 'receivable'),
  ])
  db.seed('accounting_period_locks', [])
  db.seed('customers', [{ id: CUSTOMER, workspace_id: SHOP, name: 'مشتری', deleted_at: null }])
  db.seed('products', [
    { id: PRODUCT, workspace_id: SHOP, name: 'کالا', quantity: 7, deleted_at: null },
  ])

  db.seed('invoices', [
    {
      id: INVOICE,
      workspace_id: SHOP,
      user_id: OWNER.id,
      invoice_number: 'INV-1',
      type: 'sale',
      status: 'completed',
      document_status: 'posted',
      total: TOTAL,
      paid_amount: TOTAL,
      currency: 'AFN',
      date: '2026-10-01',
      customer_id: CUSTOMER,
      warehouse_id: null,
      deleted_at: null,
    },
  ])
  db.seed('invoice_items', [
    {
      id: fakeId('item'),
      invoice_id: INVOICE,
      product_id: PRODUCT,
      quantity: SOLD,
      unit_price: TOTAL / SOLD,
      total_price: TOTAL,
    },
  ])
  db.seed('stock_movements', [
    {
      id: fakeId('move'),
      workspace_id: SHOP,
      user_id: OWNER.id,
      product_id: PRODUCT,
      type: 'sale',
      quantity: -SOLD,
      reference_type: 'invoice',
      reference_id: INVOICE,
      from_warehouse_id: null,
      to_warehouse_id: null,
    },
  ])

  entry(INVOICE_ENTRY, 'JE-1', 'invoice', INVOICE, [
    { account: RECEIVABLE, debit: TOTAL, credit: 0 },
    { account: SALES, debit: 0, credit: TOTAL },
  ])
  entry(PAYMENT_ENTRY, 'JE-2', 'payment', PAYMENT, [
    { account: CASH, debit: TOTAL, credit: 0 },
    { account: RECEIVABLE, debit: 0, credit: TOTAL },
  ])

  db.seed('payments', [
    {
      id: PAYMENT,
      workspace_id: SHOP,
      user_id: OWNER.id,
      payment_number: 'PAY-1',
      direction: 'in',
      party_type: 'customer',
      party_id: CUSTOMER,
      amount: TOTAL,
      currency: 'AFN',
      method: 'cash',
      status: 'posted',
      entry_date: '2026-10-01',
      reference: '',
      notes: '',
      journal_entry_id: PAYMENT_ENTRY,
      created_at: '2026-10-01T09:00:00.000Z',
      allocations: [{ id: fakeId('alloc'), invoice_id: INVOICE, amount: TOTAL }],
    },
  ])
  db.seed('payment_allocations', [
    {
      id: fakeId('alloc'),
      workspace_id: SHOP,
      payment_id: PAYMENT,
      invoice_id: INVOICE,
      amount: TOTAL,
    },
  ])

  // What the sale claimed, and the parts that exist only because of it.
  db.seed('stock_serials', [
    {
      id: fakeId('serial'),
      workspace_id: SHOP,
      product_id: PRODUCT,
      serial_number: 'SN-1',
      status: 'sold',
      invoice_id: INVOICE,
      sold_on: '2026-10-01',
    },
  ])
  db.seed('time_entries', [
    { id: fakeId('time'), workspace_id: SHOP, minutes: 90, invoice_id: INVOICE },
  ])
  db.seed('invoice_tax_lines', [
    { id: fakeId('tax'), workspace_id: SHOP, invoice_id: INVOICE, amount_minor: 9_000 },
  ])
  db.seed('invoice_installments', [
    { id: fakeId('part'), workspace_id: SHOP, invoice_id: INVOICE, seq: 1, amount_minor: 100_000 },
  ])
}

function registerRpcs() {
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

  // What `payments_cancel` does in Postgres: the payment stops counting and
  // lets go of every invoice it was settling.
  db.rpc('payments_cancel', (args) => {
    const payment = db
      .rows('payments')
      .find((row) => row.id === args.p_payment_id && row.workspace_id === args.p_workspace_id)
    if (!payment) throw new Error('PAYMENT_NOT_FOUND')
    payment.status = 'cancelled'
    payment.allocations = []
    const kept = db.rows('payment_allocations').filter((row) => row.payment_id !== payment.id)
    const freed = db.rows('payment_allocations').length - kept.length
    db.tables.set('payment_allocations', kept)
    return { unallocated: freed }
  })
}

let app: FastifyInstance

beforeAll(async () => {
  ;(globalThis as any).__reverseFakeDb = createFakeDb(db, users)
  resetWorld()
  registerRpcs()
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

/** What each account holds: debits minus credits, over every line in the books. */
function accountBalances(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const line of db.rows('journal_lines')) {
    const key = String(line.account_id)
    out[key] = (out[key] ?? 0) + Number(line.debit ?? 0) - Number(line.credit ?? 0)
  }
  return out
}

/** Net stock the recorded movements have taken from (or given to) the product. */
function netMoved(productId: string): number {
  return db
    .rows('stock_movements')
    .filter((row) => row.product_id === productId)
    .reduce((sum, row) => sum + Number(row.quantity ?? 0), 0)
}

describe('an invoice, undone', () => {
  it('the seeded world really is a posted, paid sale — or the test proves nothing', () => {
    expect(accountBalances()).toEqual({ [RECEIVABLE]: 0, [SALES]: -TOTAL, [CASH]: TOTAL })
    expect(netMoved(PRODUCT)).toBe(-SOLD)
  })

  it('⚠️ deleting it gives back the books, the shelf and the cash', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/invoices/${INVOICE}`,
      headers,
    })
    expect(response.statusCode, response.body).toBeLessThan(300)

    // The document is gone …
    expect(db.rows('invoices').some((row) => row.id === INVOICE)).toBe(false)
    expect(db.rows('invoice_items').some((row) => row.invoice_id === INVOICE)).toBe(false)

    // … and so is everything it did. Every account back to nothing.
    expect(accountBalances()).toEqual({ [RECEIVABLE]: 0, [SALES]: 0, [CASH]: 0 })

    // Reversed, not erased: the original entries are still there to be read.
    const entries = db.rows('journal_entries')
    expect(entries.find((row) => row.id === INVOICE_ENTRY)?.status).toBe('reversed')
    expect(entries.find((row) => row.id === PAYMENT_ENTRY)?.status).toBe('reversed')
    expect(entries.filter((row) => row.source_type === 'reversal')).toHaveLength(2)

    // The three units are back.
    expect(netMoved(PRODUCT)).toBe(0)

    // The payment no longer counts and holds no invoice.
    expect(db.rows('payments').find((row) => row.id === PAYMENT)?.status).toBe('cancelled')
    expect(db.rows('payment_allocations')).toHaveLength(0)

    // What it had claimed is free again: the serial can be sold, the hours billed.
    expect(db.rows('stock_serials')[0]).toMatchObject({
      status: 'in_stock',
      invoice_id: null,
      sold_on: null,
    })
    expect(db.rows('time_entries')[0]?.invoice_id).toBeNull()

    // And nothing that was only ever part of it is left to be reported or collected.
    expect(db.rows('invoice_tax_lines')).toHaveLength(0)
    expect(db.rows('invoice_installments')).toHaveLength(0)
  })

  it('⚠️ cancelling it gives back the same things, and keeps the document', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/invoices/${INVOICE}`,
      headers,
      payload: { status: 'cancelled' },
    })
    expect(response.statusCode, response.body).toBeLessThan(300)

    expect(db.rows('invoices').find((row) => row.id === INVOICE)?.status).toBe('cancelled')
    expect(accountBalances()).toEqual({ [RECEIVABLE]: 0, [SALES]: 0, [CASH]: 0 })
    expect(netMoved(PRODUCT)).toBe(0)
    expect(db.rows('payments').find((row) => row.id === PAYMENT)?.status).toBe('cancelled')
    expect(db.rows('stock_serials')[0]?.status).toBe('in_stock')
  })

  it('⚠️ a payment that also settles another invoice stops the delete, and nothing moves', async () => {
    db.seed('payment_allocations', [
      {
        id: fakeId('alloc'),
        workspace_id: SHOP,
        payment_id: PAYMENT,
        invoice_id: OTHER_INVOICE,
        amount: 1,
      },
    ])
    const before = {
      balances: accountBalances(),
      entries: db.rows('journal_entries').length,
      moved: netMoved(PRODUCT),
    }

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/invoices/${INVOICE}`,
      headers,
    })

    expect(response.statusCode, response.body).toBe(409)
    expect(response.body).toContain('INVOICE_PAYMENT_SHARED')
    expect(db.rows('invoices').some((row) => row.id === INVOICE)).toBe(true)
    expect(db.rows('payments').find((row) => row.id === PAYMENT)?.status).toBe('posted')
    expect({
      balances: accountBalances(),
      entries: db.rows('journal_entries').length,
      moved: netMoved(PRODUCT),
    }).toEqual(before)
  })

  it('deleting twice does not give anything back twice', async () => {
    await app.inject({ method: 'DELETE', url: `/api/invoices/${INVOICE}`, headers })
    await app.inject({ method: 'DELETE', url: `/api/invoices/${INVOICE}`, headers })

    expect(accountBalances()).toEqual({ [RECEIVABLE]: 0, [SALES]: 0, [CASH]: 0 })
    expect(netMoved(PRODUCT)).toBe(0)
  })
})
