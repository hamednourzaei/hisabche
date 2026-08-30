// ============================================
// The rules engine.
//
// The property that matters most: a rule DECIDES and never performs. There is
// no `allow` action, nothing is evaluated as code, and an empty rule matches
// nothing rather than everything.
// ============================================

import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  evaluateCondition,
  evaluateGroup,
  evaluateRules,
  orderRules,
  readField,
  summarise,
  validateRule,
  type BusinessRule,
} from '../services/rules'

const rule = (over: Partial<BusinessRule> = {}): BusinessRule => ({
  id: 'r1',
  workspaceId: 'ws-1',
  name: 'Large invoices need the manager',
  entity: 'invoice',
  conditions: {
    match: 'all',
    conditions: [{ field: 'invoice.total', operator: 'gt', value: 5_000_000 }],
  },
  actions: [{ kind: 'require_approval', workflowId: 'wf-1' }],
  priority: 100,
  active: true,
  ...over,
})

describe('reading a fact', () => {
  const facts = { invoice: { total: 100, customer: { segment: 'vip' } } }

  it('reads a nested path', () => {
    expect(readField(facts, 'invoice.customer.segment')).toBe('vip')
  })

  it('returns undefined for a missing path rather than throwing', () => {
    expect(readField(facts, 'invoice.nothing.here')).toBeUndefined()
  })
})

describe('conditions', () => {
  const facts = { invoice: { total: 6_000_000, currency: 'AFN', tags: ['export'] }, note: '' }

  it('compares numbers', () => {
    expect(
      evaluateCondition({ field: 'invoice.total', operator: 'gt', value: 5_000_000 }, facts),
    ).toBe(true)
    expect(
      evaluateCondition({ field: 'invoice.total', operator: 'lt', value: 5_000_000 }, facts),
    ).toBe(false)
  })

  it('treats a numeric string and a number as equal', () => {
    // Money is a string from Postgres and a number from a client.
    expect(
      evaluateCondition({ field: 'invoice.total', operator: 'eq', value: '6000000' }, facts),
    ).toBe(true)
  })

  it('IS FALSE when the operands are not comparable', () => {
    // A rule that fires because a field was missing blocks work nobody can
    // explain. A rule that never fires is at least visibly not working.
    expect(evaluateCondition({ field: 'invoice.missing', operator: 'gt', value: 1 }, facts)).toBe(
      false,
    )
  })

  it('handles in, contains and between', () => {
    expect(
      evaluateCondition(
        { field: 'invoice.currency', operator: 'in', value: ['AFN', 'USD'] },
        facts,
      ),
    ).toBe(true)
    expect(
      evaluateCondition({ field: 'invoice.tags', operator: 'contains', value: 'export' }, facts),
    ).toBe(true)
    expect(
      evaluateCondition(
        { field: 'invoice.total', operator: 'between', value: [1_000_000, 9_000_000] },
        facts,
      ),
    ).toBe(true)
  })

  it('handles emptiness', () => {
    expect(evaluateCondition({ field: 'note', operator: 'is_empty' }, facts)).toBe(true)
    expect(evaluateCondition({ field: 'invoice.currency', operator: 'is_not_empty' }, facts)).toBe(
      true,
    )
  })

  it('refuses an operator it does not know', () => {
    expect(
      evaluateCondition({ field: 'invoice.total', operator: 'regex' as never, value: '.*' }, facts),
    ).toBe(false)
  })
})

describe('condition groups', () => {
  const facts = { invoice: { total: 100, currency: 'USD' } }

  it('all requires every condition', () => {
    const group = {
      match: 'all' as const,
      conditions: [
        { field: 'invoice.total', operator: 'gt' as const, value: 50 },
        { field: 'invoice.currency', operator: 'eq' as const, value: 'AFN' },
      ],
    }
    expect(evaluateGroup(group, facts)).toBe(false)
  })

  it('any requires one', () => {
    const group = {
      match: 'any' as const,
      conditions: [
        { field: 'invoice.total', operator: 'gt' as const, value: 50 },
        { field: 'invoice.currency', operator: 'eq' as const, value: 'AFN' },
      ],
    }
    expect(evaluateGroup(group, facts)).toBe(true)
  })

  it('AN EMPTY GROUP MATCHES NOTHING', () => {
    // A rule with no conditions that fired on everything would be the most
    // destructive possible default.
    expect(evaluateGroup({ match: 'all', conditions: [] }, facts)).toBe(false)
  })
})

