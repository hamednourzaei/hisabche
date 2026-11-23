// ============================================
// packages/local-engine/src/__tests__/order-deposit-sync-pull-device.test.ts
//
// Device B, after the server told it what Device A did.
//
// The pull itself is proved on the server (`order-deposit-sync-pull.test.ts`)
// and in the app shell (`deposit-pull.test.ts`). This file proves the RESULT a
// person reads: the rows the pull writes land in the device's own tables and
// the deposit screen adds them up. It uses `buildUpserts` — the same statement
// builder the desktop and mobile hosts run — so a column the schema does not
// accept would fail here rather than on a customer's laptop.
//
// ⚠️ THE PAYMENT REFERENCE IS THE TRAP THIS GUARD EXISTS FOR. `countsAgainstDeposit`
// counts a movement when `payment_id IS NULL` or when the payment is posted. A
// pulled movement carries no payment id (it belongs to the server's books), and
// it MUST still count — otherwise Device B offers the same 40 000 a second time.
// ============================================

import { buildUpserts } from '@hisabche/app-bridge'
import { beforeEach, describe, expect, it } from 'vitest'

import type { LocalDb } from '../db'
import { createTestDb, createTestEngine, TEST_WORKSPACE_ID } from './test-db'

const OTHER_WORKSPACE = '99999999-9999-4999-8999-999999999999'
const CUSTOMER = '00000000-0000-4000-8000-000000000001'
const ORDER = '00000000-0000-4000-8000-0000000000a1'
const DEPOSIT = '00000000-0000-4000-8000-0000000000d1'
const APPLICATION = '00000000-0000-4000-8000-0000000000e1'
const REFUND = '00000000-0000-4000-8000-0000000000f1'
const OTHER_DEPOSIT = '00000000-0000-4000-8000-0000000000d2'

interface DepositView {
  id: string
  orderId: string
  customerId: string
  amountMinor: number
  appliedMinor: number
  refundedMinor: number
  remainingMinor: number
  currency: string | null
  postingStatus: string | null
  status: string
  pendingSync: boolean
}

let db: LocalDb
let engine: ReturnType<typeof createTestEngine>

/**
 * The rows the server sends, exactly as the pull mapper builds them: the lean
 * columns, `origin: 'server'`, `sync_status: 'posted'`, and NO payment or
 * ledger reference from the server's books.
 */
function serverPage(): Array<{
  table: Parameters<typeof buildUpserts>[0]
  rows: Array<Record<string, unknown>>
}> {
  return [
    {
      table: 'order_deposits',
      rows: [
        {
          id: DEPOSIT,
          workspace_id: TEST_WORKSPACE_ID,
          order_id: ORDER,
          customer_id: CUSTOMER,
          amount_minor: 100_000,
          payment_method: 'cash',
          applied_invoice_id: null,
          currency: 'AFN',
          posting_status: 'posted',
          created_at: '2026-11-01T08:00:00.000Z',
          updated_at: '2026-11-01T08:00:00.000Z',
          origin: 'server',
          sync_state: 'synced',
        },
        // Another business's deposit: stored, never shown to this one.
        {
          id: OTHER_DEPOSIT,
          workspace_id: OTHER_WORKSPACE,
          order_id: ORDER,
          customer_id: CUSTOMER,
          amount_minor: 777_000,
          payment_method: 'cash',
          applied_invoice_id: null,
          currency: 'USD',
          posting_status: 'posted',
          created_at: '2026-11-01T08:00:00.000Z',
          updated_at: '2026-11-01T08:00:00.000Z',
          origin: 'server',
          sync_state: 'synced',
        },
      ],
    },
    {
      table: 'order_deposit_applications',
      rows: [
        {
          id: APPLICATION,
          workspace_id: TEST_WORKSPACE_ID,
          deposit_id: DEPOSIT,
          invoice_id: '00000000-0000-4000-8000-0000000000b1',
          amount_minor: 40_000,
          currency: 'AFN',
          idempotency_key: 'apply-key-0001',
          created_by: '00000000-0000-4000-8000-0000000000c1',
          created_at: '2026-11-02T08:00:00.000Z',
          updated_at: '2026-11-02T08:00:00.000Z',
          sync_status: 'posted',
          origin: 'server',
          sync_state: 'synced',
        },
      ],
    },
    {
      table: 'order_deposit_refunds',
      rows: [
        {
          id: REFUND,
          workspace_id: TEST_WORKSPACE_ID,
          deposit_id: DEPOSIT,
          amount_minor: 10_000,
          currency: 'AFN',
          method: 'cash',
          reason: 'بازگشت بخشی از بیعانه',
          idempotency_key: 'refund-key-0001',
          created_by: '00000000-0000-4000-8000-0000000000c1',
          created_at: '2026-11-03T08:00:00.000Z',
          updated_at: '2026-11-03T08:00:00.000Z',
          sync_status: 'posted',
          origin: 'server',
          sync_state: 'synced',
        },
      ],
    },
  ]
}

