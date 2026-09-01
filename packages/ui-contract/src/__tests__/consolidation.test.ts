// ============================================
// PHASE 8 + 13 — the duplicates that must not appear, and the fence around AI.
//
// These read the backend's source, the same way `nav-destinations` reads the
// filesystem: "is there a fifth event store" is a fact about what got written,
// and no type can see it.
// ============================================

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { NAV_CONTRACT } from '../navigation'
import {
  EVENT_MODEL,
  EVENT_STORES,
  SEPARATE_BY_DESIGN,
  SINGLE_IMPLEMENTATION,
  isSeparateByDesign,
} from '../consolidation'
import {
  FORBIDDEN_DECISIONS,
  SUGGESTION_KINDS,
  gate,
  isPresentable,
  mayAutoApply,
  mayDecide,
  type Suggestion,
} from '../intelligence'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const SERVICES = join(ROOT, 'backend', 'src', 'services')

/* ─── PHASE 8 ─────────────────────────────────────────────────────────────── */

describe('one event model, four views — and no fifth', () => {
  it('describes every store exactly once', () => {
    expect(EVENT_MODEL.map((spec) => spec.store).sort()).toEqual([...EVENT_STORES].sort())
  })

  it('gives each store a DIFFERENT question', () => {
    // Two stores answering one question means one of them is redundant, which
    // is the state §18 exists to prevent.
    const questions = EVENT_MODEL.map((spec) => spec.question)
    expect(new Set(questions).size).toBe(questions.length)
  })

  it('keeps the audit trail immutable — that is its entire value', () => {
    const audit = EVENT_MODEL.find((spec) => spec.store === 'audit_logs')
    expect(audit?.mutable).toBe(false)
    expect(audit?.audience).toBe('auditor')
  })

  it('finds no event-shaped service outside the four', () => {
    // The real guard: a new `timeline.service.ts` or `history.service.ts` is
    // the fifth truth arriving, and it should have to argue for itself here
    // rather than appear quietly.
    const known = new Set([
      'activity.service.ts',
      'audit.service.ts',
      'event.service.ts',
      'event-log.service.ts',
      'notification.service.ts',
    ])

    const eventish = readdirSync(SERVICES).filter(
      (file) =>
        /(event|activity|audit|notification|timeline|history|feed)/i.test(file) &&
        file.endsWith('.service.ts'),
    )

    const unexpected = eventish.filter((file) => !known.has(file))
    expect(
      unexpected,
      'a fifth event truth appeared — add it to EVENT_MODEL or fold it in',
    ).toEqual([])
  })
})

describe('one object per business concept', () => {
  it('records a reason for every pair kept apart', () => {
    // "They are just different" is not a reason. Each pair has to say what
    // would break if they were merged, or the separation is unexamined.
    for (const entry of SEPARATE_BY_DESIGN) {
      expect(entry.reason.length).toBeGreaterThan(20)
      expect(entry.concepts[0]).not.toBe(entry.concepts[1])
    }
  })

  it('answers symmetrically', () => {
    expect(isSeparateByDesign('customer', 'supplier')).toBe(true)
    expect(isSeparateByDesign('supplier', 'customer')).toBe(true)
    expect(isSeparateByDesign('customer', 'product')).toBe(false)
  })

  it('names the things that must never get a second implementation', () => {
    expect(SINGLE_IMPLEMENTATION).toContain('ledger posting')
    expect(SINGLE_IMPLEMENTATION).toContain('tenancy boundary')
  })
})

describe('no destination is reachable by two paths', () => {
  it('has a unique path per nav id', () => {
    // Two routes to one screen is the navigation form of a duplicate truth:
    // bookmarks diverge, the sidebar highlights the wrong entry, and the
    // breadcrumb disagrees with both.
    const paths = NAV_CONTRACT.map((item) => item.path)
    expect(new Set(paths).size, 'two destinations share a path').toBe(paths.length)
  })

  it('has a unique id per destination', () => {
    const ids = NAV_CONTRACT.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

/* ─── PHASE 13 ────────────────────────────────────────────────────────────── */

const suggestion = (over: Partial<Suggestion<string>> = {}): Suggestion<string> => ({
  kind: 'column_mapping',
  value: 'fullName',
  confidence: 'high',
  evidence: ['header reads "customer name"'],
  verifiedBy: 'exact-alias-match',
  ...over,
})

describe('the AI fence', () => {
  it('never lets a forbidden decision appear as a suggestible kind', () => {
    // The one overlap that would quietly undo the whole boundary.
    for (const forbidden of FORBIDDEN_DECISIONS) {
      expect(SUGGESTION_KINDS as readonly string[]).not.toContain(forbidden)
    }
  })

  it('refuses every decision on the deny-list', () => {
    for (const forbidden of FORBIDDEN_DECISIONS) {
      expect(mayDecide(forbidden), forbidden).toBe(false)
    }
  })

  it('permits the ordinary ones', () => {
    expect(mayDecide('column_mapping')).toBe(true)
  })
})

describe('a suggestion with no evidence is not a weak signal — it is none', () => {
  it('is not presentable', () => {
    expect(isPresentable(suggestion({ evidence: [] }))).toBe(false)
  })

  it('and certainly not appliable', () => {
    expect(mayAutoApply(suggestion({ evidence: [] }))).toBe(false)
  })
})

describe('applying versus showing', () => {
  it('will not apply without a deterministic check', () => {
    // "Nobody wrote the check" and "the check passed" must never look alike.
    expect(mayAutoApply(suggestion({ verifiedBy: null }))).toBe(false)
  })

  it('will not apply on low confidence', () => {
    // Still shown — the user may act on it themselves. It just may not act on
    // its own, which is the line between a hint and an automation.
    const low = suggestion({ confidence: 'low' })
    expect(isPresentable(low)).toBe(true)
    expect(mayAutoApply(low)).toBe(false)
  })

  it('applies a checked, confident, evidenced suggestion', () => {
    expect(mayAutoApply(suggestion())).toBe(true)
  })
})

describe('the gate explains itself', () => {
  it.each([
    ['ledger_posting', suggestion(), 'FORBIDDEN_DECISION'],
    ['column_mapping', suggestion({ evidence: [] }), 'NO_EVIDENCE'],
    ['column_mapping', suggestion({ verifiedBy: null }), 'NO_DETERMINISTIC_CHECK'],
    ['column_mapping', suggestion({ confidence: 'low' }), 'CONFIDENCE_TOO_LOW'],
  ] as const)('%s → %s', (decision, input, reason) => {
    // The caller has to tell a user WHY. "Not confident enough" and "not
    // allowed to decide this" are different sentences, and only the second is
    // permanent.
    expect(gate(decision, input)).toEqual({ allowed: false, reason })
  })

  it('allows the clean case', () => {
    expect(gate('column_mapping', suggestion())).toEqual({ allowed: true })
  })

  it('refuses a forbidden decision even when everything else is perfect', () => {
    expect(gate('authorization', suggestion())).toMatchObject({ reason: 'FORBIDDEN_DECISION' })
  })
})
