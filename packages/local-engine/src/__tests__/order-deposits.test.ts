// ============================================
// packages/local-engine/src/__tests__/order-deposits.test.ts
//
// The three moves of an order deposit on the device, through the routes a screen
// actually calls:
//
//   receipt   Dr cash | bank        Cr customer advances
//   apply     Dr customer advances  Cr receivable
//   refund    Dr customer advances  Cr cash | bank
//
// What is asserted is what a person reads and decides on: the amount applied,
// what is left, the invoice that was settled, the ledger entry behind it, and
// the refusal they get when the move is not allowed. Every write also goes
// through the shared rules in `@hisabche/validation`, so a device cannot accept
// what the server would refuse.
//
// ⚠️ THE OUTBOX ROW IS CONDITIONAL, as it is for every other local write: only a
// cloud-edition request carries `x-hisabche-queue: 1`. The offline edition has
// no server, so its local post IS the record.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import type { LocalDb } from '../db'
import { createLocalEngine } from '../index'
import { createTestDb, createTestEngine, TEST_USER_ID, TEST_WORKSPACE_ID } from './test-db'

const CUSTOMER = '00000000-0000-4000-8000-000000000001'
const OTHER_CUSTOMER = '00000000-0000-4000-8000-000000000002'
const ORDER = '00000000-0000-4000-8000-0000000000a1'
const INVOICE = '00000000-0000-4000-8000-0000000000b1'
const INVOICE_ENTRY = '00000000-0000-4000-8000-0000000000c1'
const QUEUE = { 'x-hisabche-queue': '1' }

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
  journalEntryId: string | null
  status: string
  pendingSync: boolean
}

interface MovementView {
  replayed: boolean
  movementId: string
  depositId: string
  invoiceId: string | null
  amountMinor: number
  currency: string
  reason: string | null
  method: string | null
  paymentId: string
  journalEntryId: string | null
}

let db: LocalDb
let engine: ReturnType<typeof createTestEngine>

const count = (sql: string, params: unknown[] = []) => db.all<{ n: number }>(sql, params)[0]!.n

/** An invoice the device already booked — the state an apply requires. */
function seedPostedInvoice(total: number, customerId = CUSTOMER) {
  db.run(
    `INSERT INTO invoice (id, workspace_id, invoice_number, type, customer_id, date, total,
                          paid_amount, currency, status, updated_at)
     VALUES (?, ?, 'INV-1', 'sale', ?, '2026-10-01', ?, 0, 'AFN', 'pending', datetime('now'))`,
    [INVOICE, TEST_WORKSPACE_ID, customerId, total],
  )
  db.run(
    `INSERT INTO journal_entry (id, workspace_id, entry_number, date, description, reference,
                                status, source_type, source_id, posted_at, created_at, updated_at)
     VALUES (?, ?, 'J-2026-INVOICE', '2026-10-01', 'sale', 'INV-1', 'posted',
             'invoice', ?, datetime('now'), datetime('now'), datetime('now'))`,
    [INVOICE_ENTRY, TEST_WORKSPACE_ID, INVOICE],
  )
}

const takeDeposit = (
  amountMinor = 50_000,
  headers: Record<string, string> = QUEUE,
  customerId = CUSTOMER,
) =>
  engine.request<DepositView>({
    method: 'POST',
    path: `/orders/${ORDER}/deposits`,
    headers,
    body: { customerId, amountMinor, paymentMethod: 'cash' },
  })

const apply = (
  depositId: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = QUEUE,
) =>
  engine.request<MovementView>({
    method: 'POST',
    path: `/orders/${ORDER}/deposits/${depositId}/apply`,
    headers,
    body,
  })

const refund = (
  depositId: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = QUEUE,
) =>
  engine.request<MovementView>({
    method: 'POST',
    path: `/orders/${ORDER}/deposits/${depositId}/refund`,
    headers,
    body,
  })

const depositsOfCustomer = () =>
  engine.request<DepositView[]>({
    method: 'GET',
    path: `/customers/${CUSTOMER}/deposits`,
  })

/** The ledger lines of one document, by the role of the account they hit. */
const linesOf = (sourceType: string, sourceId: string) =>
  db.all<{ role: string; debit: number; credit: number }>(
    `SELECT a.role AS role, l.debit AS debit, l.credit AS credit
       FROM journal_line l
       JOIN journal_entry je ON je.id = l.journal_id
       JOIN account a ON a.id = l.account_id
      WHERE je.workspace_id = ? AND je.source_type = ? AND je.source_id = ?`,
    [TEST_WORKSPACE_ID, sourceType, sourceId],
  )

