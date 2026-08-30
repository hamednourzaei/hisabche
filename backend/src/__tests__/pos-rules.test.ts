// ============================================
// The till.
//
// Two things drive every test here: only CASH is in the drawer, and the
// expected figure is derived rather than stored — because the whole value of
// counting a drawer is that the two sides were arrived at independently.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  buildPosting,
  cashTakenMinor,
  expectedCashMinor,
  findAbandoned,
  movementsNetMinor,
  summarise,
  validateClose,
  validateMovement,
  validateOrder,
  type CashMovement,
  type PosOrder,
  type PosSession,
} from '../services/pos/pos.domain'

const session = (over: Partial<PosSession> = {}): PosSession => ({
  id: 's1',
  status: 'open',
  openingFloatMinor: 100_000, // 1,000 AFN float
  openedAt: '2026-06-15T08:00:00.000Z',
  openedBy: 'u1',
  ...over,
})

const order = (over: Partial<PosOrder> = {}): PosOrder => ({
  id: 'o1',
  orderRef: 'REF-1',
  totalMinor: 50_000,
  payments: [{ method: 'cash', amountMinor: 50_000 }],
  changeMinor: 0,
  status: 'completed',
  createdAt: '2026-06-15T09:00:00.000Z',
  ...over,
})

describe('only cash is in the drawer', () => {
  it('counts a cash sale', () => {
    expect(cashTakenMinor([order()])).toBe(50_000)
  })

  it('IGNORES a card payment entirely', () => {
    // The single most common way a till "goes missing" money that was never
    // there.
    const card = order({ payments: [{ method: 'card', amountMinor: 50_000 }] })
    expect(cashTakenMinor([card])).toBe(0)
  })

  it('counts only the cash half of a split payment', () => {
    const split = order({
      totalMinor: 80_000,
      payments: [
        { method: 'cash', amountMinor: 30_000 },
        { method: 'card', amountMinor: 50_000 },
      ],
    })
    expect(cashTakenMinor([split])).toBe(30_000)
  })

  it('nets the change back out of the drawer', () => {
    const withChange = order({
      totalMinor: 45_000,
      payments: [{ method: 'cash', amountMinor: 50_000 }],
      changeMinor: 5_000,
    })
    expect(cashTakenMinor([withChange])).toBe(45_000)
  })

  it('ignores a voided order', () => {
    expect(cashTakenMinor([order({ status: 'voided' })])).toBe(0)
  })

  it('counts a sale on credit as no cash at all', () => {
    const credit = order({ payments: [{ method: 'credit', amountMinor: 50_000 }] })
    expect(cashTakenMinor([credit])).toBe(0)
  })
})

describe('cash movements during a shift', () => {
  const movements: CashMovement[] = [
    { id: 'm1', kind: 'cash_in', amountMinor: 20_000, reason: 'float top-up', createdAt: '' },
    { id: 'm2', kind: 'cash_out', amountMinor: 5_000, reason: 'paid the delivery', createdAt: '' },
  ]

  it('adds what went in and subtracts what came out', () => {
    expect(movementsNetMinor(movements)).toBe(15_000)
  })

  it('REQUIRES a reason for every movement', () => {
    // Cash leaving a drawer with no stated reason is indistinguishable from
    // cash going missing.
    expect(validateMovement(session(), { amountMinor: 5_000, reason: '  ' })).toContain(
      'POS_MOVEMENT_REASON_REQUIRED',
    )
  })

  it('accepts a reasoned movement', () => {
    expect(validateMovement(session(), { amountMinor: 5_000, reason: 'banked excess' })).toEqual([])
  })

  it('refuses a movement on a closed session', () => {
    expect(
      validateMovement(session({ status: 'closed' }), { amountMinor: 100, reason: 'x' }),
    ).toContain('POS_SESSION_NOT_OPEN')
  })
})

