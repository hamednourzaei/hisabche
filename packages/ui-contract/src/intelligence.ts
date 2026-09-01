// ============================================
// packages/ui-contract/src/intelligence.ts
//
// PHASE 13 — what intelligence may and may not decide.
//
// ---------------------------------------------------------------------------
// THE BOUNDARY IS THE FEATURE
//
// §70 puts intelligence last, "only after data truth, permissions, workflows
// and shared UX are stable". That ordering is usually read as "do it later".
// It is better read as: the thing to build first is the FENCE, because the
// moment a suggestion is allowed to write to the ledger, no amount of later
// governance can find the entries it already made.
//
// So this phase does not ship a model. It ships the rule §42 states — AI may
// suggest, never decide — as data a guard test can enforce, and a shape every
// suggestion in the product must take.
//
// ---------------------------------------------------------------------------
// A SUGGESTION IS NOT AN ANSWER
//
// Every `Suggestion` below carries its confidence, its evidence, and the
// deterministic check that has to pass before it can be acted on. A suggestion
// with no evidence cannot be rendered; one whose deterministic check has not
// run cannot be applied. That is what stops "the assistant said so" from
// becoming a reason a number changed.
// ============================================

/* ─── What may be suggested ───────────────────────────────────────────────── */

/**
 * §42's allow-list, verbatim in intent.
 *
 * Note what these have in common: each is a proposal a human can check at a
 * glance. "This column looks like a phone number" is verifiable by looking at
 * the column. "This invoice should post to account 4100" is not.
 */
export const SUGGESTION_KINDS = [
  'column_mapping',
  'source_detection',
  'duplicate_similarity',
  'data_quality_explanation',
  'plain_language_explanation',
] as const

export type SuggestionKind = (typeof SUGGESTION_KINDS)[number]

/**
 * §42's deny-list.
 *
 * These are not "not yet" — they are never. Each one either moves money,
 * decides who may see something, or cannot be undone. `intelligence.test.ts`
 * asserts that no member of this list appears in `SUGGESTION_KINDS`, so the
 * two can never quietly overlap.
 */
export const FORBIDDEN_DECISIONS = [
  'financial_truth',
  'ledger_posting',
  'destructive_merge',
  'authorization',
  'tenant_scope',
  'company_scope',
  'branch_scope',
  'irreversible_financial_transformation',
] as const

export type ForbiddenDecision = (typeof FORBIDDEN_DECISIONS)[number]

/* ─── The shape every suggestion takes ────────────────────────────────────── */

/**
 * Confidence, as a band rather than a number.
 *
 * A percentage invites false precision — nobody can tell 0.71 from 0.68, and
 * showing either implies a calibration the model does not have. Three bands
 * map onto the only three things a user actually does: accept, check, ignore.
 */
export type Confidence = 'high' | 'medium' | 'low'

export interface Suggestion<T> {
  readonly kind: SuggestionKind
  readonly value: T
  readonly confidence: Confidence
  /**
   * Why. At least one item, always — a suggestion that cannot say what it saw
   * is not reviewable, and an unreviewable suggestion is just an assertion.
   */
  readonly evidence: readonly string[]
  /**
   * The deterministic rule that must pass before this can be applied.
   *
   * `null` means no check exists YET, which makes the suggestion display-only.
   * It is spelled explicitly rather than omitted so that "nobody wrote the
   * check" and "the check passed" can never look the same.
   */
  readonly verifiedBy: string | null
}

/** A suggestion with no evidence is not shown. It is not a weak signal; it is none. */
export function isPresentable(suggestion: Suggestion<unknown>): boolean {
  return suggestion.evidence.length > 0
}

/**
 * May this suggestion be APPLIED — as opposed to merely shown?
 *
 * Two gates, and both are required:
 *   1. a deterministic check exists and is named
 *   2. the confidence is not `low`
 *
 * A low-confidence suggestion stays visible; the user may still act on it
 * themselves. What it may not do is apply itself, which is the difference
 * between a hint and an automation.
 */
export function mayAutoApply(suggestion: Suggestion<unknown>): boolean {
  if (!isPresentable(suggestion)) return false
  if (suggestion.verifiedBy === null) return false
  return suggestion.confidence !== 'low'
}

/**
 * Is this decision one intelligence is permitted to make at all?
 *
 * Called at the boundary, before a suggestion is even constructed. The answer
 * for anything on the deny-list is no, regardless of confidence, evidence or
 * who asked.
 */
export function mayDecide(decision: string): boolean {
  return !(FORBIDDEN_DECISIONS as readonly string[]).includes(decision)
}

/**
 * The gate every intelligence feature passes through.
 *
 * Returns the reason rather than a boolean, because the caller has to be able
 * to tell a user WHY a suggestion is not offered — "not confident enough" and
 * "the assistant is not allowed to decide this" are different sentences, and
 * only the second one is permanent.
 */
export type IntelligenceRefusal =
  'FORBIDDEN_DECISION' | 'NO_EVIDENCE' | 'NO_DETERMINISTIC_CHECK' | 'CONFIDENCE_TOO_LOW'

export function gate(
  decision: string,
  suggestion: Suggestion<unknown>,
): { allowed: true } | { allowed: false; reason: IntelligenceRefusal } {
  if (!mayDecide(decision)) return { allowed: false, reason: 'FORBIDDEN_DECISION' }
  if (!isPresentable(suggestion)) return { allowed: false, reason: 'NO_EVIDENCE' }
  if (suggestion.verifiedBy === null) return { allowed: false, reason: 'NO_DETERMINISTIC_CHECK' }
  if (suggestion.confidence === 'low') return { allowed: false, reason: 'CONFIDENCE_TOO_LOW' }
  return { allowed: true }
}
