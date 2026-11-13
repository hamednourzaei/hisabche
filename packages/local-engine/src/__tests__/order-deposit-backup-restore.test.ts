// ============================================
// packages/local-engine/src/__tests__/order-deposit-backup-restore.test.ts
//
// A backup that drops the deposit movements is a backup that lies: the receipt
// comes back after a restore, but nothing remembers that 40 000 of it was spent
// and 10 000 given back — so the shop would offer the whole 100 000 again.
//
// This file proves the three things the owner asked for:
//
//   1. `GET /workspaces/backup` carries the receipt, BOTH movements and the
//      outbox rows (the intent keys live there),
//   2. a fresh database restored from that dump answers the customer screen
//      with the same received / applied / refunded / remaining figures,
//   3. replaying the same intent key on the restored database is a replay:
//      no second payment, no second ledger entry, no second movement.
//
// ⚠️ THERE IS NO RESTORE ENDPOINT (`meta.restorable: false`). The restore is
// the dump re-imported — that is what a real restore does — so this test does
// the import itself, table by table, exactly as the host would.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'

import type { LocalDb } from '../db'
import { createTestDb, createTestEngine, TEST_WORKSPACE_ID } from './test-db'

const CUSTOMER = '00000000-0000-4000-8000-000000000001'
const ORDER = '00000000-0000-4000-8000-0000000000a1'
const INVOICE = '00000000-0000-4000-8000-0000000000b1'
const INVOICE_ENTRY = '00000000-0000-4000-8000-0000000000c1'
const QUEUE = { 'x-hisabche-queue': '1' }

interface DepositView {
  id: string
  amountMinor: number
  appliedMinor: number
  refundedMinor: number
  remainingMinor: number
  currency: string | null
  status: string
  pendingSync: boolean
}

interface MovementView {
  replayed: boolean
  movementId: string
  amountMinor: number
  journalEntryId: string | null
  paymentId: string
}

type Dump = Record<string, unknown> & {
  meta: { totalRows: number; restorable: boolean }
}

let db: LocalDb
let engine: ReturnType<typeof createTestEngine>

function seedPostedInvoice(total: number) {
  db.run(
    `INSERT INTO invoice (id, workspace_id, invoice_number, type, customer_id, date, total,
                          paid_amount, currency, status, updated_at)
     VALUES (?, ?, 'INV-1', 'sale', ?, '2026-10-01', ?, 0, 'AFN', 'pending', datetime('now'))`,
    [INVOICE, TEST_WORKSPACE_ID, CUSTOMER, total],
  )
  db.run(
    `INSERT INTO journal_entry (id, workspace_id, entry_number, date, description, reference,
                                status, source_type, source_id, posted_at, created_at, updated_at)
     VALUES (?, ?, 'J-2026-INVOICE', '2026-10-01', 'sale', 'INV-1', 'posted',
             'invoice', ?, datetime('now'), datetime('now'), datetime('now'))`,
    [INVOICE_ENTRY, TEST_WORKSPACE_ID, INVOICE],
  )
}

/**
 * Re-import a dump into an empty database.
 *
 * Only the columns the target schema knows are written, which is what makes a
 * dump from an older device importable — and it is why a table missing from
 * `localTableSchema` would simply never be restored.
 */
function restoreInto(target: LocalDb, dump: Dump): void {
  const existing = new Set(
    target
      .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'")
      .map((row) => row.name),
  )

  for (const [table, value] of Object.entries(dump)) {
    if (!Array.isArray(value) || !existing.has(table)) continue
    const columns = new Set(
      target.all<{ name: string }>(`PRAGMA table_info("${table}")`).map((row) => row.name),
    )
    for (const row of value as Array<Record<string, unknown>>) {
      const keys = Object.keys(row).filter((key) => columns.has(key))
      // `sync_queue` is keyed by `client_id`, not `id`: skipping it would lose
      // the very rows that re-send the original intent keys after a restore.
      if (keys.length === 0 || !keys.includes('id')) {
        if (!columns.has('client_id') || !keys.includes('client_id')) continue
      }
      target.run(
        `INSERT OR REPLACE INTO "${table}" (${keys.map((key) => `"${key}"`).join(', ')})
         VALUES (${keys.map(() => '?').join(', ')})`,
        keys.map((key) => {
          const cell = row[key]
          return cell === undefined || cell === null
            ? null
            : typeof cell === 'object'
              ? JSON.stringify(cell)
              : (cell as string | number)
        }),
      )
    }
  }
}

