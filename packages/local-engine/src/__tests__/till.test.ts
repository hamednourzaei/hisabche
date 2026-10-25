// The till on the device. The rules are @hisabche/validation's (pos.domain and
// till-view — the server calls the same functions); these tests prove the
// ROUTES: SQLite rows → the shared rules → the shapes the till screens read,
// the idempotency the till depends on, and that a close books the ledger.
import { describe, expect, it } from 'vitest'
import { FRACTION_DIGITS } from '@hisabche/formatting'
import { createLocalEngine } from '../index'
import { createTestDb } from './test-db'

const digits = (FRACTION_DIGITS as Record<string, number>).AFN ?? 2
const minorOf = (major: number) => Math.round(major * 10 ** digits)

interface Totals {
  expectedCashMinor: number
  varianceMinor: number | null
}

function setup() {
  const db = createTestDb()
  const engine = createLocalEngine(db)
  const open = async (floatMajor = 1000) =>
    (
      await engine.request<{ id: string; status: string }>({
        method: 'POST',
        path: '/pos/sessions',
        body: { openingFloatMinor: minorOf(floatMajor) },
      })
    ).data
  return { db, engine, open }
}

describe('the till on the device', () => {
  it('opens one drawer per person and currency, and reads it back with its totals', async () => {
    const { engine, open } = setup()
    const session = await open(1000)
    expect(session.status).toBe('open')

    const again = await engine.request({
      method: 'POST',
      path: '/pos/sessions',
      body: { openingFloatMinor: 0 },
    })
    expect(again.status).toBe(409)
    expect((again.data as { code: string }).code).toBe('POS_SESSION_ALREADY_OPEN')

    const current = await engine.request<{ session: { id: string }; totals: Totals }>({
      method: 'GET',
      path: '/pos/sessions/current',
    })
    expect(current.status).toBe(200)
    expect(current.data.session.id).toBe(session.id)
    expect(current.data.totals.expectedCashMinor).toBe(minorOf(1000))
  })

  it('takes an order idempotently, moves cash, settles a payment through the drawer, and foots', async () => {
    const { engine, open } = setup()
    const session = await open(1000)

    const order = {
      orderRef: 'ORD-DEVICE-0001',
      totalMinor: minorOf(500),
      changeMinor: 0,
      payments: [{ method: 'cash', amountMinor: minorOf(500) }],
    }
    const first = await engine.request<{ id: string }>({
      method: 'POST',
      path: `/pos/sessions/${session.id}/orders`,
      body: order,
    })
    expect(first.status).toBe(201)
    // A retry after a lost response is the same order, not a second sale.
    const retry = await engine.request<{ id: string }>({
      method: 'POST',
      path: `/pos/sessions/${session.id}/orders`,
      body: order,
    })
    expect(retry.data.id).toBe(first.data.id)

    // Underpaying is refused by the shared rule.
    const short = await engine.request({
      method: 'POST',
      path: `/pos/sessions/${session.id}/orders`,
      body: {
        ...order,
        orderRef: 'ORD-DEVICE-0002',
        payments: [{ method: 'cash', amountMinor: 1 }],
      },
    })
    expect(short.status).toBe(400)

    const movementId = '9b2f4c1e-0000-4000-8000-0000000000b1'
    const cashIn = {
      kind: 'cash_in',
      amountMinor: minorOf(200),
      reason: 'float top-up',
      movementId,
    }
    const m1 = await engine.request<{ id: string }>({
      method: 'POST',
      path: `/pos/sessions/${session.id}/cash`,
      body: cashIn,
    })
    expect(m1.status).toBe(201)
    const m2 = await engine.request<{ id: string }>({
      method: 'POST',
      path: `/pos/sessions/${session.id}/cash`,
      body: cashIn,
    })
    expect(m2.data.id).toBe(movementId)
    await engine.request({
      method: 'POST',
      path: `/pos/sessions/${session.id}/cash`,
      body: { kind: 'cash_out', amountMinor: minorOf(100), reason: 'delivery fare' },
    })

    // A customer payment that NAMES this drawer (the invoice's «ثبت دریافت»).
    const customer = (
      await engine.request<{ id: string }>({
        method: 'POST',
        path: '/customers',
        body: { fullName: 'مشتری صندوق' },
      })
    ).data.id
    const invoice = (
      await engine.request<{ id: string }>({
        method: 'POST',
        path: '/invoices',
        body: {
          type: 'sale',
          currency: 'AFN',
          customerId: customer,
          items: [{ productName: 'کالا', quantity: 1, unitPrice: 300 }],
        },
      })
    ).data.id
    const pay = await engine.request({
      method: 'POST',
      path: '/payments',
      body: {
        direction: 'in',
        partyType: 'customer',
        partyId: customer,
        amount: 300,
        currency: 'AFN',
        method: 'cash',
        tillSessionId: session.id,
        allocations: [{ invoiceId: invoice, amount: 300 }],
      },
    })
    expect(pay.status).toBe(201)

    const detail = await engine.request<{ totals: Totals }>({
      method: 'GET',
      path: `/pos/sessions/${session.id}`,
    })
    // 1000 float + 500 sale + 200 in − 100 out + 300 settled
    expect(detail.data.totals.expectedCashMinor).toBe(minorOf(1900))

    const drawer = await engine.request<{
      entries: { kind: string; balanceMinor: number }[]
      expectedCashMinor: number
    }>({ method: 'GET', path: `/pos/sessions/${session.id}/ledger` })
    expect(drawer.data.expectedCashMinor).toBe(minorOf(1900))
    expect(drawer.data.entries.at(-1)?.balanceMinor).toBe(minorOf(1900))
    expect(drawer.data.entries.map((e) => e.kind)).toEqual(
      expect.arrayContaining(['opening_float', 'sale', 'cash_in', 'cash_out', 'settlement_in']),
    )
  })

  it('refuses cash into a till that is not open, and non-cash into a till', async () => {
    const { engine, open } = setup()
    const session = await open()
    const customer = (
      await engine.request<{ id: string }>({
        method: 'POST',
        path: '/customers',
        body: { fullName: 'م' },
      })
    ).data.id
    const base = {
      direction: 'in',
      partyType: 'customer',
      partyId: customer,
      amount: 10,
      currency: 'AFN',
      tillSessionId: session.id,
    }
    const card = await engine.request({
      method: 'POST',
      path: '/payments',
      body: { ...base, method: 'transfer' },
    })
    expect(card.status).toBe(400)
    expect((card.data as { code: string }).code).toBe('PAYMENT_TILL_ONLY_CASH')

    await engine.request({ method: 'POST', path: `/pos/sessions/${session.id}/suspend` })
    const closedTill = await engine.request({
      method: 'POST',
      path: '/payments',
      body: { ...base, method: 'cash' },
    })
    expect(closedTill.status).toBe(409)
    expect((closedTill.data as { code: string }).code).toBe('PAYMENT_TILL_NOT_OPEN')
  })

  it('suspends and resumes, names a drawer, and removes only an EMPTY one', async () => {
    const { engine, open } = setup()
    const session = await open()

    const wrongResume = await engine.request({
      method: 'POST',
      path: `/pos/sessions/${session.id}/resume`,
    })
    expect(wrongResume.status).toBe(409)
    expect((wrongResume.data as { code: string }).code).toBe('POS_SESSION_NOT_SUSPENDED')

    const suspended = await engine.request<{ status: string }>({
      method: 'POST',
      path: `/pos/sessions/${session.id}/suspend`,
    })
    expect(suspended.status).toBe(200)
    expect(suspended.data.status).toBe('suspended')
    const resumed = await engine.request<{ status: string }>({
      method: 'POST',
      path: `/pos/sessions/${session.id}/resume`,
    })
    expect(resumed.data.status).toBe('open')

    await engine.request({
      method: 'PATCH',
      path: `/pos/sessions/${session.id}/label`,
      body: { label: 'صندوق ۱' },
    })
    const labels = await engine.request<{ labels: Record<string, string> }>({
      method: 'GET',
      path: '/pos/sessions/labels',
    })
    expect(labels.data.labels[session.id]).toBe('صندوق ۱')

    // A drawer that took money is closed, never removed.
    await engine.request({
      method: 'POST',
      path: `/pos/sessions/${session.id}/cash`,
      body: { kind: 'cash_in', amountMinor: minorOf(5), reason: 'x' },
    })
    const inUse = await engine.request({ method: 'DELETE', path: `/pos/sessions/${session.id}` })
    expect(inUse.status).toBe(409)
    expect((inUse.data as { code: string }).code).toBe('POS_SESSION_IN_USE')

    const empty = (
      await engine.request<{ id: string }>({
        method: 'POST',
        path: '/pos/sessions',
        body: { openingFloatMinor: 0, currency: 'USD' },
      })
    ).data
    const removed = await engine.request({ method: 'DELETE', path: `/pos/sessions/${empty.id}` })
    expect(removed.status).toBe(200)
  })

  it('moves cash to the bank and records opening capital — each booked once', async () => {
    const { engine, open, db } = setup()
    const session = await open(1000)

    const transferId = '9b2f4c1e-0000-4000-8000-0000000000c1'
    const body = {
      transferId,
      direction: 'to_bank',
      amountMinor: minorOf(400),
      reason: 'deposit',
    }
    const t1 = await engine.request<{ entryId: string; alreadyRecorded: boolean }>({
      method: 'POST',
      path: `/pos/sessions/${session.id}/bank-transfer`,
      body,
    })
    expect(t1.status).toBe(201)
    expect(t1.data.alreadyRecorded).toBe(false)
    const t2 = await engine.request<{ entryId: string; alreadyRecorded: boolean }>({
      method: 'POST',
      path: `/pos/sessions/${session.id}/bank-transfer`,
      body,
    })
    expect(t2.data.alreadyRecorded).toBe(true)
    expect(t2.data.entryId).toBe(t1.data.entryId)

    // The drawer cannot send more than it holds.
    const tooMuch = await engine.request({
      method: 'POST',
      path: `/pos/sessions/${session.id}/bank-transfer`,
      body: {
        ...body,
        transferId: '9b2f4c1e-0000-4000-8000-0000000000c2',
        amountMinor: minorOf(5000),
      },
    })
    expect(tooMuch.status).toBe(400)
    expect((tooMuch.data as { code: string }).code).toBe('POS_TRANSFER_EXCEEDS_CASH')

    const capital = await engine.request<{ alreadyRecorded: boolean }>({
      method: 'POST',
      path: '/pos/opening-capital',
      body: {
        entryId: '9b2f4c1e-0000-4000-8000-0000000000d1',
        amountMinor: minorOf(250),
        into: 'till',
        sessionId: session.id,
      },
    })
    expect(capital.status).toBe(201)

    const entries = db.all<{ debit: number; credit: number }>(
      `SELECT SUM(l.debit) AS debit, SUM(l.credit) AS credit
       FROM journal_entry e JOIN journal_line l ON l.journal_id = e.id
       WHERE e.source_type IN ('till_transfer', 'opening_capital') GROUP BY e.id`,
    )
    expect(entries).toHaveLength(2)
    for (const entry of entries) expect(entry.debit).toBe(entry.credit)

    // expected = 1000 − 400 (to bank) + 250 (capital)
    const detail = await engine.request<{ totals: Totals }>({
      method: 'GET',
      path: `/pos/sessions/${session.id}`,
    })
    expect(detail.data.totals.expectedCashMinor).toBe(minorOf(850))
  })

  it('closes: refuses a missing count and an unexplained variance, then freezes and books', async () => {
    const { engine, open, db } = setup()
    const session = await open(1000)
    await engine.request({
      method: 'POST',
      path: `/pos/sessions/${session.id}/orders`,
      body: {
        orderRef: 'ORD-DEVICE-CLOSE',
        totalMinor: minorOf(500),
        changeMinor: 0,
        payments: [{ method: 'cash', amountMinor: minorOf(500) }],
      },
    })

    const unexplained = await engine.request({
      method: 'POST',
      path: `/pos/sessions/${session.id}/close`,
      body: { countedCashMinor: minorOf(1000) },
    })
    expect(unexplained.status).toBe(400)
    expect((unexplained.data as { code: string; message: string }).message).toContain(
      'POS_VARIANCE_REASON_REQUIRED',
    )

    const closed = await engine.request<{
      session: { status: string }
      totals: Totals
      posted: boolean
    }>({
      method: 'POST',
      path: `/pos/sessions/${session.id}/close`,
      body: { countedCashMinor: minorOf(1500) },
    })
    expect(closed.status).toBe(200)
    expect(closed.data.session.status).toBe('closed')
    expect(closed.data.totals.varianceMinor).toBe(0)
    expect(closed.data.posted).toBe(true)

    // Booked once, balanced, and linked to the session.
    const row = db.get<{ journal_entry_id: string | null }>(
      'SELECT journal_entry_id FROM pos_session WHERE id = ?',
      [session.id],
    )
    expect(row?.journal_entry_id).toBeTruthy()
    const sums = db.get<{ debit: number; credit: number }>(
      'SELECT SUM(debit) AS debit, SUM(credit) AS credit FROM journal_line WHERE journal_id = ?',
      [row!.journal_entry_id],
    )
    expect(sums?.debit).toBe(sums?.credit)

    // A second close finds nothing open, and a closed till takes no more orders.
    const twice = await engine.request({
      method: 'POST',
      path: `/pos/sessions/${session.id}/close`,
      body: { countedCashMinor: minorOf(1500) },
    })
    expect(twice.status).toBeGreaterThanOrEqual(400)
    const late = await engine.request({
      method: 'POST',
      path: `/pos/sessions/${session.id}/orders`,
      body: {
        orderRef: 'ORD-DEVICE-LATE',
        totalMinor: 1,
        changeMinor: 0,
        payments: [{ method: 'cash', amountMinor: 1 }],
      },
    })
    expect(late.status).toBeGreaterThanOrEqual(400)

    // The handover is read back as stored.
    const history = await engine.request<
      { id: string; handoverFrozen: boolean; expectedCashMinor: number }[]
    >({ method: 'GET', path: '/pos/sessions/history' })
    expect(history.data[0]).toMatchObject({
      id: session.id,
      handoverFrozen: true,
      expectedCashMinor: minorOf(1500),
    })

    // A voided order after the close is refused: the books already hold it.
    const orderId = db.get<{ id: string }>('SELECT id FROM pos_order WHERE session_id = ?', [
      session.id,
    ])!.id
    const voidLate = await engine.request({ method: 'POST', path: `/pos/orders/${orderId}/void` })
    expect(voidLate.status).toBe(409)
  })

  it('voids an order while open (twice is one void) and shows cash flow by day', async () => {
    const { engine, open, db } = setup()
    const session = await open(0)
    await engine.request({
      method: 'POST',
      path: `/pos/sessions/${session.id}/orders`,
      body: {
        orderRef: 'ORD-DEVICE-VOID',
        totalMinor: minorOf(100),
        changeMinor: 0,
        payments: [{ method: 'cash', amountMinor: minorOf(100) }],
      },
    })
    const orderId = db.get<{ id: string }>('SELECT id FROM pos_order LIMIT 1')!.id
    const v1 = await engine.request({ method: 'POST', path: `/pos/orders/${orderId}/void` })
    expect(v1.status).toBe(200)
    const v2 = await engine.request({ method: 'POST', path: `/pos/orders/${orderId}/void` })
    expect(v2.status).toBe(200)
    const totals = await engine.request<{ totals: Totals }>({
      method: 'GET',
      path: `/pos/sessions/${session.id}`,
    })
    expect(totals.data.totals.expectedCashMinor).toBe(0)

    const flow = await engine.request<{ days: unknown[]; currency: string }>({
      method: 'GET',
      path: '/pos/cash-flow?days=7&offsetMinutes=0',
    })
    expect(flow.status).toBe(200)
    expect(flow.data.days).toHaveLength(7)
    expect(flow.data.currency).toBe('AFN')

    const open2 = await engine.request<unknown[]>({ method: 'GET', path: '/pos/sessions/open' })
    expect(open2.data).toHaveLength(1)
    const abandoned = await engine.request<unknown[]>({
      method: 'GET',
      path: '/pos/sessions/abandoned',
    })
    expect(abandoned.data).toEqual([])
  })
})
