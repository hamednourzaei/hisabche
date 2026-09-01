// ============================================
// "Why can't I do it?" — §17.
//
// A refusal the user cannot act on is a bug with good manners. Every case here
// is about whether the answer tells somebody what to DO.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  explain,
  wouldAHigherRoleHelp,
  type ExplainableRefusal,
} from '../services/authorization/explain.domain'
import { CAPABILITIES, minRoleFor } from '../services/authorization/authorization.domain'

const ALL: ExplainableRefusal[] = [
  'MISSING_CAPABILITY',
  'OUT_OF_BRANCH_SCOPE',
  'NOT_OWN_RECORD',
  'SOD_CONFLICT',
  'PERIOD_LOCKED',
]

describe('every refusal is explainable and actionable', () => {
  it.each(ALL)('%s names a reason and a resolver', (refusal) => {
    const explanation = explain(refusal)
    expect(explanation.reasonKey).toMatch(/^authz\.reason\./)
    expect(['owner', 'manager', 'nobody']).toContain(explanation.resolvedBy)
  })

  it('uses i18n keys, never a sentence', () => {
    // A refusal is read by a shopkeeper in Persian. An English string baked in
    // here would reach three platforms with no key for a translator to find.
    for (const refusal of ALL) {
      expect(explain(refusal).reasonKey).not.toMatch(/\s/)
    }
  })
})

describe('the cross-workspace case is absent on purpose', () => {
  it('cannot be explained', () => {
    // It is a 404 everywhere else so an outsider cannot confirm a row exists.
    // An explanation endpoint saying "that belongs to another workspace" would
    // undo that in one sentence — so the type does not permit it.
    expect(ALL).not.toContain('WRONG_WORKSPACE' as ExplainableRefusal)
  })
})

describe('separation of duties is the one refusal that is WORKING when it fires', () => {
  it('is resolved by nobody', () => {
    // Handing the same person both duties "fixes" it and destroys the control.
    const explanation = explain('SOD_CONFLICT')
    expect(explanation.resolvedBy).toBe('nobody')
    expect(explanation.needsSomeoneElse).toBe(false)
  })

  it('and a higher role does not help', () => {
    expect(wouldAHigherRoleHelp('SOD_CONFLICT', 'seller', 'owner')).toBe(false)
  })
})

describe('a branch scope is not fixed by a promotion', () => {
  it('says so', () => {
    // An owner pinned to Kabul is still pinned to Kabul. Saying otherwise
    // sends somebody to ask for a promotion that changes nothing.
    expect(wouldAHigherRoleHelp('OUT_OF_BRANCH_SCOPE', 'seller', 'owner')).toBe(false)
  })

  it('but points at the person who CAN change the assignment', () => {
    expect(explain('OUT_OF_BRANCH_SCOPE').resolvedBy).toBe('owner')
  })
})

describe('a missing capability is the case where a role change IS the answer', () => {
  it('helps when the actor ranks below what is required', () => {
    expect(wouldAHigherRoleHelp('MISSING_CAPABILITY', 'seller', 'manager')).toBe(true)
  })

  it('does not claim to help when they already hold the rank', () => {
    // Otherwise the answer is "ask for a promotion you already have".
    expect(wouldAHigherRoleHelp('MISSING_CAPABILITY', 'owner', 'manager')).toBe(false)
  })

  it("someone else's record is offered to a manager, not to the owner", () => {
    // A manager acting on it is faster than changing anybody's role.
    expect(explain('NOT_OWN_RECORD').resolvedBy).toBe('manager')
  })
})

describe('the required role is a real one for every capability', () => {
  it.each(CAPABILITIES)('%s resolves to a workspace role', (capability) => {
    // This is what lets the answer say "a manager can do this" rather than
    // printing `ledger.post` at somebody.
    expect(['owner', 'manager', 'seller']).toContain(minRoleFor(capability))
  })
})
