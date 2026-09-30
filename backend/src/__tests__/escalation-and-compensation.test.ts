// ============================================
// Engine N17 (escalation) and N19 (compensation).
// Capabilities #68, #81.
//
// ⚠️ ESCALATION: THE FAILURE IS A DOCUMENT WAITING FOREVER IN AN EMPTY ROOM.
//
// The functions this replaced were correct about time and about direction, and
// wrong about the only thing that matters. `escalatedRole('manager', {toRole:
// 'owner'})` returned `'owner'` whether an owner existed or not. So a shop with
// no owner escalated a document into an empty room, the log said it had moved,
// and the document sat there until somebody noticed the log — which is nobody's
// job.
//
// That is the whole reason this is a rewrite and not a wiring job: wiring the
// old functions would have produced the silent failure they were already close
// to.
//
// ⚠️ COMPENSATION: THERE IS NO DELETE, AND THE TEST SAYS WHY.
//
// Every strategy is a FORWARD operation — reverse the entry, void the document,
// release the commitment. A compensating DELETE is forbidden because a process
// that dies mid-write never runs its compensation, and the half-written row is
// permanent. So `touchesBooks` is true for every command that moved money or
// stock, and the UI must be able to say that BEFORE the button rather than after
// the entry.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  compensationFor,
  decideEscalation,
  hoursWaiting,
  type EscalationInput,
} from '../services/workflow/escalation.domain'

const SINCE = '2026-01-01T00:00:00.000Z'
const at = (hours: number) => new Date(Date.parse(SINCE) + hours * 3_600_000)

const input = (over: Partial<EscalationInput> = {}): EscalationInput => ({
  currentRole: 'manager',
  holdersOf: () => 1,
  waitingSince: SINCE,
  now: at(30),
  policy: { afterHours: 24, toRole: 'owner' },
  escalationsSoFar: 0,
  ...over,
})

describe('N17 — escalation moves the QUESTION UP, and never decides it', () => {
  it('does not fire before the deadline', () => {
    expect(decideEscalation(input({ now: at(23) })).escalate).toBe(false)
  })

  it('fires exactly at the deadline', () => {
    expect(decideEscalation(input({ now: at(24) })).escalate).toBe(true)
  })

  it('moves it to the higher role', () => {
    const verdict = decideEscalation(input())

    expect(verdict).toMatchObject({ escalate: true, toRole: 'owner' })
  })

  it('NEVER lowers the role', () => {
    // An escalation that could lower the bar would let a document nobody
    // approved for two days become approvable by somebody junior.
    const verdict = decideEscalation(
      input({ currentRole: 'owner', policy: { afterHours: 1, toRole: 'seller' } }),
    )

    expect(verdict).toMatchObject({ escalate: false, reason: 'NO_HIGHER_ROLE' })
  })

  it('an owner-only policy never fires, because owner is the top', () => {
    expect(decideEscalation(input({ currentRole: 'owner' })).escalate).toBe(false)
  })

  it('a zero policy is off, not "fires immediately"', () => {
    // ⚠️ `afterHours: 0` read as "no deadline" once. It means DISABLED — a
    // policy with a zero deadline would escalate every step the instant it was
    // created.
    expect(decideEscalation(input({ policy: { afterHours: 0, toRole: 'owner' } }))).toMatchObject({
      escalate: false,
      reason: 'POLICY_OFF',
    })
  })

  it('no policy at all never escalates', () => {
    const verdict = decideEscalation(input({ policy: null }))

    // ⚠️ `reason` only exists on the refusal branch — a success carries
    // `hoursWaiting` instead. Narrowing first is what makes that visible.
    expect(verdict.escalate).toBe(false)
    expect(verdict.escalate === false && verdict.reason).toBe('POLICY_OFF')
  })
})

describe('N17 — an escalation into an empty role is REPORTED, never performed', () => {
  it('refuses when the target role holds nobody', () => {
    // ⚠️ THE reason this module exists. The old pair returned 'owner' without
    // asking whether an owner existed.
    const verdict = decideEscalation(input({ holdersOf: () => 0 }))

    expect(verdict).toMatchObject({
      escalate: false,
      reason: 'NO_ONE_TO_ESCALATE_TO',
      toRole: 'owner',
    })
  })

  it('a role with one holder is enough', () => {
    expect(decideEscalation(input({ holdersOf: () => 1 })).escalate).toBe(true)
  })

  it('stops after the configured number of escalations', () => {
    const verdict = decideEscalation(
      input({ escalationsSoFar: 2, policy: { afterHours: 24, toRole: 'owner', maxTimes: 2 } }),
    )

    expect(verdict).toMatchObject({ escalate: false, reason: 'EXHAUSTED' })
  })

  it('an unreadable timestamp escalates nobody', () => {
    // Escalating because a date could not be parsed would raise the bar on a
    // document for a reason nobody could explain.
    expect(hoursWaiting('not a date', at(99))).toBe(0)
    expect(decideEscalation(input({ waitingSince: 'not a date' })).escalate).toBe(false)
  })
})

describe('N19 — undo is a forward operation, never a delete', () => {
  it('every strategy is one of the four forward operations', () => {
    // ⚠️ THE point of the file. A fifth strategy named `delete` would be a
    // compensating DELETE, which the rules forbid: a process that dies mid-write
    // never runs its compensation and the half-written row is permanent.
    for (const kind of [
      'invoice_create',
      'invoice_cancel',
      'payment_record',
      'payment_cancel',
      'purchase_order_create',
      'stock_adjust',
      'budget_commit',
    ] as const) {
      expect(['reverse', 'void', 'release', 'none']).toContain(compensationFor(kind).strategy)
    }
  })

  it('anything that moved money says it touches the books', () => {
    expect(compensationFor('payment_record').touchesBooks).toBe(true)
    expect(compensationFor('invoice_create').touchesBooks).toBe(true)
    expect(compensationFor('stock_adjust').touchesBooks).toBe(true)
    expect(compensationFor('budget_commit').touchesBooks).toBe(false)
  })

  it('a cancelled invoice CANNOT be un-cancelled, and says why', () => {
    // ⚠️ Not a limitation to work around — a fact. Its number was issued, its
    // entries were reversed; reinstating it rewrites history. Re-recording is a
    // NEW invoice, and the product has to be able to say that.
    const plan = compensationFor('invoice_cancel')

    expect(plan.strategy).toBe('none')
    expect(plan.needsHuman).toBe(true)
    expect(plan.why).toContain('rewrites history')
  })

  it('a cancelled payment cannot be restored either', () => {
    expect(compensationFor('payment_cancel')).toMatchObject({ strategy: 'none', needsHuman: true })
  })

  it('a purchase order releases its budget rather than deleting it', () => {
    // A released commitment that later needs re-establishing must leave a trace.
    const plan = compensationFor('purchase_order_create')

    expect(plan.strategy).toBe('release')
    expect(plan.reason).toContain('releases the budget commitment')
  })

  it('a stock adjustment is undone by another movement', () => {
    const plan = compensationFor('stock_adjust')

    expect(plan.strategy).toBe('reverse')
    expect(plan.why).toContain('another movement')
  })

  it('every plan carries a reason the UI can show BEFORE anything happens', () => {
    for (const kind of ['invoice_create', 'payment_record', 'budget_commit'] as const) {
      const plan = compensationFor(kind)
      expect(plan.reason.length).toBeGreaterThan(10)
      expect(plan.why.length).toBeGreaterThan(10)
    }
  })
})
