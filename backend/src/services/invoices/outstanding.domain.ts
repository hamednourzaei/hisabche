// ============================================
// backend/src/services/invoices/outstanding.domain.ts
//
// H1 — what «outstanding» means, in ONE place.
//
// ---------------------------------------------------------------------------
// WHY THIS IS ITS OWN MODULE
//
// The «بدهی مشتریان» card is now clickable and opens the invoice list. That
// only works if the list returns exactly the invoices the card summed. Two
// predicates written in two files — one reducing an array in
// `analytics.service`, one building a PostgREST query in `invoice.service` —
// will agree on the day they are written and drift on the next change to
// either. Then the user clicks a number and gets a list that does not add up
// to it, which is worse than a card that was never clickable.
//
// So the rule is stated once and both sides import it.
//
// ---------------------------------------------------------------------------
// ⚠️ THIS IS THE LEGACY PREDICATE, DELIBERATELY
//
// The rule is `status !== 'paid'` — the document word, not the settlement
// fact. Phase F introduced `settlement_status` (unpaid | partially_paid |
// paid), maintained by trigger from `payment_allocations`, and it is the
// better answer to this question.
//
// It is NOT used here, because the card's DISPLAYED NUMBER is computed from
// `status !== 'paid'`. Filtering the list on a different predicate would make
// the list disagree with the figure that opened it. Changing the KPI to match
// `settlement_status` changes a number a business already reads every morning
// — a product decision, not a refactor (§13: report, do not silently rewrite).
//
// Recorded as an open item in .claude/HANDOFF-PHASES-G-TO-O.md. When someone
// decides, BOTH sides change here, together, and stay in step by construction.
// ============================================

/** The one status that means nothing is owed on a sale. */
export const FULLY_PAID_STATUS = 'paid'

/**
 * Is money still owed on this invoice?
 *
 * Used by the KPI reduction. The query below must select exactly this set.
 */
export function isOutstanding(invoice: { status?: string | null | undefined }): boolean {
  return invoice.status !== FULLY_PAID_STATUS
}

/**
 * The same rule as a PostgREST filter, for `.or(...)`.
 *
 * ⚠️ THE NULL BRANCH IS NOT DECORATION. A bare `status.neq.paid` compiles to
 * `status <> 'paid'`, which is NULL — and therefore FALSE — for a row whose
 * status is NULL. `isOutstanding` counts that row as outstanding. Without the
 * `is.null` branch the two halves disagree on exactly the rows nobody thinks
 * about, and the list would quietly omit invoices the card had summed.
 *
 * `invoices.status` has a default and is not null today. This does not depend
 * on that staying true.
 *
 * Stated as a `neq` rather than an `in` over the remaining statuses so a status
 * added later (a `draft`, a `disputed`) is outstanding to BOTH halves rather
 * than to only one of them.
 */
export const OUTSTANDING_OR_FILTER = `status.is.null,status.neq.${FULLY_PAID_STATUS}`

/**
 * Does the filter select exactly what `isOutstanding` accepts?
 *
 * Exported so the guard test can run both halves over the same rows instead of
 * asserting that two strings look alike. The second half re-implements what
 * Postgres does with the `.or` above, NULL semantics included.
 */
export function outstandingPredicateAgrees(
  rows: { status?: string | null | undefined }[],
): boolean {
  const matchesFilter = (row: { status?: string | null | undefined }) =>
    row.status === null || row.status === undefined || row.status !== FULLY_PAID_STATUS

  return rows.every((row) => isOutstanding(row) === matchesFilter(row))
}