/**
 * The same lines keyed by role: a document's shape is which account is debited
 * and which is credited, not the order two rows happened to be inserted in.
 */
const ledgerOf = (sourceType: string, sourceId: string) =>
  Object.fromEntries(
    linesOf(sourceType, sourceId).map((line) => [
      line.role,
      { debit: line.debit, credit: line.credit },
    ]),
  )

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
  seedPostedInvoice(100_000)
})

describe('taking the deposit', () => {
  it('books Dr cash / Cr customer advances and calls it available', async () => {
    const res = await takeDeposit(50_000)
    expect(res.status, JSON.stringify(res.data)).toBe(201)

    const deposit = res.data
    expect(deposit.amountMinor).toBe(50_000)
    expect(deposit.appliedMinor).toBe(0)
    expect(deposit.refundedMinor).toBe(0)
    expect(deposit.remainingMinor).toBe(50_000)
    expect(deposit.status).toBe('available')
    expect(deposit.postingStatus).toBe('posted')
    expect(deposit.journalEntryId).toBeTruthy()

    // AFN has no minor unit: 50,000 minor is 50,000 in the books.
    expect(ledgerOf('order_deposit', deposit.id)).toEqual({
      cash: { debit: 50_000, credit: 0 },
      customer_advances: { debit: 0, credit: 50_000 },
    })
  })

  it('refuses a zero or fractional-minor amount and writes nothing', async () => {
    const zero = await takeDeposit(0)
    expect(zero.status).toBe(400)
    const fractional = await engine.request({
      method: 'POST',
      path: `/orders/${ORDER}/deposits`,
      headers: QUEUE,
      body: { customerId: CUSTOMER, amountMinor: 10.5 },
    })
    expect(fractional.status).toBe(400)
    expect(count('SELECT COUNT(*) AS n FROM order_deposits')).toBe(0)
  })
})

