// ============================================
// backend/src/__tests__/sod-rule-coverage.test.ts
//
// J5 — a segregation-of-duties rule that cannot fire.
//
// ---------------------------------------------------------------------------
// WHAT THIS EXISTS TO CATCH
//
// `SOD_RULES` shipped with five rules. Two of them had never been capable of
// blocking anything, and nothing said so:
//
//   • `account.manage-then-post` needed a prior `account.manage`. Nothing has
//     ever recorded that capability, and it would have been filed against an
//     ACCOUNT while the check queries a JOURNAL ENTRY.
//   • `conflict.raise-then-resolve` needed a prior `invoice.update`. Same:
//     never recorded, and on the wrong entity if it had been.
//   • `invoice.create-then-delete` was coherent but had neither half wired —
//     no `assertAllowed` on delete, no `recordAction` on create.
//
// So three of five rules were decoration. `GET /api/governance/sod` listed
// them as active, an owner reading that list would believe the separations
// were held, and every unit test passed because `checkSoD` is a pure function
// that was fed its prior actions by hand.
//
// That is the shape lesson 61 warns about: a test that exercises the decision
// and never the wiring. This one reads the CALL SITES.
//
// ---------------------------------------------------------------------------
// THE TWO HALVES
//
// For every rule, both must exist in real service code:
//
//   1. the action is CHECKED  — sod.assertAllowed(ctx, <capability>, <entity>)
//   2. the conflict is RECORDED — sod.recordAction(ctx, <conflict>, <entity>)
//
// And both must name the rule's own `entityType`, because
// `SoDService.priorActions` looks up by `(entity_type, entity_id)`. A rule
// whose halves sit on different entity types is filed under a key the check
// never queries — silently allowed, forever.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { SOD_RULES } from '../services/authorization'

const SERVICES = join(__dirname, '..', 'services')

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path))
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) {
      out.push(path)
    }
  }
  return out
}

const corpus = sourceFiles(SERVICES)
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n')

/**
 * Every `(call, capability, entityType)` triple actually present in the code.
 *
 * Parsed rather than string-matched so that `assertAllowed(ctx,
 * 'invoice.delete', 'journal_entry', ...)` — the right capability against the
 * wrong entity — is a MISS, not a hit. That mismatch is the exact defect the
 * two removed rules had.
 *
 * ⚠️ Both arguments must be string LITERALS. A call site that passes a
 * variable is invisible here and will read as missing. That is deliberate: a
 * capability chosen at runtime cannot be statically proven to cover a rule,
 * and this guard is only worth having if it refuses to guess.
 */
function callSites(fn: 'assertAllowed' | 'recordAction'): Set<string> {
  const pattern = new RegExp(
    `sod\\.${fn}\\(\\s*[A-Za-z0-9_.]+\\s*,\\s*'([^']+)'\\s*,\\s*'([^']+)'`,
    'g',
  )
  const found = new Set<string>()
  for (const match of corpus.matchAll(pattern)) {
    found.add(`${match[1]}@${match[2]}`)
  }
  return found
}

const asserted = callSites('assertAllowed')
const recorded = callSites('recordAction')

describe('every SoD rule is wired at both ends', () => {
  it.each(SOD_RULES.map((rule) => [rule.id, rule] as const))(
    '%s — the action it governs is actually checked',
    (_id, rule) => {
      // Without this call the rule is a description of a control, not a
      // control. Nothing refuses, nothing warns, nothing is recorded.
      expect(asserted).toContain(`${rule.capability}@${rule.entityType}`)
    },
  )

  it.each(
    SOD_RULES.flatMap((rule) =>
      rule.conflictsWith.map((conflict) => [`${rule.id} ← ${conflict}`, rule, conflict] as const),
    ),
  )('%s — the conflicting action is actually recorded', (_label, rule, conflict) => {
    // Without this, `priorActions` comes back empty every time and the check
    // above always returns `allowed`. This is how `invoice.create-then-delete`
    // passed every test while protecting nothing.
    expect(recorded).toContain(`${conflict}@${rule.entityType}`)
  })
})

describe('the parser is strict enough to be worth trusting', () => {
  it('finds the call sites that do exist', () => {
    // If this set were empty the guard above would still be green for a rule
    // table that was also empty. Anchor it to something known-present.
    expect(asserted.size).toBeGreaterThan(0)
    expect(recorded).toContain('payment.record@payment')
  })

  it('does not match a call whose entity type differs', () => {
    // The removed `account.manage-then-post` shape: right capability, wrong
    // entity. If this ever passed, a cross-entity rule would look wired.
    expect(recorded).not.toContain('payment.record@journal_entry')
  })

  it('has no rule that names an entity type nothing uses', () => {
    const entities = new Set([...asserted, ...recorded].map((key) => key.split('@')[1]))
    for (const rule of SOD_RULES) {
      expect(entities).toContain(rule.entityType)
    }
  })
})