describe('the expected figure is derived', () => {
  it('is float plus cash taken plus movements', () => {
    const expected = expectedCashMinor(
      session(),
      [order()],
      [{ id: 'm1', kind: 'cash_out', amountMinor: 10_000, reason: 'x', createdAt: '' }],
    )
    expect(expected).toBe(100_000 + 50_000 - 10_000)
  })

  it('is just the float when nothing was sold', () => {
    expect(expectedCashMinor(session(), [], [])).toBe(100_000)
  })
})

describe('taking an order', () => {
  it('accepts a fully-paid order', () => {
    expect(
      validateOrder(session(), {
        totalMinor: 50_000,
        payments: [{ method: 'cash', amountMinor: 50_000 }],
        changeMinor: 0,
      }),
    ).toEqual([])
  })

  it('REFUSES an under-payment', () => {
    // Under-payment at a till is not a partial sale. It is a sale on credit,
    // with a receivable behind it.
    expect(
      validateOrder(session(), {
        totalMinor: 50_000,
        payments: [{ method: 'cash', amountMinor: 30_000 }],
        changeMinor: 0,
      }),
    ).toContain('POS_PAYMENT_SHORT')
  })

  it('refuses change larger than the cash taken', () => {
    // Giving change against a card payment hands out the drawer's float.
    expect(
      validateOrder(session(), {
        totalMinor: 50_000,
        payments: [{ method: 'card', amountMinor: 50_000 }],
        changeMinor: 5_000,
      }),
    ).toContain('POS_CHANGE_EXCEEDS_CASH')
  })

  it('refuses a negative payment', () => {
    expect(
      validateOrder(session(), {
        totalMinor: 0,
        payments: [{ method: 'cash', amountMinor: -100 }],
        changeMinor: 0,
      }),
    ).toContain('POS_PAYMENT_NEGATIVE')
  })

  it('refuses any order on a closed session', () => {
    expect(
      validateOrder(session({ status: 'closed' }), {
        totalMinor: 100,
        payments: [{ method: 'cash', amountMinor: 100 }],
        changeMinor: 0,
      }),
    ).toContain('POS_SESSION_NOT_OPEN')
  })

  it('accepts overpayment with change given back', () => {
    expect(
      validateOrder(session(), {
        totalMinor: 45_000,
        payments: [{ method: 'cash', amountMinor: 50_000 }],
        changeMinor: 5_000,
      }),
    ).toEqual([])
  })
})

describe('closing the drawer', () => {
  const totals = () => summarise(session(), [order()], [])

  it('computes the variance as counted less expected', () => {
    const summary = summarise(session({ countedCashMinor: 149_000 }), [order()], [])
    expect(summary.expectedCashMinor).toBe(150_000)
    expect(summary.varianceMinor).toBe(-1_000)
  })

  it('has NO variance until somebody has counted', () => {
    // Null and zero are different facts: one means nobody looked.
    expect(totals().varianceMinor).toBeNull()
  })

  it('requires a count', () => {
    expect(
      validateClose(session(), totals(), { countedCashMinor: null, role: 'manager' }),
    ).toContain('POS_COUNT_REQUIRED')
  })

  it('accepts a small variance without an explanation', () => {
    // A real drawer is out by a few units. Demanding a written reason for
    // every one of those trains people to type "ok".
    expect(
      validateClose(session(), totals(), { countedCashMinor: 149_950, role: 'seller' }),
    ).toEqual([])
  })

  it('REQUIRES an explanation once the variance is material', () => {
    expect(
      validateClose(session(), totals(), { countedCashMinor: 140_000, role: 'seller' }),
    ).toContain('POS_VARIANCE_REASON_REQUIRED')
  })

  it('accepts a material variance that is explained', () => {
    expect(
      validateClose(session(), totals(), {
        countedCashMinor: 140_000,
        varianceReason: 'gave a refund from the drawer without a receipt',
        role: 'seller',
      }),
    ).toEqual([])
  })

  it('lets only an owner force-close somebody else s session', () => {
    // Force-closing writes off whatever is missing from a drawer the closer
    // never saw.
    expect(
      validateClose(session(), totals(), {
        countedCashMinor: 150_000,
        force: true,
        role: 'manager',
      }),
    ).toContain('POS_FORCE_CLOSE_FORBIDDEN')

    expect(
      validateClose(session(), totals(), {
        countedCashMinor: 150_000,
        force: true,
        role: 'owner',
      }),
    ).toEqual([])
  })
})

