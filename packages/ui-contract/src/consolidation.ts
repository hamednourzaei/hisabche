// ============================================
// packages/ui-contract/src/consolidation.ts
//
// PHASE 8 — one conceptual truth per question, stated once.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A MAP AND NOT A MIGRATION
//
// §18 asks for one underlying event model. The repository has four stores that
// all look like "things that happened": `activities`, `audit_logs`,
// `event_log`, and the notification bell.
//
// The tempting reading is "merge them". §18 explicitly forbids that —
// "Do not merge tables blindly" — and it is right: they are on a live
// financial ledger, they have different retention needs, and `audit_logs` in
// particular is the record you must be able to hand to someone who does not
// trust you. Rewriting it to save a table is a bad trade.
//
// What was actually wrong was not the four tables. It was that nothing said
// WHICH ONE ANSWERS WHICH QUESTION, so each new feature picked one by
// proximity and the fifth store was always one sprint away.
//
// This file is that statement, and `consolidation.test.ts` makes it binding:
// a fifth event store, a second customer-like entity, or two navigation paths
// to one destination all fail the build.
//
// ---------------------------------------------------------------------------
// CONSOLIDATION IS SUBTRACTIVE
//
// Every entry below is a place the product decided NOT to have a second
// system. The list only shrinks by proving a duplicate was never needed, and
// grows only when a genuinely new question appears.
// ============================================

/* ─── One event model, four views ─────────────────────────────────────────── */

export const EVENT_STORES = ['activities', 'audit_logs', 'event_log', 'notifications'] as const
export type EventStore = (typeof EVENT_STORES)[number]

export interface EventStoreSpec {
  readonly store: EventStore
  /** The one question it answers. If two stores answer it, one is redundant. */
  readonly question: string
  /** Who reads it. */
  readonly audience: 'user' | 'operator' | 'auditor'
  /** Whether a row may ever be edited or removed. */
  readonly mutable: boolean
}

/**
 * ⚠️ These four are NOT interchangeable, and the differences are the reason
 * they were not merged.
 */
export const EVENT_MODEL: readonly EventStoreSpec[] = [
  {
    store: 'activities',
    question: 'what happened to this record, in business language',
    audience: 'user',
    // A feed entry can be marked read, and old ones are collected.
    mutable: true,
  },
  {
    store: 'audit_logs',
    // The one you hand to somebody who does not trust you. Immutable is the
    // whole value: an audit trail that can be edited proves nothing.
    question: 'who did this, when, and from where',
    audience: 'auditor',
    mutable: false,
  },
  {
    store: 'event_log',
    // The fan-out helper: one call from any module writes the feed AND the
    // bell, so a new module does not have to remember both.
    question: 'what should be broadcast to the feed and the bell',
    audience: 'operator',
    mutable: true,
  },
  {
    store: 'notifications',
    question: 'what is waiting for this person to look at',
    audience: 'user',
    mutable: true,
  },
]

/* ─── One object per business concept ─────────────────────────────────────── */

/**
 * Concepts that look alike and are deliberately kept apart, with the reason.
 *
 * §13 asks to avoid duplicate Customer/Supplier systems "unless the repository
 * proves separate domain requirements". It does: a customer carries a
 * receivable and a supplier carries a payable, they sit on opposite sides of
 * the ledger, and a single "party" table would need a discriminator on every
 * financial query — which is the same duplication, moved somewhere harder to
 * see.
 */
export const SEPARATE_BY_DESIGN: ReadonlyArray<{
  readonly concepts: readonly [string, string]
  readonly reason: string
}> = [
  {
    concepts: ['customer', 'supplier'],
    reason: 'opposite sides of the ledger — receivable against payable',
  },
  {
    concepts: ['activities', 'audit_logs'],
    reason: 'one is a feed a user can clear; the other must never change',
  },
  {
    concepts: ['invoice', 'purchase_order'],
    reason: 'a sale and a purchase move stock and money in opposite directions',
  },
]

/**
 * Concepts that must NEVER get a second implementation.
 *
 * Each of these already has exactly one home, and a second one would create
 * the "two financial engines" §79 forbids.
 */
export const SINGLE_IMPLEMENTATION = [
  'ledger posting',
  'stock movement',
  'money rounding',
  'tenancy boundary',
  'capability check',
  'sync conflict resolution',
] as const

export type SingleImplementationConcept = (typeof SINGLE_IMPLEMENTATION)[number]

export function isSeparateByDesign(a: string, b: string): boolean {
  return SEPARATE_BY_DESIGN.some(
    ({ concepts }) =>
      (concepts[0] === a && concepts[1] === b) || (concepts[0] === b && concepts[1] === a),
  )
}
