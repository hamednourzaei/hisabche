// ============================================
// packages/local-engine/src/__tests__/order-deposit-restart.test.ts
//
// The app was closed while a refund was still waiting to reach the server.
//
// A helper-level unit test cannot answer the question the owner asked: does the
// write survive a REAL process end? So this test uses a database file on disk,
// makes the move, CLOSES the database handle (the same thing the app does when
// it quits — and a closed handle throws if anything still tries to read), then
// reopens the file in a new engine and asks it what is pending.
//
// What must survive:
//   • the movement row and the money it took out of the deposit,
//   • the outbox row — same `client_id`, same intent key, still `pending`,
//   • the receipt and its ledger entry (nothing is re-booked by reopening),
// and what must NOT happen:
//   • a second payment or a second journal entry on the replay.
// ============================================

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { LocalDb } from '../db'
import { createLocalEngine } from '../index'
import { createTestDb, reopenTestDb, TEST_USER_ID, TEST_WORKSPACE_ID } from './test-db'

const CUSTOMER = '00000000-0000-4000-8000-000000000001'
const ORDER = '00000000-0000-4000-8000-0000000000a1'
const INVOICE = '00000000-0000-4000-8000-0000000000b1'
const INVOICE_ENTRY = '00000000-0000-4000-8000-0000000000c1'
const QUEUE = { 'x-hisabche-queue': '1' }

interface DepositView {
  id: string
  amountMinor: number
  refundedMinor: number
  remainingMinor: number
  status: string
  pendingSync: boolean
}

interface MovementView {
  replayed: boolean
  movementId: string
  amountMinor: number
  paymentId: string
  journalEntryId: string | null
}

interface QueueRow {
  client_id: string
  entity: string
  operation: string
  payload: string
  status: string
  attempts: number
  created_at: string
  workspace_id: string
}

const directories: string[] = []

function tempDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), 'hisabche-deposit-restart-'))
  directories.push(directory)
  return join(directory, 'local.sqlite')
}

function engineOver(db: LocalDb) {
  const engine = createLocalEngine(db)
  return {
    request: <T>(req: Parameters<typeof engine.request>[0]) =>
      engine.request<T>({
        ...req,
        headers: { 'x-user-id': TEST_USER_ID, ...req.headers },
      }),
  }
}

function seedInvoice(db: LocalDb) {
  db.run(
    `INSERT INTO customer (id, workspace_id, full_name, is_active, created_at, updated_at)
     VALUES (?, ?, 'احمد هروی', 1, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')`,
    [CUSTOMER, TEST_WORKSPACE_ID],
  )
  db.run(
    `INSERT INTO invoice (id, workspace_id, invoice_number, type, customer_id, date, total,
                          paid_amount, currency, status, updated_at)
     VALUES (?, ?, 'INV-1', 'sale', ?, '2026-10-01', 100000, 0, 'AFN', 'pending', datetime('now'))`,
    [INVOICE, TEST_WORKSPACE_ID, CUSTOMER],
  )
  db.run(
    `INSERT INTO journal_entry (id, workspace_id, entry_number, date, description, reference,
                                status, source_type, source_id, posted_at, created_at, updated_at)
     VALUES (?, ?, 'J-2026-INVOICE', '2026-10-01', 'sale', 'INV-1', 'posted',
             'invoice', ?, datetime('now'), datetime('now'), datetime('now'))`,
    [INVOICE_ENTRY, TEST_WORKSPACE_ID, INVOICE],
  )
}

