// ============================================
// packages/local-engine/src/__tests__/service-delivery-integrity.test.ts
//
// M4 audit - what the device does with money-shaped facts around a service session.
//
//   · settlement is chosen: no credit / no package / no invoice / no reason => REFUSED, nothing written
//   · session + credit entry are ONE transaction (a failed ledger write leaves the session as it was)
//   · ONE outbox command per action, with its own client id, carrying the whole intent - the create command is never
//     overwritten by the deliver command (they used to share the session id as the outbox key)
//   · a retry is a replay: one consume, one reversal
//   · a delivered session is not reversed by a status flip
//   · a stale view cannot deliver
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import type { LocalDb } from '../db'
import { createTestDb, createTestEngine, TEST_USER_ID, TEST_WORKSPACE_ID } from './test-db'

const ws = TEST_WORKSPACE_ID
const CUST = '44444444-4444-4444-8444-444444444444'
const OTHER_CUST = '44444444-4444-4444-8444-444444444455'
const SERVICE = '55555555-5555-4555-8555-555555555555'
const PACKAGE = '66666666-6666-4666-8666-666666666666'
const INVOICE = '88888888-8888-4888-8888-888888888888'
const OTHER_INVOICE = '88888888-8888-4888-8888-888888888899'

const headers = {
  'x-workspace-id': ws,
  'x-user-id': TEST_USER_ID,
  'x-user-role': 'owner',
  'x-hisabche-queue': '1',
}

let db: LocalDb
let engine: ReturnType<typeof createTestEngine>

interface SessionView {
  id: string
  status: string
  settlementMethod: string
  packageCreditId?: string | null
  invoiceId?: string | null
  settlementReason?: string | null
  updatedAt: string
}

const count = (sql: string, params: unknown[] = []) =>
  db.all<{ n: number }>(`SELECT COUNT(*) AS n ${sql}`, params)[0]!.n

function grant(quantity: number) {
  db.run(
    `INSERT INTO package_credit_ledger (id, workspace_id, customer_id, package_product_id, entry_type, quantity,
       effective_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'GRANT', ?, '2026-10-01', '2026-10-01', '2026-10-01')`,
    [`grant-${quantity}`, ws, CUST, PACKAGE, quantity],
  )
}

function seedInvoice(id: string, customerId: string) {
  db.run(
    `INSERT INTO invoice (id, workspace_id, invoice_number, type, customer_id, date, total, currency, status, updated_at)
     VALUES (?, ?, ?, 'sale', ?, '2026-11-01', 1500, 'AFN', 'pending', datetime('now'))`,
    [id, ws, `INV-${id.slice(-2)}`, customerId],
  )
}

async function schedule(): Promise<SessionView> {
  const res = await engine.request<SessionView>({
    method: 'POST',
    path: '/service-delivery/sessions',
    headers,
    body: {
      workspaceId: ws,
      customerId: CUST,
      serviceOfferingId: SERVICE,
      sessionDate: '2026-11-02',
      startTime: '10:00',
      endTime: '11:00',
      settlementMethod: 'package_credit',
    },
  })
  expect(res.status, JSON.stringify(res.data)).toBe(201)
  return res.data
}

const deliver = (id: string, body: Record<string, unknown> = {}) =>
  engine.request<{ code?: string; message?: string; session?: SessionView }>({
    method: 'POST',
    path: `/service-delivery/sessions/${id}/deliver`,
    headers,
    body,
  })

const cancel = (id: string, reason: string | null = 'customer asked') =>
  engine.request<{ code?: string; session?: SessionView; reversalEntry?: unknown }>({
    method: 'POST',
    path: `/service-delivery/sessions/${id}/cancel`,
    headers,
    body: reason === null ? {} : { reason },
  })

const statusOf = (id: string) =>
  db.all<{ status: string }>('SELECT status FROM service_delivery_sessions WHERE id = ?', [id])[0]!
    .status

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
  for (const [id, name] of [
    [CUST, 'Zahra'],
    [OTHER_CUST, 'Other'],
  ] as const) {
    db.run(
      `INSERT OR REPLACE INTO customer (id, workspace_id, full_name, created_at, updated_at)
       VALUES (?, ?, ?, '2026-11-01', '2026-11-01')`,
      [id, ws, name],
    )
  }
  for (const [id, type] of [
    [SERVICE, 'service'],
    [PACKAGE, 'package'],
  ] as const) {
    db.run(
      `INSERT OR REPLACE INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, offering_type, updated_at)
       VALUES (?, ?, 'x', 0, 1000, 0, 1, ?, '2026-11-01')`,
      [id, ws, type],
    )
  }
})

