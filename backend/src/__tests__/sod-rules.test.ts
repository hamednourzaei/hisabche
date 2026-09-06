// ============================================
// Segregation of duties.
//
// The distinction these tests exist to keep sharp: a capability check asks
// what a ROLE may do; SoD asks what a PERSON may do given what they already
// did to this document. An owner passes every capability check by definition,
// and an owner who records a payment and then cancels it is exactly the case
// SoD is for.
// ============================================

import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SOD_SETTINGS,
  SOD_RULES,
  activeRules,
  checkSoD,
  validateOverride,
  type PriorAction,
  type SoDSettings,
} from '../services/authorization'

const strict: SoDSettings = { mode: 'strict', disabledRules: [] }
const warn: SoDSettings = { mode: 'warn', disabledRules: [] }

const recordedBy = (actorId: string): PriorAction[] => [{ capability: 'payment.record', actorId }]

describe('off by default', () => {
  it('a fresh workspace enforces nothing', () => {
    // Most Hisabche workspaces are one or two people. A control that forces
    // them to share a login is worse than no control at all.
    expect(DEFAULT_SOD_SETTINGS.mode).toBe('off')
  })

  it('allows the conflicting pair while it is off', () => {
    const verdict = checkSoD({
      capability: 'payment.cancel',
      actorId: 'u1',
      role: 'owner',
      priorActions: recordedBy('u1'),
    })
    expect(verdict).toEqual({ kind: 'allowed' })
  })

  it('lists no rules as active while it is off', () => {
    expect(activeRules(DEFAULT_SOD_SETTINGS)).toEqual([])
  })
})

describe('the person who took the money may not erase it', () => {
  it('blocks the same actor cancelling their own payment', () => {
    const verdict = checkSoD(
      {
        capability: 'payment.cancel',
        actorId: 'u1',
        role: 'manager',
        priorActions: recordedBy('u1'),
      },
      strict,
    )
    expect(verdict.kind).toBe('blocked')
    if (verdict.kind === 'blocked') expect(verdict.ruleId).toBe('payment.record-then-cancel')
  })

  it("ALLOWS cancelling somebody else's payment", () => {
    // This is the whole point. A payment another person recorded is precisely
    // the one this actor is supposed to be able to cancel.
    const verdict = checkSoD(
      {
        capability: 'payment.cancel',
        actorId: 'u2',
        role: 'manager',
        priorActions: recordedBy('u1'),
      },
      strict,
    )
    expect(verdict).toEqual({ kind: 'allowed' })
  })

  it('blocks an OWNER too, in strict mode', () => {
    // Holding every capability is not an exemption from a separation of duties.
    const verdict = checkSoD(
      {
        capability: 'payment.cancel',
        actorId: 'u1',
        role: 'owner',
        priorActions: recordedBy('u1'),
      },
      strict,
    )
    expect(verdict.kind).toBe('blocked')
  })
})

describe('warn mode offers an owner a recorded way through', () => {
  it('asks an owner for an override rather than refusing outright', () => {
    const verdict = checkSoD(
      {
        capability: 'payment.cancel',
        actorId: 'u1',
        role: 'owner',
        priorActions: recordedBy('u1'),
      },
      warn,
    )
    expect(verdict.kind).toBe('requires_override')
  })

  it('still blocks a manager in warn mode', () => {
    const verdict = checkSoD(
      {
        capability: 'payment.cancel',
        actorId: 'u1',
        role: 'manager',
        priorActions: recordedBy('u1'),
      },
      warn,
    )
    expect(verdict.kind).toBe('blocked')
  })

  it('refuses an override with no reason', () => {
    const verdict = checkSoD(
      {
        capability: 'payment.cancel',
        actorId: 'u1',
        role: 'owner',
        priorActions: recordedBy('u1'),
      },
      warn,
    )
    expect(validateOverride(verdict, '')).toContain('SOD_OVERRIDE_REASON_REQUIRED')
  })

  it('refuses an override on a verdict that does not offer one', () => {
    expect(validateOverride({ kind: 'allowed' }, 'because')).toContain('SOD_OVERRIDE_NOT_PERMITTED')
  })

  it('accepts a reasoned override', () => {
    const verdict = checkSoD(
      {
        capability: 'payment.cancel',
        actorId: 'u1',
        role: 'owner',
        priorActions: recordedBy('u1'),
      },
      warn,
    )
    expect(validateOverride(verdict, 'sole proprietor; cash counted with the customer')).toEqual([])
  })
})