function count(sql: string, params: unknown[] = []): number {
  return db.all<{ n: number }>(sql, params)[0]!.n
}

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
  db.run(
    `INSERT INTO customer (id, workspace_id, full_name, is_active, created_at, updated_at)
     VALUES (?, ?, 'احمد هروی', 1, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')`,
    [CUSTOMER, TEST_WORKSPACE_ID],
  )
  seedPostedInvoice(100_000)
})

async function depositAndSpend() {
  const taken = await engine.request<DepositView>({
    method: 'POST',
    path: `/orders/${ORDER}/deposits`,
    headers: QUEUE,
    body: { customerId: CUSTOMER, amountMinor: 100_000, paymentMethod: 'cash' },
  })
  expect(taken.status).toBe(201)
  const deposit = taken.data

  const applied = await engine.request<MovementView>({
    method: 'POST',
    path: `/orders/${ORDER}/deposits/${deposit.id}/apply`,
    headers: QUEUE,
    body: {
      invoiceId: INVOICE,
      amountMinor: 40_000,
      idempotencyKey: 'intent-apply-0001',
      date: '2026-11-03',
    },
  })
  expect(applied.status).toBe(201)

  const refunded = await engine.request<MovementView>({
    method: 'POST',
    path: `/orders/${ORDER}/deposits/${deposit.id}/refund`,
    headers: QUEUE,
    body: {
      amountMinor: 10_000,
      reason: 'بازگشت بخشی از بیعانه',
      method: 'cash',
      idempotencyKey: 'intent-refund-0001',
      date: '2026-11-03',
    },
  })
  expect(refunded.status).toBe(201)

  return { deposit, applied: applied.data, refunded: refunded.data }
}

describe('the backup carries the deposit and everything spent from it', () => {
  it('exports the receipt, both movements and their intent keys', async () => {
    const { deposit } = await depositAndSpend()

    const backup = await engine.request<Dump>({ method: 'GET', path: '/workspaces/backup' })
    expect(backup.status).toBe(200)
    const dump = backup.data

    // The three tables are in the dump, not skipped as unknown.
    expect(dump.meta).toMatchObject({ restorable: false })
    const deposits = dump.order_deposits as Array<Record<string, unknown>>
    const applications = dump.order_deposit_applications as Array<Record<string, unknown>>
    const refunds = dump.order_deposit_refunds as Array<Record<string, unknown>>

    expect(deposits).toHaveLength(1)
    expect(deposits[0]).toMatchObject({ id: deposit.id, amount_minor: 100_000, currency: 'AFN' })

    expect(applications).toHaveLength(1)
    expect(applications[0]).toMatchObject({
      amount_minor: 40_000,
      idempotency_key: 'intent-apply-0001',
    })
    expect(refunds).toHaveLength(1)
    expect(refunds[0]).toMatchObject({
      amount_minor: 10_000,
      idempotency_key: 'intent-refund-0001',
      reason: 'بازگشت بخشی از بیعانه',
    })

    // The outbox travels too: it is what re-sends the original intent key after
    // a restore instead of a fresh one.
    const queue = dump.sync_queue as Array<Record<string, unknown>>
    expect(queue).toHaveLength(3)
    expect(queue.map((row) => row.client_id)).toEqual([
      deposit.id,
      applications[0]!.id,
      refunds[0]!.id,
    ])
    expect(
      queue.every((row) => row.workspace_id === TEST_WORKSPACE_ID && row.status === 'pending'),
    ).toBe(true)
  })
})