describe('settlement is chosen - and refused whole when it cannot be honoured', () => {
  it('package_credit with no credit: 409, the session stays scheduled, nothing is written or queued', async () => {
    const session = await schedule()
    const queued = count('FROM sync_queue')

    const res = await deliver(session.id, { packageProductId: PACKAGE })
    expect(res.status).toBe(409)
    expect(JSON.stringify(res.data)).toContain('INSUFFICIENT_PACKAGE_CREDIT')
    expect(statusOf(session.id)).toBe('scheduled')
    expect(count("FROM package_credit_ledger WHERE entry_type = 'CONSUME'")).toBe(0)
    expect(count('FROM sync_queue')).toBe(queued)
  })

  it('package_credit with no package named: 400, never an invoice', async () => {
    grant(5)
    const session = await schedule()
    const res = await deliver(session.id, {})
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('SETTLEMENT_PACKAGE_REQUIRED')
    expect(statusOf(session.id)).toBe('scheduled')
  })

  it('invoice needs an existing invoice of the SAME customer, and links it', async () => {
    seedInvoice(INVOICE, CUST)
    seedInvoice(OTHER_INVOICE, OTHER_CUST)
    const session = await schedule()

    expect((await deliver(session.id, { settlementMethod: 'invoice' })).status).toBe(400)
    const wrong = await deliver(session.id, {
      settlementMethod: 'invoice',
      invoiceId: OTHER_INVOICE,
    })
    expect(wrong.status).toBe(400)
    expect(JSON.stringify(wrong.data)).toContain('SETTLEMENT_INVOICE_INVALID')
    expect(statusOf(session.id)).toBe('scheduled')

    const ok = await deliver(session.id, { settlementMethod: 'invoice', invoiceId: INVOICE })
    expect(ok.status, JSON.stringify(ok.data)).toBe(200)
    expect(ok.data.session).toMatchObject({
      status: 'delivered',
      settlementMethod: 'invoice',
      invoiceId: INVOICE,
    })
    expect(count('FROM package_credit_ledger')).toBe(0)
  })

  it('complementary needs a reason and keeps it', async () => {
    const session = await schedule()
    expect((await deliver(session.id, { settlementMethod: 'complementary' })).status).toBe(400)
    expect(
      (await deliver(session.id, { settlementMethod: 'complementary', reason: '  ' })).status,
    ).toBe(400)
    const ok = await deliver(session.id, { settlementMethod: 'complementary', reason: 'goodwill' })
    expect(ok.status, JSON.stringify(ok.data)).toBe(200)
    expect(
      db.all<{ settlement_reason: string }>(
        'SELECT settlement_reason FROM service_delivery_sessions WHERE id = ?',
        [session.id],
      )[0]!.settlement_reason,
    ).toBe('goodwill')
  })
})

describe('one transaction', () => {
  it('a ledger write that fails leaves the session exactly as it was', async () => {
    grant(5)
    const session = await schedule()
    // a consume for this session already exists under another id/key (e.g. written by another path): the ledger refuses a second
    db.run(
      `INSERT INTO package_credit_ledger (id, workspace_id, customer_id, package_product_id, entry_type, quantity,
         source_document_type, source_document_id, idempotency_key, effective_date)
       VALUES ('other-consume', ?, ?, ?, 'CONSUME', 1, 'service_delivery', ?, 'something-else', '2026-11-02')`,
      [ws, CUST, PACKAGE, session.id],
    )
    const before = db.all<{ updated_at: string }>(
      'SELECT updated_at FROM service_delivery_sessions WHERE id = ?',
      [session.id],
    )[0]!
    const queued = count('FROM sync_queue')

    const res = await deliver(session.id, { packageProductId: PACKAGE })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(statusOf(session.id)).toBe('scheduled')
    expect(
      db.all<{ updated_at: string }>(
        'SELECT updated_at FROM service_delivery_sessions WHERE id = ?',
        [session.id],
      )[0]!.updated_at,
    ).toBe(before.updated_at)
    expect(count('FROM sync_queue')).toBe(queued)
  })
})

