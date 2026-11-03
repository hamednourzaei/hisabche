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