const count = (db: LocalDb, sql: string, params: unknown[] = []) =>
  db.all<{ n: number }>(sql, params)[0]!.n

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('a refund that was still pending when the app was closed', () => {
  it('is still pending, with its own intent key, when the app is opened again', async () => {
    const path = tempDatabasePath()

    // ── First launch ──────────────────────────────────────────────────────
    const first = createTestDb(path)
    seedInvoice(first)
    const firstEngine = engineOver(first)

    const taken = await firstEngine.request<DepositView>({
      method: 'POST',
      path: `/orders/${ORDER}/deposits`,
      headers: QUEUE,
      body: { customerId: CUSTOMER, amountMinor: 100_000, paymentMethod: 'cash' },
    })
    expect(taken.status).toBe(201)
    const deposit = taken.data

    const refunded = await firstEngine.request<MovementView>({
      method: 'POST',
      path: `/orders/${ORDER}/deposits/${deposit.id}/refund`,
      headers: QUEUE,
      body: {
        amountMinor: 30_000,
        reason: 'انصراف مشتری از سفارش',
        method: 'cash',
        idempotencyKey: 'intent-refund-restart-1',
        date: '2026-11-03',
      },
    })
    expect(refunded.status).toBe(201)
    const movement = refunded.data

    const pendingBefore = first.all<QueueRow>(
      "SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC",
    )
    const refundQueueRow = pendingBefore.find((row) => row.client_id === movement.movementId)
    expect(refundQueueRow).toBeDefined()
    expect(JSON.parse(refundQueueRow!.payload)).toMatchObject({
      movement: 'refund',
      amountMinor: 30_000,
      idempotencyKey: 'intent-refund-restart-1',
    })

    const paymentsBefore = count(
      first,
      'SELECT count(*) AS n FROM payment WHERE workspace_id = ?',
      [TEST_WORKSPACE_ID],
    )
    const entriesBefore = count(
      first,
      'SELECT count(*) AS n FROM journal_entry WHERE workspace_id = ?',
      [TEST_WORKSPACE_ID],
    )
    expect(paymentsBefore).toBe(1)
    expect(entriesBefore).toBe(3)

    // ── The app quits: the handle is closed, not merely left unused ────────
    first.close()
    expect(() => first.get('SELECT 1')).toThrow()

    // ── Second launch: a NEW engine over the same file ─────────────────────
    const second = reopenTestDb(path)
    const secondEngine = engineOver(second)

    const listed = await secondEngine.request<DepositView[]>({
      method: 'GET',
      path: `/customers/${CUSTOMER}/deposits`,
    })
    expect(listed.status).toBe(200)
    expect(listed.data).toHaveLength(1)
    expect(listed.data[0]).toMatchObject({
      id: deposit.id,
      amountMinor: 100_000,
      refundedMinor: 30_000,
      remainingMinor: 70_000,
      status: 'partially_used',
      // Still waiting: the reopen did not pretend it had synced.
      pendingSync: true,
    })

    // The outbox row survived with its identity — same client id, same key,
    // still pending, and it was not re-created by the reopen.
    const pendingAfter = second.all<QueueRow>(
      "SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC",
    )
    const survived = pendingAfter.find((row) => row.client_id === movement.movementId)
    expect(survived).toBeDefined()
    expect(survived!.created_at).toBe(refundQueueRow!.created_at)
    expect(survived!.attempts).toBe(0)
    expect(JSON.parse(survived!.payload)).toMatchObject({
      idempotencyKey: 'intent-refund-restart-1',
      depositId: deposit.id,
    })

    // Nothing was re-booked by reopening: the refund's payment and entry are
    // the same rows, not new ones.
    expect(
      count(second, 'SELECT count(*) AS n FROM payment WHERE workspace_id = ?', [
        TEST_WORKSPACE_ID,
      ]),
    ).toBe(paymentsBefore)
    expect(
      count(second, 'SELECT count(*) AS n FROM journal_entry WHERE workspace_id = ?', [
        TEST_WORKSPACE_ID,
      ]),
    ).toBe(entriesBefore)

    // ── Reconnect: the retry carries the ORIGINAL key ──────────────────────
    const retryBody = JSON.parse(survived!.payload) as Record<string, unknown>
    const replay = await secondEngine.request<MovementView>({
      method: 'POST',
      path: `/orders/${ORDER}/deposits/${deposit.id}/refund`,
      headers: QUEUE,
      body: {
        amountMinor: retryBody.amountMinor,
        reason: retryBody.reason,
        method: retryBody.method,
        idempotencyKey: retryBody.idempotencyKey,
        date: retryBody.date,
      },
    })

    expect(replay.status).toBe(200)
    expect(replay.data).toMatchObject({
      replayed: true,
      movementId: movement.movementId,
      amountMinor: 30_000,
      // Same payment, same ledger entry: the move happened once.
      paymentId: movement.paymentId,
      journalEntryId: movement.journalEntryId,
    })
    expect(
      count(second, 'SELECT count(*) AS n FROM payment WHERE workspace_id = ?', [
        TEST_WORKSPACE_ID,
      ]),
    ).toBe(paymentsBefore)
    expect(
      count(second, 'SELECT count(*) AS n FROM journal_entry WHERE workspace_id = ?', [
        TEST_WORKSPACE_ID,
      ]),
    ).toBe(entriesBefore)
    expect(
      count(second, 'SELECT count(*) AS n FROM order_deposit_refunds WHERE workspace_id = ?', [
        TEST_WORKSPACE_ID,
      ]),
    ).toBe(1)

    second.close()
  })

  it('a rejection that arrived before the restart stays visible after it', async () => {
    const path = tempDatabasePath()

    const first = createTestDb(path)
    seedInvoice(first)
    const firstEngine = engineOver(first)

    const taken = await firstEngine.request<DepositView>({
      method: 'POST',
      path: `/orders/${ORDER}/deposits`,
      headers: QUEUE,
      body: { customerId: CUSTOMER, amountMinor: 50_000, paymentMethod: 'cash' },
    })
    const deposit = taken.data

    // Over the balance: the device refuses and writes nothing.
    const refused = await firstEngine.request<MovementView>({
      method: 'POST',
      path: `/orders/${ORDER}/deposits/${deposit.id}/refund`,
      headers: QUEUE,
      body: {
        amountMinor: 80_000,
        reason: 'بازگشت بیش از مانده',
        method: 'cash',
        idempotencyKey: 'intent-refund-too-much',
      },
    })
    expect(refused.status).toBe(409)

    first.close()

    const second = reopenTestDb(path)
    const secondEngine = engineOver(second)

    // The refused attempt left no movement and no outbox row behind…
    expect(
      count(second, 'SELECT count(*) AS n FROM order_deposit_refunds WHERE workspace_id = ?', [
        TEST_WORKSPACE_ID,
      ]),
    ).toBe(0)
    const pending = second.all<QueueRow>("SELECT * FROM sync_queue WHERE status = 'pending'")
    expect(pending.map((row) => row.client_id)).toEqual([deposit.id])

    // …and the deposit is still whole, so the next launch offers the right
    // balance rather than a phantom refund.
    const listed = await secondEngine.request<DepositView[]>({
      method: 'GET',
      path: `/customers/${CUSTOMER}/deposits`,
    })
    expect(listed.data[0]).toMatchObject({
      amountMinor: 50_000,
      refundedMinor: 0,
      remainingMinor: 50_000,
    })

    second.close()
  })
})