describe('a restore keeps the figures a person decides on', () => {
  it('answers 100 000 / 40 000 / 10 000 / 50 000 on a database rebuilt from the dump', async () => {
    const { deposit } = await depositAndSpend()

    const backup = await engine.request<Dump>({ method: 'GET', path: '/workspaces/backup' })
    const restored = createTestDb()
    restoreInto(restored, backup.data)
    const restoredEngine = createTestEngine(restored)

    const listed = await restoredEngine.request<DepositView[]>({
      method: 'GET',
      path: `/customers/${CUSTOMER}/deposits`,
    })
    expect(listed.status).toBe(200)

    expect(listed.data).toHaveLength(1)
    expect(listed.data[0]).toMatchObject({
      id: deposit.id,
      amountMinor: 100_000,
      appliedMinor: 40_000,
      refundedMinor: 10_000,
      remainingMinor: 50_000,
      currency: 'AFN',
      status: 'partially_used',
      // The restored outbox still holds the moves: nothing is «done» merely
      // because the database was rebuilt.
      pendingSync: true,
    })
  })

  it('replaying a movement on the restored database writes nothing a second time', async () => {
    const { deposit, applied, refunded } = await depositAndSpend()

    const paymentsBefore = count('SELECT count(*) AS n FROM payment WHERE workspace_id = ?', [
      TEST_WORKSPACE_ID,
    ])
    const entriesBefore = count('SELECT count(*) AS n FROM journal_entry WHERE workspace_id = ?', [
      TEST_WORKSPACE_ID,
    ])

    const backup = await engine.request<Dump>({ method: 'GET', path: '/workspaces/backup' })
    const restored = createTestDb()
    restoreInto(restored, backup.data)
    const restoredEngine = createTestEngine(restored)

    const replayApply = await restoredEngine.request<MovementView>({
      method: 'POST',
      path: `/orders/${ORDER}/deposits/${deposit.id}/apply`,
      headers: QUEUE,
      body: {
        invoiceId: INVOICE,
        amountMinor: 40_000,
        idempotencyKey: 'intent-apply-0001',
        date: '2026-11-03',
      },
    })
    expect(replayApply.status).toBe(200)
    expect(replayApply.data).toMatchObject({
      replayed: true,
      movementId: applied.movementId,
      amountMinor: 40_000,
    })

    const replayRefund = await restoredEngine.request<MovementView>({
      method: 'POST',
      path: `/orders/${ORDER}/deposits/${deposit.id}/refund`,
      headers: QUEUE,
      body: {
        amountMinor: 10_000,
        reason: 'بازگشت بخشی از بیعانه',
        method: 'cash',
        idempotencyKey: 'intent-refund-0001',
        date: '2026-11-03',
      },
    })
    expect(replayRefund.status).toBe(200)
    expect(replayRefund.data).toMatchObject({
      replayed: true,
      movementId: refunded.movementId,
      amountMinor: 10_000,
    })

    const paymentCount = (target: LocalDb) =>
      target.all<{ n: number }>('SELECT count(*) AS n FROM payment WHERE workspace_id = ?', [
        TEST_WORKSPACE_ID,
      ])[0]!.n
    const entryCount = (target: LocalDb) =>
      target.all<{ n: number }>('SELECT count(*) AS n FROM journal_entry WHERE workspace_id = ?', [
        TEST_WORKSPACE_ID,
      ])[0]!.n
    const movementCount = (target: LocalDb) =>
      target.all<{ n: number }>(
        `SELECT (SELECT count(*) FROM order_deposit_applications WHERE workspace_id = ?)
              + (SELECT count(*) FROM order_deposit_refunds WHERE workspace_id = ?) AS n`,
        [TEST_WORKSPACE_ID, TEST_WORKSPACE_ID],
      )[0]!.n

    // Two moves, two payments and two movement entries existed before the
    // backup; four ledger entries: the invoice, the receipt, the apply, the
    // refund. A replay must not add another of any of them.
    expect(paymentsBefore).toBe(2)
    expect(entriesBefore).toBe(4)
    expect(paymentCount(restored)).toBe(2)
    expect(entryCount(restored)).toBe(4)
    expect(movementCount(restored)).toBe(2)

    // The stack the moves were made against is unchanged: no duplicate journal.
    expect(entryCount(restored)).toBe(entriesBefore)

    const balance = await restoredEngine.request<DepositView[]>({
      method: 'GET',
      path: `/customers/${CUSTOMER}/deposits`,
    })
    expect(balance.data[0]).toMatchObject({
      appliedMinor: 40_000,
      refundedMinor: 10_000,
      remainingMinor: 50_000,
    })
  })
})