describe('the outbox', () => {
  it('create and deliver are two commands with their own keys - neither overwrites the other', async () => {
    grant(5)
    const session = await schedule()
    expect((await deliver(session.id, { packageProductId: PACKAGE })).status).toBe(200)

    const rows = db.all<{ client_id: string; entity: string; payload: string }>(
      'SELECT client_id, entity, payload FROM sync_queue ORDER BY created_at, rowid',
    )
    expect(rows.map((row) => row.client_id)).toEqual([session.id, `${session.id}-deliver`])
    expect(rows.every((row) => row.entity === 'service_delivery_sessions')).toBe(true)
  })

  it('the deliver command carries the whole intent, in the shape the server reads, and the ledger rides with it (no second command)', async () => {
    grant(5)
    const session = await schedule()
    await deliver(session.id, { packageProductId: PACKAGE, quantity: 1 })

    expect(count("FROM sync_queue WHERE entity = 'package_credit_ledger'")).toBe(0)
    const payload = JSON.parse(
      db.all<{ payload: string }>('SELECT payload FROM sync_queue WHERE client_id = ?', [
        `${session.id}-deliver`,
      ])[0]!.payload,
    ) as Record<string, unknown>
    expect(payload).toMatchObject({
      id: session.id,
      status: 'delivered',
      settlementMethod: 'package_credit',
      packageProductId: PACKAGE,
      quantity: 1,
    })
    const entry = db.all<{ id: string }>(
      "SELECT id FROM package_credit_ledger WHERE entry_type = 'CONSUME'",
    )[0]!
    expect(payload.consumptionEntryId).toBe(entry.id)
  })

  it('the create command is camelCase, with a UUID id the server can store', async () => {
    const session = await schedule()
    expect(session.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    const payload = JSON.parse(
      db.all<{ payload: string }>('SELECT payload FROM sync_queue WHERE client_id = ?', [
        session.id,
      ])[0]!.payload,
    ) as Record<string, unknown>
    expect(payload).toMatchObject({
      customerId: CUST,
      serviceOfferingId: SERVICE,
      sessionDate: '2026-11-02',
    })
    expect(payload).not.toHaveProperty('customer_id')
  })
})

describe('creating a session', () => {
  it('can only create a scheduled session - never one already delivered', async () => {
    const res = await engine.request({
      method: 'POST',
      path: '/service-delivery/sessions',
      headers,
      body: {
        workspaceId: ws,
        customerId: CUST,
        serviceOfferingId: SERVICE,
        sessionDate: '2026-11-02',
        startTime: '10:00',
        endTime: '11:00',
        status: 'delivered',
      },
    })
    expect(res.status).toBe(400)
    expect(count('FROM service_delivery_sessions')).toBe(0)
  })

  it('the same id again is a replay: one row, one command', async () => {
    const first = await schedule()
    const body = {
      id: first.id,
      workspaceId: ws,
      customerId: CUST,
      serviceOfferingId: SERVICE,
      sessionDate: '2026-11-02',
      startTime: '10:00',
      endTime: '11:00',
      settlementMethod: 'package_credit',
    }
    const again = await engine.request<SessionView>({
      method: 'POST',
      path: '/service-delivery/sessions',
      headers,
      body,
    })
    expect(again.status).toBeLessThan(300)
    expect(again.data.id).toBe(first.id)
    expect(count('FROM service_delivery_sessions')).toBe(1)
    expect(count('FROM sync_queue')).toBe(1)
  })
})

describe('retry and replay', () => {
  it('delivering twice consumes once', async () => {
    grant(5)
    const session = await schedule()
    expect((await deliver(session.id, { packageProductId: PACKAGE })).status).toBe(200)
    const again = await deliver(session.id, { packageProductId: PACKAGE })
    expect(again.status).toBe(200)
    expect(count("FROM package_credit_ledger WHERE entry_type = 'CONSUME'")).toBe(1)
    expect(count('FROM sync_queue WHERE client_id = ?', [`${session.id}-deliver`])).toBe(1)
  })

  it('cancelling twice reverses once', async () => {
    grant(5)
    const session = await schedule()
    await deliver(session.id, { packageProductId: PACKAGE })
    expect((await cancel(session.id)).status).toBe(200)
    expect((await cancel(session.id)).status).toBe(200)
    expect(count("FROM package_credit_ledger WHERE entry_type = 'REVERSAL'")).toBe(1)
  })

  it('a cancelled session cannot be delivered', async () => {
    const session = await schedule()
    expect((await cancel(session.id)).status).toBe(200)
    const res = await deliver(session.id, { settlementMethod: 'complementary', reason: 'x' })
    expect(res.status).toBe(409)
    expect(statusOf(session.id)).toBe('cancelled')
  })

  it('a stale view cannot deliver', async () => {
    const session = await schedule()
    const res = await deliver(session.id, {
      settlementMethod: 'complementary',
      reason: 'x',
      expectedUpdatedAt: '2000-01-01T00:00:00.000Z',
    })
    expect(res.status).toBe(409)
    expect(JSON.stringify(res.data)).toContain('SESSION_CHANGED')
    expect(statusOf(session.id)).toBe('scheduled')
  })
})

describe('a cancellation says why', () => {
  it('without a reason: 400, the session is untouched and nothing is queued', async () => {
    const session = await schedule()
    const queued = count('FROM sync_queue')
    for (const reason of [null, '', '   ']) {
      const res = await cancel(session.id, reason)
      expect(res.status).toBe(400)
      expect(JSON.stringify(res.data)).toContain('CANCELLATION_REASON_REQUIRED')
    }
    expect(statusOf(session.id)).toBe('scheduled')
    expect(count('FROM sync_queue')).toBe(queued)
  })

  it('keeps the reason on the session and sends it in the cancel command', async () => {
    const session = await schedule()
    expect((await cancel(session.id, '  double booked  ')).status).toBe(200)
    const row = db.all<{ cancellation_reason: string }>(
      'SELECT cancellation_reason FROM service_delivery_sessions WHERE id = ?',
      [session.id],
    )[0]!
    expect(row.cancellation_reason).toBe('double booked')
    const payload = JSON.parse(
      db.all<{ payload: string }>('SELECT payload FROM sync_queue WHERE client_id = ?', [
        `${session.id}-cancel`,
      ])[0]!.payload,
    ) as Record<string, unknown>
    expect(payload).toMatchObject({ status: 'cancelled', reason: 'double booked' })
  })

  it('a replay of the cancel needs no reason and changes nothing', async () => {
    const session = await schedule()
    await cancel(session.id, 'first reason')
    const again = await cancel(session.id, null)
    expect(again.status).toBe(200)
    expect(
      db.all<{ cancellation_reason: string }>(
        'SELECT cancellation_reason FROM service_delivery_sessions WHERE id = ?',
        [session.id],
      )[0]!.cancellation_reason,
    ).toBe('first reason')
  })

  it('is allowed to the same role the server allows (invoice.create): a seller can cancel, a viewer cannot', async () => {
    const session = await schedule()
    const asRole = (role: string) =>
      engine.request({
        method: 'POST',
        path: `/service-delivery/sessions/${session.id}/cancel`,
        headers: { ...headers, 'x-user-role': role },
        body: { reason: 'x' },
      })
    db.run("UPDATE local_user SET role = 'viewer'")
    expect((await asRole('viewer')).status).toBe(403)
    db.run("UPDATE local_user SET role = 'seller'")
    expect((await asRole('seller')).status).toBe(200)
  })
})

describe('cancelling a delivered session', () => {
  it('an invoiced one is refused - a status flip is not a correction', async () => {
    seedInvoice(INVOICE, CUST)
    const session = await schedule()
    await deliver(session.id, { settlementMethod: 'invoice', invoiceId: INVOICE })
    const res = await cancel(session.id)
    expect(res.status).toBe(409)
    expect(JSON.stringify(res.data)).toContain('DELIVERED_INVOICE_CORRECTION_REQUIRED')
    expect(statusOf(session.id)).toBe('delivered')
  })

  it('a package one gives the credit back with a reversal that references the consume, and queues ONE command', async () => {
    grant(5)
    const session = await schedule()
    await deliver(session.id, { packageProductId: PACKAGE })
    const consumeId = db.all<{ id: string }>(
      "SELECT id FROM package_credit_ledger WHERE entry_type = 'CONSUME'",
    )[0]!.id

    const res = await cancel(session.id)
    expect(res.status).toBe(200)
    const reversal = db.all<{ reference_entry_id: string; idempotency_key: string }>(
      "SELECT reference_entry_id, idempotency_key FROM package_credit_ledger WHERE entry_type = 'REVERSAL'",
    )
    expect(reversal).toEqual([
      { reference_entry_id: consumeId, idempotency_key: `delivery_cancel_${session.id}` },
    ])
    expect(count("FROM sync_queue WHERE entity = 'package_credit_ledger'")).toBe(0)
    expect(count('FROM sync_queue WHERE client_id = ?', [`${session.id}-cancel`])).toBe(1)
  })
})