/** What the bridge does with a page: one prepared upsert per row. */
function applyServerPage(): void {
  for (const part of serverPage()) {
    for (const statement of buildUpserts(part.table, part.rows)) {
      db.run(statement.sql, statement.params)
    }
  }
}

const depositsOfCustomer = () =>
  engine.request<DepositView[]>({
    method: 'GET',
    path: `/customers/${CUSTOMER}/deposits`,
  })

const viewOf = async () => (await depositsOfCustomer()).data

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
  db.run(
    `INSERT INTO customer (id, workspace_id, full_name, is_active, created_at, updated_at)
     VALUES (?, ?, 'احمد هروی', 1, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')`,
    [CUSTOMER, TEST_WORKSPACE_ID],
  )
})

describe('device B after pulling a deposit taken on device A', () => {
  it('shows the receipt, the application and the refund the other device made', async () => {
    applyServerPage()

    const deposits = await viewOf()

    expect(deposits).toHaveLength(1)
    expect(deposits[0]).toMatchObject({
      id: DEPOSIT,
      orderId: ORDER,
      customerId: CUSTOMER,
      amountMinor: 100_000,
      appliedMinor: 40_000,
      refundedMinor: 10_000,
      remainingMinor: 50_000,
      currency: 'AFN',
      postingStatus: 'posted',
      status: 'partially_used',
      // Nothing of this deposit is waiting in THIS device's outbox.
      pendingSync: false,
    })
  })

  it('the pulled application counts against the deposit although its payment lives on the server', async () => {
    applyServerPage()

    // No payment row with that id exists here — and none should. The movement
    // must still count, or the 40 000 would be offered again.
    const payments = db.all<{ n: number }>(
      'SELECT count(*) AS n FROM payment WHERE workspace_id = ?',
      [TEST_WORKSPACE_ID],
    )
    expect(payments[0]!.n).toBe(0)

    const [view] = await viewOf()
    expect(view!.appliedMinor).toBe(40_000)
    expect(view!.remainingMinor).toBe(50_000)
  })

  it('duplicate delivery of the same page does not double the money', async () => {
    applyServerPage()
    applyServerPage()

    const deposits = await viewOf()
    expect(deposits).toHaveLength(1)
    expect(deposits[0]).toMatchObject({
      appliedMinor: 40_000,
      refundedMinor: 10_000,
      remainingMinor: 50_000,
    })

    const rows = db.all<{ n: number }>(
      'SELECT count(*) AS n FROM order_deposit_applications WHERE workspace_id = ?',
      [TEST_WORKSPACE_ID],
    )
    expect(rows[0]!.n).toBe(1)
  })

  it('a deposit of another business never appears in this one’s customer screen', async () => {
    applyServerPage()

    const deposits = await viewOf()
    expect(deposits.map((deposit) => deposit.id)).toEqual([DEPOSIT])
    expect(deposits.some((deposit) => deposit.amountMinor === 777_000)).toBe(false)
  })

  it('the pulled rows are what the backup exports, so a restore keeps them', () => {
    applyServerPage()

    // The backup walks `localTableSchema`; the three tables must be in it and
    // must carry the rows. This is the assertion that would fail if the
    // movement tables were left out of the registry.
    const backup = db.all<{ n: number }>(
      `SELECT (SELECT count(*) FROM order_deposits WHERE workspace_id = ?)
            + (SELECT count(*) FROM order_deposit_applications WHERE workspace_id = ?)
            + (SELECT count(*) FROM order_deposit_refunds WHERE workspace_id = ?) AS n`,
      [TEST_WORKSPACE_ID, TEST_WORKSPACE_ID, TEST_WORKSPACE_ID],
    )
    expect(backup[0]!.n).toBe(3)
  })
})

