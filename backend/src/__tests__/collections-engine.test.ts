// ============================================
// Engine N2 — collections and payment scheduling.
// Capabilities #51, #53, #66.
//
// ⚠️ WHAT IS WORTH DEFENDING HERE, AND IT IS NOT THE ARITHMETIC.
//
// `ageInvoices` already buckets, `outstandingOf` already derives. The arithmetic
// is theirs and it is already tested. What this module adds is a SEQUENCE, and a
// sequence has exactly one property that matters: it must not embarrass the shop.
//
// Four ways it can, all of them silent:
//
//   1. A REMINDER AFTER PAYMENT. Someone settles an invoice at 09:00 and reads
//      «your account is overdue» at 10:00. Nothing errors; the payment really was
//      made and the notice is still wrong.
//   2. THE SEQUENCE GOING BACKWARDS. A shop that escalated to a final demand in
//      month three and then sends a courtesy note in month eight has told the
//      customer it does not know its own process.
//   3. REMINDING EVERY DAY. A schedule that fires on every run instead of
//      advancing sends the same notice repeatedly, and the customer learns to
//      ignore the sender — which costs the shop the one channel it had.
//   4. A BROKEN SCHEDULE LOOKING LIKE A QUIET DAY. The worst of the four,
//      because the shop never finds out. It is its own verdict here for exactly
//      that reason.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_REMINDER_SETTINGS,
  collectionsFor,
  daysPastDue,
  isExhausted,
  planPayments,
  stepForDays,
  validateSteps,
  type CollectionsAction,
  type ReminderStep,
} from '../services/collections/collections.domain'
import type { OpenInvoice } from '../services/payments/payments.domain'

const AS_OF = '2026-09-30'

/**
 * An invoice owing money, due `dueDate`.
 *
 * ⚠️ `total` and `allocated` are MAJOR units — `OpenInvoice` is an aging shape
 * built straight from `invoices.total`, and `computeInvoiceMoney` produces major
 * too. This engine multiplies by 100 to compare in minor, which is why the
 * thresholds below are 100× the figures they read like.
 *
 * The first version used `total: 100_000` believing it was minor, which made the
 * debt 100,000,000 — larger than every threshold in the file, so both the
 * "below the minimum" and the "written off" cases reported `remind`. The engine
 * was right; the fixture was a factor of 100 off.
 */
const owing = (over: Partial<OpenInvoice> & { customerId?: string } = {}): OpenInvoice =>
  ({
    invoiceId: 'inv-1',
    invoiceNumber: 'INV-1',
    total: 1_000,
    allocated: 0,
    dueDate: '2026-09-27',
    invoiceDate: '2026-09-20',
    ...over,
  }) as OpenInvoice

const actionsOf = (
  invoices: OpenInvoice[],
  chased: { invoiceId: string; lastStepIndex: number | null }[] = [],
): CollectionsAction[] => {
  const verdict = collectionsFor(invoices, AS_OF, DEFAULT_REMINDER_SETTINGS, chased)
  return verdict.kind === 'remind' ? verdict.actions : []
}

describe('N2 — a settled debt is never chased', () => {
  it('an invoice with nothing outstanding produces no action', () => {
    // ⚠️ THE test that matters most. 100,000 due, 100,000 allocated — the money
    // is in, and `openInvoices` drops it before anything else looks at it.
    const verdict = collectionsFor([owing({ allocated: 1_000 })], AS_OF)

    expect(verdict.kind).toBe('nothing_to_do')
  })

  it('a paid invoice is skipped even when every step has passed', () => {
    const verdict = collectionsFor([owing({ allocated: 100_000, dueDate: '2026-01-01' })], AS_OF)

    expect(verdict.kind).toBe('nothing_to_do')
  })
})