describe('applying a deposit to a final invoice', () => {
  it('settles the invoice, books the advance against the receivable and leaves the rest', async () => {
    const created = await takeDeposit(50_000)
    const depositId = created.data.id

    const res = await apply(depositId, {
      invoiceId: INVOICE,
      amountMinor: 30_000,
      idempotencyKey: 'apply-key-0001',
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    expect(res.data.replayed).toBe(false)
    expect(res.data.amountMinor).toBe(30_000)
    expect(res.data.paymentId).toBeTruthy()
    expect(res.data.journalEntryId).toBeTruthy()

    // The invoice the person sees: 30,000 of 100,000 paid.
    expect(
      db.get<{ paid_amount: number; status: string }>(
        'SELECT paid_amount, status FROM invoice WHERE id = ?',
        [INVOICE],
      ),
    ).toEqual({ paid_amount: 30_000, status: 'partial' })

    // The settlement IS a payment (direction in), with ONE allocation.
    expect(
      db.get<{ direction: string; amount: number; method: string; status: string }>(
        'SELECT direction, amount, method, status FROM payment WHERE id = ?',
        [res.data.paymentId],
      ),
    ).toEqual({ direction: 'in', amount: 30_000, method: 'order_deposit', status: 'posted' })
    expect(
      db.all<{ invoice_id: string; amount: number }>(
        'SELECT invoice_id, amount FROM payment_allocation WHERE payment_id = ?',
        [res.data.paymentId],
      ),
    ).toEqual([{ invoice_id: INVOICE, amount: 30_000 }])

    // Dr customer advances / Cr receivable.
    expect(ledgerOf('payment', res.data.paymentId)).toEqual({
      customer_advances: { debit: 30_000, credit: 0 },
      receivable: { debit: 0, credit: 30_000 },
    })

    // What the customer's page now says.
    const list = await depositsOfCustomer()
    expect(list.status).toBe(200)
    expect(list.data[0]).toMatchObject({
      id: depositId,
      appliedMinor: 30_000,
      refundedMinor: 0,
      remainingMinor: 20_000,
      status: 'partially_used',
    })
  })

  it('a partial apply can be followed by a refund of what is left', async () => {
    const created = await takeDeposit(50_000)
    const depositId = created.data.id
    await apply(depositId, {
      invoiceId: INVOICE,
      amountMinor: 20_000,
      idempotencyKey: 'apply-key-0002',
    })

    const res = await refund(depositId, {
      amountMinor: 30_000,
      reason: 'مشتری بقیه را نقد گرفت',
      idempotencyKey: 'refund-key-0001',
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)

    const list = await depositsOfCustomer()
    expect(list.data[0]).toMatchObject({
      appliedMinor: 20_000,
      refundedMinor: 30_000,
      remainingMinor: 0,
      status: 'fully_used',
    })
  })

  it('refuses more than the invoice still owes, and writes nothing', async () => {
    db.run('UPDATE invoice SET total = ? WHERE id = ?', [10_000, INVOICE])
    const created = await takeDeposit(50_000)

    const res = await apply(created.data.id, {
      invoiceId: INVOICE,
      amountMinor: 20_000,
      idempotencyKey: 'apply-key-0003',
    })
    expect(res.status).toBe(409)
    expect((res.data as unknown as { code: string }).code).toBe('DEPOSIT_APPLY_EXCEEDS_INVOICE')
    expect(count("SELECT COUNT(*) AS n FROM payment WHERE direction = 'in'")).toBe(0)
    expect(count('SELECT COUNT(*) AS n FROM payment_allocation')).toBe(0)
  })

  it('refuses another customer, another currency, an unposted invoice and a draft', async () => {
    const created = await takeDeposit(50_000)
    const depositId = created.data.id

    db.run('UPDATE invoice SET customer_id = ? WHERE id = ?', [OTHER_CUSTOMER, INVOICE])
    const foreignCustomer = await apply(depositId, {
      invoiceId: INVOICE,
      amountMinor: 1_000,
      idempotencyKey: 'apply-key-0004',
    })
    expect(foreignCustomer.status).toBe(400)
    expect((foreignCustomer.data as unknown as { code: string }).code).toBe(
      'DEPOSIT_CUSTOMER_MISMATCH',
    )

    // 100 dollars is not 100 afghani: the two currencies must be the same one.
    db.run('UPDATE invoice SET customer_id = ?, currency = ? WHERE id = ?', [
      CUSTOMER,
      'USD',
      INVOICE,
    ])
    const foreignCurrency = await apply(depositId, {
      invoiceId: INVOICE,
      amountMinor: 1_000,
      idempotencyKey: 'apply-key-0006',
    })
    expect(foreignCurrency.status).toBe(400)
    expect((foreignCurrency.data as unknown as { code: string }).code).toBe(
      'DEPOSIT_CURRENCY_MISMATCH',
    )

    // An invoice that is not booked cannot take the money: the advance would be
    // debited against a receivable that does not exist yet.
    db.run('UPDATE invoice SET currency = ? WHERE id = ?', ['AFN', INVOICE])
    db.run('UPDATE journal_entry SET status = ? WHERE id = ?', ['draft', INVOICE_ENTRY])
    const unposted = await apply(depositId, {
      invoiceId: INVOICE,
      amountMinor: 1_000,
      idempotencyKey: 'apply-key-0005',
    })
    expect(unposted.status).toBe(400)
    expect((unposted.data as unknown as { code: string }).code).toBe('DEPOSIT_INVOICE_NOT_POSTED')
  })
})

describe('refunding what is left', () => {
  it('records money out with the reason, books Dr advances / Cr bank, and allocates nothing', async () => {
    const created = await takeDeposit(50_000)
    const depositId = created.data.id

    const res = await refund(depositId, {
      amountMinor: 20_000,
      reason: '  مشتری سفارش را لغو کرد  ',
      method: 'bank',
      idempotencyKey: 'refund-key-0002',
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    expect(res.data.amountMinor).toBe(20_000)
    // The stored reason is the trimmed one — the audit trail has no padding.
    expect(res.data.reason).toBe('مشتری سفارش را لغو کرد')
    expect(res.data.method).toBe('bank')

    expect(
      db.get<{ direction: string; method: string; notes: string; status: string }>(
        'SELECT direction, method, notes, status FROM payment WHERE id = ?',
        [res.data.paymentId],
      ),
    ).toEqual({
      direction: 'out',
      method: 'bank',
      notes: 'مشتری سفارش را لغو کرد',
      status: 'posted',
    })
    expect(
      count('SELECT COUNT(*) AS n FROM payment_allocation WHERE payment_id = ?', [
        res.data.paymentId,
      ]),
    ).toBe(0)
    expect(ledgerOf('payment', res.data.paymentId)).toEqual({
      customer_advances: { debit: 20_000, credit: 0 },
      bank: { debit: 0, credit: 20_000 },
    })

    const stored = db.get<{ reason: string; sync_status: string }>(
      'SELECT reason, sync_status FROM order_deposit_refunds WHERE id = ?',
      [res.data.movementId],
    )
    expect(stored).toEqual({ reason: 'مشتری سفارش را لغو کرد', sync_status: 'posted' })
  })

  it('refuses an empty, whitespace-only or oversized reason before writing anything', async () => {
    const created = await takeDeposit(50_000)
    const depositId = created.data.id

    for (const reason of ['', '   ', 'ab', 'x'.repeat(501)]) {
      const res = await refund(depositId, {
        amountMinor: 1_000,
        reason,
        idempotencyKey: 'refund-key-0003',
      })
      expect(res.status, JSON.stringify(reason)).toBe(400)
    }
    expect(count("SELECT COUNT(*) AS n FROM payment WHERE direction = 'out'")).toBe(0)
    expect(count('SELECT COUNT(*) AS n FROM order_deposit_refunds')).toBe(0)
  })

  it('refuses more than what is left', async () => {
    const created = await takeDeposit(50_000)
    const res = await refund(created.data.id, {
      amountMinor: 60_000,
      reason: 'بازگشت کامل',
      idempotencyKey: 'refund-key-0004',
    })
    expect(res.status).toBe(409)
    expect((res.data as unknown as { code: string }).code).toBe('DEPOSIT_INSUFFICIENT_BALANCE')
    expect(count("SELECT COUNT(*) AS n FROM payment WHERE direction = 'out'")).toBe(0)
  })
})

describe('a retry is the same request', () => {
  it('answers with the first application instead of settling the invoice twice', async () => {
    const created = await takeDeposit(50_000)
    const depositId = created.data.id
    const body = { invoiceId: INVOICE, amountMinor: 25_000, idempotencyKey: 'apply-retry-01' }

    const first = await apply(depositId, body)
    expect(first.status).toBe(201)
    const second = await apply(depositId, body)
    expect(second.status).toBe(200)
    expect(second.data.replayed).toBe(true)
    expect(second.data.movementId).toBe(first.data.movementId)

    expect(count("SELECT COUNT(*) AS n FROM payment WHERE direction = 'in'")).toBe(1)
    expect(count('SELECT COUNT(*) AS n FROM order_deposit_applications')).toBe(1)
    expect(
      db.get<{ paid_amount: number }>('SELECT paid_amount FROM invoice WHERE id = ?', [INVOICE]),
    ).toEqual({ paid_amount: 25_000 })
  })

  it('refuses the same key with another amount or reason', async () => {
    const created = await takeDeposit(50_000)
    const depositId = created.data.id
    await apply(depositId, {
      invoiceId: INVOICE,
      amountMinor: 10_000,
      idempotencyKey: 'apply-conflict-1',
    })
    const conflicted = await apply(depositId, {
      invoiceId: INVOICE,
      amountMinor: 11_000,
      idempotencyKey: 'apply-conflict-1',
    })
    expect(conflicted.status).toBe(409)
    expect((conflicted.data as unknown as { code: string }).code).toBe(
      'DEPOSIT_IDEMPOTENCY_CONFLICT',
    )

    const refunded = await refund(depositId, {
      amountMinor: 5_000,
      reason: 'دلیل اول',
      idempotencyKey: 'refund-conflict-1',
    })
    expect(refunded.status).toBe(201)
    const otherReason = await refund(depositId, {
      amountMinor: 5_000,
      reason: 'دلیل دوم',
      idempotencyKey: 'refund-conflict-1',
    })
    expect(otherReason.status).toBe(409)
    expect((otherReason.data as unknown as { code: string }).code).toBe(
      'DEPOSIT_IDEMPOTENCY_CONFLICT',
    )
  })
})

describe('the outbox', () => {
  it('queues the move only when the request asks the server to hear about it', async () => {
    const cloud = await takeDeposit(50_000)
    await apply(cloud.data.id, {
      invoiceId: INVOICE,
      amountMinor: 10_000,
      idempotencyKey: 'apply-queued-01',
    })
    const queued = db.all<{ client_id: string; entity: string; payload: string }>(
      `SELECT client_id, entity, payload FROM sync_queue WHERE status = 'pending'`,
    )
    // The receipt itself travels too, under the device's own deposit id: the
    // server writes THAT row instead of a second deposit for the same money.
    expect(queued).toHaveLength(2)
    const receipt = queued.find((row) => JSON.parse(row.payload).movement === 'receipt')
    const movement = queued.find((row) => JSON.parse(row.payload).movement === 'apply')

    expect(receipt).toBeDefined()
    expect(receipt!.client_id).toBe(cloud.data.id)
    expect(receipt!.entity).toBe('order_deposits')
    expect(JSON.parse(receipt!.payload)).toMatchObject({
      movement: 'receipt',
      id: cloud.data.id,
      orderId: ORDER,
      customerId: CUSTOMER,
      amountMinor: 50_000,
      paymentMethod: 'cash',
    })

    expect(movement).toBeDefined()
    expect(movement!.entity).toBe('order_deposits')
    expect(JSON.parse(movement!.payload)).toMatchObject({
      movement: 'apply',
      orderId: ORDER,
      depositId: cloud.data.id,
      invoiceId: INVOICE,
      amountMinor: 10_000,
      idempotencyKey: 'apply-queued-01',
    })

    const offline = await takeDeposit(50_000, {})
    await apply(
      offline.data.id,
      { invoiceId: INVOICE, amountMinor: 5_000, idempotencyKey: 'apply-local-01' },
      {},
    )
    // Still exactly the two cloud-edition rows: a local post is its own record.
    expect(count('SELECT COUNT(*) AS n FROM sync_queue')).toBe(2)
  })
})

describe('rows the device cannot move', () => {
  it('says the booking is unknown when a deposit has no posting status', async () => {
    db.run(
      `INSERT INTO order_deposits (id, workspace_id, order_id, customer_id, amount_minor,
                                    payment_method, currency, posting_status)
       VALUES ('dep-unknown', ?, ?, ?, 9000, 'cash', 'AFN', NULL)`,
      [TEST_WORKSPACE_ID, ORDER, CUSTOMER],
    )
    const list = await depositsOfCustomer()
    expect(list.data[0]).toMatchObject({ status: 'posting_unknown', remainingMinor: 9_000 })
  })

  it('refuses a move on a deposit whose currency is unknown rather than guessing one', async () => {
    db.run(
      `INSERT INTO order_deposits (id, workspace_id, order_id, customer_id, amount_minor,
                                    payment_method, currency, posting_status)
       VALUES ('dep-null-currency', ?, ?, ?, 9000, 'cash', NULL, 'posted')`,
      [TEST_WORKSPACE_ID, ORDER, CUSTOMER],
    )
    const res = await apply('dep-null-currency', {
      invoiceId: INVOICE,
      amountMinor: 1_000,
      idempotencyKey: 'apply-no-currency',
    })
    expect(res.status).toBe(400)
    expect((res.data as unknown as { code: string }).code).toBe('DEPOSIT_CURRENCY_UNKNOWN')
    expect(count('SELECT COUNT(*) AS n FROM order_deposit_applications')).toBe(0)
  })

  it('refuses to apply or refund a deposit that was never booked', async () => {
    db.run(
      `INSERT INTO order_deposits (id, workspace_id, order_id, customer_id, amount_minor,
                                    payment_method, currency, posting_status)
       VALUES ('dep-unposted', ?, ?, ?, 9000, 'cash', 'AFN', 'pending_posting')`,
      [TEST_WORKSPACE_ID, ORDER, CUSTOMER],
    )
    const applyRes = await apply('dep-unposted', {
      invoiceId: INVOICE,
      amountMinor: 1_000,
      idempotencyKey: 'apply-unposted',
    })
    expect(applyRes.status).toBe(409)
    expect((applyRes.data as unknown as { code: string }).code).toBe('DEPOSIT_PENDING_POSTING')

    const refundRes = await refund('dep-unposted', {
      amountMinor: 1_000,
      reason: 'قبل از ثبت در دفتر',
      idempotencyKey: 'refund-unposted',
    })
    expect(refundRes.status).toBe(409)
    expect((refundRes.data as unknown as { code: string }).code).toBe('DEPOSIT_PENDING_POSTING')
  })
})

describe('a read-only member', () => {
  it('is refused on every deposit write route', async () => {
    const writes = [
      { path: `/orders/${ORDER}/deposits`, body: { customerId: CUSTOMER, amountMinor: 1_000 } },
      {
        path: `/orders/${ORDER}/deposits/dep-x/post`,
        body: {},
      },
      {
        path: `/orders/${ORDER}/deposits/dep-x/apply`,
        body: { invoiceId: INVOICE, amountMinor: 1_000, idempotencyKey: 'viewer-apply-01' },
      },
      {
        path: `/orders/${ORDER}/deposits/dep-x/refund`,
        body: { amountMinor: 1_000, reason: 'دلیل', idempotencyKey: 'viewer-refund-1' },
      },
    ]

    for (const route of writes) {
      const viewerDb = createTestDb()
      viewerDb.run('UPDATE local_user SET role = ?', ['viewer'])
      const res = await createLocalEngine(viewerDb).request({
        method: 'POST',
        path: route.path,
        headers: { 'x-workspace-id': TEST_WORKSPACE_ID, 'x-user-id': TEST_USER_ID },
        body: route.body,
      })
      expect(res.status, route.path).toBe(403)
    }
  })
})