// ─── The other side of the books ───────────────────────────────────────────
//
// A supplier advance (pre_purchase) is PULLED to the device and MOVED on it:
// the money left the till before the purchase existed, so settling the
// purchase debits the payable and credits `supplier_advances` (asset 1250),
// and a refund comes back IN. Before the kind was stored, the pulled row
// looked like a plain sales deposit with `customer_id = NULL` and could be
// applied to a walk-in sale (`null = null`) — the same UUID-less match that
// this suite refuses below.
describe('a supplier advance pulled from the server', () => {
  const SUPPLIER = '00000000-0000-4000-8000-0000000000c9'
  const ADVANCE = '00000000-0000-4000-8000-0000000000d9'
  const UNRESOLVED = '00000000-0000-4000-8000-0000000000d8'
  const PURCHASE = '00000000-0000-4000-8000-0000000000b9'
  const PURCHASE_ENTRY = '00000000-0000-4000-8000-0000000000c9'
  const SALE = ORDER
  const SALE_ENTRY = '00000000-0000-4000-8000-0000000000c8'

  interface MovementView {
    movementId: string
    invoiceId: string | null
    amountMinor: number
    paymentId: string
    journalEntryId: string | null
  }

  function pullAdvance(id = ADVANCE, supplierId: string | null = SUPPLIER): void {
    const rows = [
      {
        id,
        workspace_id: TEST_WORKSPACE_ID,
        order_id: id,
        customer_id: null,
        supplier_id: supplierId,
        source_type: 'pre_purchase',
        amount_minor: 500_000,
        payment_method: 'cash',
        applied_invoice_id: null,
        currency: 'AFN',
        posting_status: 'posted',
        created_at: '2026-11-04T08:00:00.000Z',
        updated_at: '2026-11-04T08:00:00.000Z',
        origin: 'server',
        sync_state: 'synced',
      },
    ]
    for (const statement of buildUpserts('order_deposits', rows)) {
      db.run(statement.sql, statement.params)
    }
  }

  /** A purchase invoice the device already booked, and the sale it must not take. */
  function seedPostedInvoices(): void {
    db.run(
      `INSERT INTO invoice (id, workspace_id, invoice_number, type, supplier_id, date, total,
                            paid_amount, currency, status, updated_at)
       VALUES (?, ?, 'PUR-1', 'purchase', ?, '2026-11-01', 400_000, 0, 'AFN', 'pending',
               datetime('now'))`,
      [PURCHASE, TEST_WORKSPACE_ID, SUPPLIER],
    )
    db.run(
      `INSERT INTO journal_entry (id, workspace_id, entry_number, date, description, reference,
                                  status, source_type, source_id, posted_at, created_at, updated_at)
       VALUES (?, ?, 'J-PURCHASE', '2026-11-01', 'purchase', 'PUR-1', 'posted',
               'invoice', ?, datetime('now'), datetime('now'), datetime('now'))`,
      [PURCHASE_ENTRY, TEST_WORKSPACE_ID, PURCHASE],
    )
    db.run(
      `INSERT INTO invoice (id, workspace_id, invoice_number, type, customer_id, date, total,
                            paid_amount, currency, status, updated_at)
       VALUES (?, ?, 'INV-1', 'sale', ?, '2026-11-01', 100_000, 0, 'AFN', 'pending',
               datetime('now'))`,
      [SALE, TEST_WORKSPACE_ID, CUSTOMER],
    )
    db.run(
      `INSERT INTO journal_entry (id, workspace_id, entry_number, date, description, reference,
                                  status, source_type, source_id, posted_at, created_at, updated_at)
       VALUES (?, ?, 'J-SALE', '2026-11-01', 'sale', 'INV-1', 'posted',
               'invoice', ?, datetime('now'), datetime('now'), datetime('now'))`,
      [SALE_ENTRY, TEST_WORKSPACE_ID, SALE],
    )
  }

  const ledgerOf = (sourceId: string) =>
    Object.fromEntries(
      db
        .all<{ role: string; debit: number; credit: number }>(
          `SELECT a.role AS role, l.debit AS debit, l.credit AS credit
             FROM journal_line l
             JOIN journal_entry je ON je.id = l.journal_id
             JOIN account a ON a.id = l.account_id
            WHERE je.workspace_id = ? AND je.source_type = 'payment' AND je.source_id = ?`,
          [TEST_WORKSPACE_ID, sourceId],
        )
        .map((line) => [line.role, { debit: line.debit, credit: line.credit }]),
    )

  const apply = (depositId: string, invoiceId: string, key: string) =>
    engine.request<MovementView & { code?: string }>({
      method: 'POST',
      path: `/orders/${depositId}/deposits/${depositId}/apply`,
      body: { invoiceId, amountMinor: 100_000, idempotencyKey: key },
    })

  const refund = (depositId: string, key: string) =>
    engine.request<MovementView & { code?: string }>({
      method: 'POST',
      path: `/orders/${depositId}/deposits/${depositId}/refund`,
      body: { amountMinor: 50_000, reason: 'supplier returned the money', idempotencyKey: key },
    })

  it('keeps its kind and its supplier instead of becoming a customer deposit', async () => {
    pullAdvance()

    const stored = db.get<{
      source_type: string
      supplier_id: string | null
      customer_id: string | null
    }>('SELECT source_type, supplier_id, customer_id FROM order_deposits WHERE id = ?', [ADVANCE])
    expect(stored).toEqual({
      source_type: 'pre_purchase',
      supplier_id: SUPPLIER,
      customer_id: null,
    })

    // It has no customer, so it must not appear under any customer's advances.
    const deposits = await viewOf()
    expect(deposits.some((deposit) => deposit.id === ADVANCE)).toBe(false)
  })

  it('settles a purchase invoice: Dr payable / Cr supplier advances, money OUT', async () => {
    pullAdvance()
    seedPostedInvoices()

    const res = await apply(ADVANCE, PURCHASE, 'advance-apply-0001')
    expect(res.status).toBe(201)
    expect(res.data.invoiceId).toBe(PURCHASE)
    expect(ledgerOf(res.data.paymentId)).toEqual({
      payable: { debit: 100_000, credit: 0 },
      supplier_advances: { debit: 0, credit: 100_000 },
    })

    const payment = db.get<{
      direction: string
      party_type: string
      party_id: string
      method: string
    }>('SELECT direction, party_type, party_id, method FROM payment WHERE id = ?', [
      res.data.paymentId,
    ])
    expect(payment).toEqual({
      direction: 'out',
      party_type: 'supplier',
      party_id: SUPPLIER,
      method: 'supplier_advance',
    })

    const invoice = db.get<{ paid_amount: number }>(
      'SELECT paid_amount FROM invoice WHERE id = ?',
      [PURCHASE],
    )
    expect(invoice?.paid_amount).toBe(100_000)
  })

  it('refuses a customer invoice: a supplier advance never settles a sale', async () => {
    pullAdvance()
    seedPostedInvoices()

    const res = await apply(ADVANCE, SALE, 'advance-apply-0002')
    expect(res.status).toBe(400)
    expect(res.data.code).toBe('ADVANCE_INVOICE_NOT_PURCHASE')

    // Nothing was written: no payment, no application.
    expect(db.get<{ n: number }>('SELECT count(*) AS n FROM order_deposit_applications')?.n).toBe(0)
  })

  it('refunds back IN: Dr cash / Cr supplier advances and a supplier receipt', async () => {
    pullAdvance()

    const res = await refund(ADVANCE, 'advance-refund-0001')
    expect(res.status).toBe(201)
    expect(ledgerOf(res.data.paymentId)).toEqual({
      cash: { debit: 50_000, credit: 0 },
      supplier_advances: { debit: 0, credit: 50_000 },
    })

    const payment = db.get<{ direction: string; party_type: string; party_id: string }>(
      'SELECT direction, party_type, party_id FROM payment WHERE id = ?',
      [res.data.paymentId],
    )
    expect(payment).toEqual({ direction: 'in', party_type: 'supplier', party_id: SUPPLIER })
  })

  it('refuses to move an advance whose party could not be resolved', async () => {
    pullAdvance(UNRESOLVED, null)
    seedPostedInvoices()

    const applied = await apply(UNRESOLVED, PURCHASE, 'advance-apply-0003')
    expect(applied.status).toBe(400)
    expect(applied.data.code).toBe('ADVANCE_PARTY_UNKNOWN')

    const refunded = await refund(UNRESOLVED, 'advance-refund-0002')
    expect(refunded.status).toBe(400)
    expect(refunded.data.code).toBe('ADVANCE_PARTY_UNKNOWN')
  })
})