describe('N2 — the sequence advances and never goes backwards', () => {
  it('the first reminder is the FIRST step, not the most overdue one', () => {
    const [action] = actionsOf([owing()])
    expect(action?.tone).toBe('courtesy')
    expect(action?.step.afterDays).toBe(3)
  })

  it('a chase already at step 2 continues from step 3', () => {
    // ⚠️ Due 1 August ⇒ 60 days late on 30 September, so the 45-day step IS due.
    // (The first version dated it 1 September — 29 days — and got no action at
    // all, which is the engine being right: the next step has not come round.)
    const [action] = actionsOf(
      [owing({ dueDate: '2026-08-01' })],
      [{ invoiceId: 'inv-1', lastStepIndex: 1 }],
    )

    expect(action?.tone).toBe('firm')
    expect(action?.step.afterDays).toBe(45)
  })

  it('a chase waits rather than jumping when the next step is not due yet', () => {
    // ⚠️ The other half of the test above, and the one that keeps a daily run
    // from skipping ahead: the sequence ADVANCES ONE STEP AT A TIME, at that
    // step's own date. 29 days late with step 1 sent means nothing today, not
    // «skip to firm because we are late».
    const verdict = collectionsFor(
      [owing({ dueDate: '2026-09-01' })],
      AS_OF,
      DEFAULT_REMINDER_SETTINGS,
      [{ invoiceId: 'inv-1', lastStepIndex: 1 }],
    )

    expect(verdict.kind).toBe('nothing_to_do')
  })

  it('a chase at the LAST step is finished, not repeated', () => {
    // ⚠️ The daily-repeat failure. 200 days late, all four steps sent — this
    // returns nothing, because sending the «final demand» again tomorrow is not
    // a reminder, it is a defect.
    const verdict = collectionsFor(
      [owing({ dueDate: '2025-01-01' })],
      AS_OF,
      DEFAULT_REMINDER_SETTINGS,
      [{ invoiceId: 'inv-1', lastStepIndex: 3 }],
    )

    expect(verdict.kind).toBe('nothing_to_do')
  })

  it('a chase ignored for two months resumes where it stopped, not at the start', () => {
    // ⚠️ `stepForDays` returns the LAST step at or before the days, so a long
    // silence does not restart the sequence and scold the customer from the
    // beginning.
    const steps = DEFAULT_REMINDER_SETTINGS.steps

    expect(stepForDays(5, steps)?.tone).toBe('courtesy')
    expect(stepForDays(50, steps)?.tone).toBe('firm')
    expect(stepForDays(200, steps)?.tone).toBe('final')
  })

  it('isExhausted is true only past a terminal step', () => {
    const steps = DEFAULT_REMINDER_SETTINGS.steps
    expect(isExhausted(80, steps)).toBe(true)
    expect(isExhausted(50, steps)).toBe(false)
  })
})

describe('N2 — a broken schedule is refused, loudly and at save time', () => {
  it('refuses a schedule whose dates go backwards', () => {
    const steps: ReminderStep[] = [
      { afterDays: 30, tone: 'formal', channel: 'email', terminal: false },
      { afterDays: 10, tone: 'firm', channel: 'email', terminal: false },
    ]

    expect(validateSteps(steps).map((p) => p.code)).toContain('COLLECTIONS_STEPS_UNORDERED')
  })

  it('refuses a tone that goes backwards', () => {
    // ⚠️ A «final demand» followed by a «courtesy note» is not a rounding
    // error — it is a shop that does not know its own process, told to a
    // customer.
    const steps: ReminderStep[] = [
      { afterDays: 10, tone: 'final', channel: 'email', terminal: true },
      { afterDays: 20, tone: 'courtesy', channel: 'notification', terminal: false },
    ]

    expect(validateSteps(steps).map((p) => p.code)).toContain('COLLECTIONS_TONE_DOWNGRADE')
  })

  it('refuses a same-day reminder', () => {
    const steps: ReminderStep[] = [
      { afterDays: 0, tone: 'courtesy', channel: 'notification', terminal: false },
    ]

    expect(validateSteps(steps).map((p) => p.code)).toContain('COLLECTIONS_STEP_TOO_SOON')
  })

  it('a broken schedule sends NOTHING and is reported as such', () => {
    // ⚠️ Its own verdict, not `nothing_to_do`. A quiet day closes the run; an
    // invalid schedule sends someone to fix it.
    const broken = {
      steps: [
        { afterDays: 30, tone: 'final' as const, channel: 'email' as const, terminal: true },
        {
          afterDays: 10,
          tone: 'courtesy' as const,
          channel: 'notification' as const,
          terminal: false,
        },
      ],
      minAmountMinor: 0,
      writeOffMinor: 0,
    }

    const verdict = collectionsFor([owing({ dueDate: '2026-01-01' })], AS_OF, broken)

    expect(verdict.kind).toBe('invalid_schedule')
    expect(verdict.kind === 'invalid_schedule' && verdict.problems.length).toBeGreaterThan(0)
  })

  it('the default schedule is valid', () => {
    expect(validateSteps(DEFAULT_REMINDER_SETTINGS.steps)).toEqual([])
  })
})