describe('evaluating a set of rules', () => {
  const big = rule()
  const vip = rule({
    id: 'r2',
    name: 'VIP discount',
    priority: 50,
    conditions: {
      match: 'all',
      conditions: [{ field: 'customer.segment', operator: 'eq', value: 'vip' }],
    },
    actions: [{ kind: 'suggest_discount', percent: 3 }],
  })

  it('runs lower priority first', () => {
    const decisions = evaluateRules([big, vip], 'invoice', {
      invoice: { total: 9_000_000 },
      customer: { segment: 'vip' },
    })
    expect(decisions.map((d) => d.ruleId)).toEqual(['r2', 'r1'])
  })

  it('produces the same order every run, whatever the input order', () => {
    const facts = { invoice: { total: 9_000_000 }, customer: { segment: 'vip' } }
    expect(evaluateRules([big, vip], 'invoice', facts).map((d) => d.ruleId)).toEqual(
      evaluateRules([vip, big], 'invoice', facts).map((d) => d.ruleId),
    )
  })

  it('breaks a priority tie on id, not on fetch order', () => {
    const a = rule({ id: 'aaa', priority: 10 })
    const b = rule({ id: 'bbb', priority: 10 })
    expect(orderRules([b, a]).map((r) => r.id)).toEqual(['aaa', 'bbb'])
  })

  it('skips inactive rules', () => {
    expect(
      evaluateRules([rule({ active: false })], 'invoice', { invoice: { total: 9e9 } }),
    ).toEqual([])
  })

  it('skips rules for another entity', () => {
    expect(evaluateRules([big], 'payment', { invoice: { total: 9e9 } })).toEqual([])
  })

  it('stops when a rule says to', () => {
    const stopper = rule({ id: 'r0', priority: 1, stopOnMatch: true })
    const decisions = evaluateRules([stopper, big], 'invoice', { invoice: { total: 9_000_000 } })
    expect(decisions.map((d) => d.ruleId)).toEqual(['r0'])
  })

  it('names the rule behind every decision', () => {
    // "Why did this invoice need approval" must have an answer.
    const decisions = evaluateRules([big], 'invoice', { invoice: { total: 9_000_000 } })
    expect(decisions[0]!.ruleName).toBe('Large invoices need the manager')
  })
})

describe('summarising decisions', () => {
  it('reports the most restrictive outcome', () => {
    const decisions = evaluateRules(
      [
        rule({ id: 'r1', actions: [{ kind: 'require_approval', workflowId: 'wf-1' }] }),
        rule({ id: 'r2', actions: [{ kind: 'block', messageKey: 'over.limit' }] }),
      ],
      'invoice',
      { invoice: { total: 9_000_000 } },
    )

    const summary = summarise(decisions)
    expect(summary.blocked).toBe(true)
    expect(summary.requiresApproval).toBe(true)
    expect(summary.workflowIds).toEqual(['wf-1'])
  })

  it('is permissive when nothing matched', () => {
    const summary = summarise([])
    expect(summary.blocked).toBe(false)
    expect(summary.requiresApproval).toBe(false)
  })
})

describe('validation', () => {
  it('refuses a rule with no conditions', () => {
    expect(
      validateRule({
        name: 'x',
        conditions: { match: 'all', conditions: [] },
        actions: [{ kind: 'warn' }],
      }),
    ).toContain('RULE_NO_CONDITIONS')
  })

  it('refuses an approval with no chain behind it', () => {
    // It would block the document and give nobody the ability to unblock it.
    expect(
      validateRule({
        name: 'x',
        conditions: { match: 'all', conditions: [{ field: 'a', operator: 'eq', value: 1 }] },
        actions: [{ kind: 'require_approval' }],
      }),
    ).toContain('RULE_APPROVAL_NEEDS_WORKFLOW')
  })

  it('refuses a field name that is not a plain path', () => {
    expect(
      validateRule({
        name: 'x',
        conditions: {
          match: 'all',
          conditions: [{ field: 'a; drop table', operator: 'eq', value: 1 }],
        },
        actions: [{ kind: 'warn' }],
      }),
    ).toContain('RULE_FIELD_INVALID')
  })

  it('refuses a discount outside 0–100', () => {
    expect(
      validateRule({
        name: 'x',
        conditions: { match: 'all', conditions: [{ field: 'a', operator: 'eq', value: 1 }] },
        actions: [{ kind: 'suggest_discount', percent: 150 }],
      }),
    ).toContain('RULE_DISCOUNT_OUT_OF_RANGE')
  })

  it('accepts a well-formed rule', () => {
    expect(
      validateRule({
        name: 'Large invoices need the manager',
        conditions: {
          match: 'all',
          conditions: [{ field: 'invoice.total', operator: 'gt', value: 5_000_000 }],
        },
        actions: [{ kind: 'require_approval', workflowId: 'wf-1' }],
      }),
    ).toEqual([])
  })
})

describe('a rule can never widen what somebody may do', () => {
  it('has no action that grants anything', () => {
    // The action list is the whole surface. If an `allow` ever appears here,
    // rules become an authorization bypass a customer can configure.
    const decisions = evaluateRules([rule()], 'invoice', { invoice: { total: 9_000_000 } })
    for (const decision of decisions) {
      expect(['require_approval', 'block', 'warn', 'suggest_discount', 'notify', 'tag']).toContain(
        decision.action.kind,
      )
    }
  })

  it('ships its migration', () => {
    const docs = readdirSync(join(__dirname, '..', '..', '..', 'docs'))
    expect(docs).toContain('rules-engine-migration.sql')
  })
})