describe('the session that never came back', () => {
  const stale = {
    session: session({ id: 'lost', openedAt: '2026-06-13T08:00:00.000Z' }),
    orders: [order(), order({ id: 'o2', orderRef: 'REF-2' })],
    movements: [],
  }
  const fresh = {
    session: session({ id: 'live', openedAt: '2026-06-15T07:00:00.000Z' }),
    orders: [],
    movements: [],
  }

  it('finds a session open far longer than a shift', () => {
    const found = findAbandoned([stale, fresh], '2026-06-15T09:00:00.000Z')
    expect(found.map((s) => s.sessionId)).toEqual(['lost'])
  })

  it('SAYS HOW MUCH CASH IS UNACCOUNTED', () => {
    // The money is in a drawer nobody can reach. Naming the figure is what
    // turns it from a mystery into a decision.
    const found = findAbandoned([stale], '2026-06-15T09:00:00.000Z')
    expect(found[0]!.expectedCashMinor).toBe(200_000)
    expect(found[0]!.orderCount).toBe(2)
  })

  it('leaves a closed session alone however old it is', () => {
    const closed = {
      ...stale,
      session: session({ id: 'done', status: 'closed', openedAt: '2020-01-01T00:00:00.000Z' }),
    }
    expect(findAbandoned([closed], '2026-06-15T09:00:00.000Z')).toEqual([])
  })

  it('does NOT close it automatically', () => {
    // Closing decides where the money went. That is a person's call.
    const found = findAbandoned([stale], '2026-06-15T09:00:00.000Z')
    expect(stale.session.status).toBe('open')
    expect(found).toHaveLength(1)
  })

  it('lists the longest-abandoned first', () => {
    const older = {
      session: session({ id: 'oldest', openedAt: '2026-06-01T08:00:00.000Z' }),
      orders: [],
      movements: [],
    }
    const found = findAbandoned([stale, older], '2026-06-15T09:00:00.000Z')
    expect(found[0]!.sessionId).toBe('oldest')
  })
})

describe('what a closed session posts', () => {
  it('debits cash at the COUNTED figure, not the expected one', () => {
    // What the business actually has.
    const closed = session({ countedCashMinor: 145_000 })
    const posting = buildPosting(closed, summarise(closed, [order()], []))
    expect(posting.cashMinor).toBe(45_000) // counted less the float
  })

  it('KEEPS the variance in its own figure, never netted into sales', () => {
    // A run of small shortages should read as a pattern, not dissolve into a
    // month of revenue.
    const closed = session({ countedCashMinor: 145_000 })
    const posting = buildPosting(closed, summarise(closed, [order()], []))
    expect(posting.varianceMinor).toBe(-5_000)
    expect(posting.revenueMinor).toBe(50_000)
  })

  it('separates card, transfer and credit from cash', () => {
    const mixed = order({
      totalMinor: 100_000,
      payments: [
        { method: 'cash', amountMinor: 40_000 },
        { method: 'card', amountMinor: 40_000 },
        { method: 'credit', amountMinor: 20_000 },
      ],
    })
    const closed = session({ countedCashMinor: 140_000 })
    const posting = buildPosting(closed, summarise(closed, [mixed], []))

    expect(posting.cardMinor).toBe(40_000)
    expect(posting.creditMinor).toBe(20_000)
  })

  it('carries the session id as its idempotency key', () => {
    // A retried close must not post the session twice.
    const closed = session({ countedCashMinor: 150_000 })
    expect(buildPosting(closed, summarise(closed, [], [])).sourceId).toBe('s1')
  })

  it('excludes the opening float from what arrived today', () => {
    // The float was already the business's money.
    const closed = session({ countedCashMinor: 100_000 })
    expect(buildPosting(closed, summarise(closed, [], [])).cashMinor).toBe(0)
  })
})