describe("N2 — chasing is bounded by the shop's own settings", () => {
  it('respects a grace period', () => {
    const relaxed = {
      ...DEFAULT_REMINDER_SETTINGS,
      steps: [
        {
          afterDays: 30,
          tone: 'courtesy' as const,
          channel: 'notification' as const,
          terminal: false,
        },
      ],
    }
    // Due 27 Sep, today is 30 Sep — three days late, so the 30-day step is not due.
    expect(actionsOf([], [])).toEqual([])
    const verdict = collectionsFor([owing()], AS_OF, relaxed)
    expect(verdict.kind).toBe('nothing_to_do')
  })

  it('does not chase a debt under the minimum', () => {
    // ⚠️ MINOR UNITS. The invoice owes 100,000 minor (1000.00), so a minimum of
    // 500,000 sits above it. The first version of this test wrote 500_000 while
    // treating the debt as 500_000 too, so the threshold looked like it did
    // nothing — and the test failed for the opposite reason to the one it names.
    const picky = { ...DEFAULT_REMINDER_SETTINGS, minAmountMinor: 500_000 }
    const verdict = collectionsFor([owing()], AS_OF, picky)

    expect(verdict).toEqual({ kind: 'nothing_to_do', reason: 'BELOW_MINIMUM', count: 1 })
  })

  it('chases a debt above the minimum', () => {
    const picky = { ...DEFAULT_REMINDER_SETTINGS, minAmountMinor: 50_000 }
    const [action] = (() => {
      const verdict = collectionsFor([owing()], AS_OF, picky)
      return verdict.kind === 'remind' ? verdict.actions : []
    })()

    expect(action?.invoiceId).toBe('inv-1')
  })

  it('a written-off debt is reported as written off, not chased', () => {
    // ⚠️ Its own verdict. A debt under the write-off line belongs in bad debt,
    // and a collections run that keeps chasing it is a shop arguing with itself.
    const forgiving = { ...DEFAULT_REMINDER_SETTINGS, writeOffMinor: 500_000 }
    const verdict = collectionsFor([owing()], AS_OF, forgiving)

    expect(verdict).toEqual({ kind: 'written_off', invoiceIds: ['inv-1'] })
  })
})

describe('N2 — day arithmetic ignores the time of day', () => {
  it('counts whole days', () => {
    expect(daysPastDue('2026-09-27', '2026-09-30')).toBe(3)
    expect(daysPastDue('2026-09-30', '2026-09-30')).toBe(0)
  })

  it('is negative before the due date, so "not due yet" is a sign', () => {
    expect(daysPastDue('2026-10-30', '2026-09-30')).toBe(-30)
  })
})

describe('#66 — a payment plan always foots', () => {
  it('splits a debt and the parts equal the whole', () => {
    const plan = planPayments(100_000, 3, '2026-10-01', AS_OF)

    expect(plan.payments).toBeDefined()
    expect(plan.payments!.reduce((sum, p) => sum + p.amountMinor, 0)).toBe(100_000)
  })

  it('the remainder lands on the LAST payment', () => {
    // ⚠️ Opposite of the installment engine, and deliberately: here the debt is
    // already owed and the FIRST payment is the one a customer will scrutinise.
    const plan = planPayments(100_000, 3, '2026-10-01', AS_OF)

    expect(plan.payments!.map((p) => p.amountMinor)).toEqual([33_333, 33_333, 33_334])
  })

  it('spans months from the first date', () => {
    const plan = planPayments(90_000, 3, '2026-10-01', AS_OF)

    expect(plan.payments!.map((p) => p.onDate)).toEqual(['2026-10-01', '2026-11-01', '2026-12-01'])
  })

  it('refuses a first payment dated today or earlier', () => {
    // ⚠️ A plan whose first payment is already due is chased the same day it was
    // agreed — an error with a date on it.
    expect(planPayments(100_000, 3, AS_OF, AS_OF).rule).toBe('SCHEDULE_DATE_IN_PAST')
  })

  it('refuses a zero debt', () => {
    expect(planPayments(0, 3, '2026-10-01', AS_OF).rule).toBe('SCHEDULE_AMOUNT_INVALID')
  })
})