describe('posting and reversing the same entry', () => {
  it('blocks the poster from reversing their own entry', () => {
    const verdict = checkSoD(
      {
        capability: 'ledger.reverse',
        actorId: 'u1',
        role: 'owner',
        priorActions: [{ capability: 'ledger.post', actorId: 'u1' }],
      },
      strict,
    )
    expect(verdict.kind).toBe('blocked')
  })

  it('leaves an unrelated action alone', () => {
    const verdict = checkSoD(
      {
        capability: 'ledger.reverse',
        actorId: 'u1',
        role: 'owner',
        priorActions: [{ capability: 'customer.write', actorId: 'u1' }],
      },
      strict,
    )
    expect(verdict).toEqual({ kind: 'allowed' })
  })
})

describe('raising a document and removing it', () => {
  // J5 — this rule existed from the start and had never fired: nothing
  // recorded `invoice.create`, so `priorActions` was always empty and the
  // check always returned `allowed`. The wiring is proven by
  // `sod-rule-coverage.test.ts`; these are the decisions once it is wired.
  const created = (actorId: string): PriorAction[] => [{ capability: 'invoice.create', actorId }]

  it('blocks the same person deleting the invoice they raised', () => {
    const verdict = checkSoD(
      { capability: 'invoice.delete', actorId: 'u1', role: 'manager', priorActions: created('u1') },
      strict,
    )
    expect(verdict).toMatchObject({ kind: 'blocked', ruleId: 'invoice.create-then-delete' })
  })

  it('lets someone else delete it', () => {
    // The whole point: a second pair of eyes is exactly what the rule is for,
    // so it must not block the reviewer as well as the author.
    const verdict = checkSoD(
      { capability: 'invoice.delete', actorId: 'u2', role: 'manager', priorActions: created('u1') },
      strict,
    )
    expect(verdict).toEqual({ kind: 'allowed' })
  })

  it('offers an owner an override in warn mode', () => {
    const verdict = checkSoD(
      { capability: 'invoice.delete', actorId: 'u1', role: 'owner', priorActions: created('u1') },
      warn,
    )
    expect(verdict).toMatchObject({ kind: 'requires_override' })
    expect(validateOverride(verdict, '')).toContain('SOD_OVERRIDE_REASON_REQUIRED')
    expect(validateOverride(verdict, 'duplicate entry, confirmed with the customer')).toEqual([])
  })
})

describe('no rule spans two entity types', () => {
  it('states the entity both halves are filed under', () => {
    // `SoDService.priorActions` looks up by (entity_type, entity_id). A rule
    // whose halves live on different entities is filed under a key the check
    // never queries — allowed forever, silently. Two of the original five
    // rules were that shape; see the note in sod.domain.ts.
    for (const rule of SOD_RULES) {
      expect(rule.entityType).toMatch(/^[a-z_]+$/)
    }
  })
})

describe('a workspace can switch off one rule without switching off the rest', () => {
  const partial: SoDSettings = {
    mode: 'strict',
    disabledRules: ['payment.record-then-cancel'],
  }

  it('honours the disabled rule', () => {
    const verdict = checkSoD(
      {
        capability: 'payment.cancel',
        actorId: 'u1',
        role: 'manager',
        priorActions: recordedBy('u1'),
      },
      partial,
    )
    expect(verdict).toEqual({ kind: 'allowed' })
  })

  it('still enforces the others', () => {
    const verdict = checkSoD(
      {
        capability: 'ledger.reverse',
        actorId: 'u1',
        role: 'manager',
        priorActions: [{ capability: 'ledger.post', actorId: 'u1' }],
      },
      partial,
    )
    expect(verdict.kind).toBe('blocked')
  })

  it('reports what is actually in force', () => {
    expect(activeRules(partial)).toHaveLength(SOD_RULES.length - 1)
  })
})

describe('the rules are stated, not implied', () => {
  it('every rule carries a reason a refused person can read', () => {
    for (const rule of SOD_RULES) {
      expect(rule.rationale.length).toBeGreaterThan(20)
      expect(rule.conflictsWith.length).toBeGreaterThan(0)
    }
  })

  it('rule ids are unique', () => {
    expect(new Set(SOD_RULES.map((r) => r.id)).size).toBe(SOD_RULES.length)
  })

  it('ships its migration', () => {
    const docs = readdirSync(join(__dirname, '..', '..', '..', 'docs'))
    expect(docs).toContain('sod-migration.sql')
  })
})
