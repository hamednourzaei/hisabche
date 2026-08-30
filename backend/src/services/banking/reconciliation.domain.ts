// ============================================
// backend/src/services/banking/reconciliation.domain.ts
//
// Matching what the bank says against what the books say.
//
// ---------------------------------------------------------------------------
// A MATCH IS A PROPOSAL
//
// Everything here SUGGESTS. Nothing here reconciles. A confident-looking
// automatic match on the wrong payment moves money between two customers'
// accounts, and the person who finds out is the one who gets chased for a debt
// they already paid.
//
// So every candidate carries a score and the REASONS behind it, and a person
// confirms. High confidence means "you will probably click yes", never
// "already done".
//
// ---------------------------------------------------------------------------
// THE HARD PART IS NOT MATCHING, IT IS NOT MATCHING TWICE
//
// A statement line matched to a payment must become unavailable to every other
// line, and a re-imported statement must not create a second match for a line
// that was already reconciled. Both are handled by an idempotency key built
// from the bank's own reference, not from a row id we generated.
// ============================================

export interface StatementLine {
  id: string
  /** The bank's own identifier for this movement, if it gives one. */
  externalRef: string | null
  onDate: string
  /** Minor units. Positive is money IN, negative is money OUT. */
  amountMinor: number
  description: string
  /** Already matched to something. Excluded from further suggestions. */
  matchedTo?: string | null
}

export interface BookEntry {
  id: string
  kind: 'payment' | 'invoice' | 'journal'
  onDate: string
  /** Minor units, same sign convention as the statement. */
  amountMinor: number
  reference: string
  partyName?: string | null
  /** Already reconciled against a statement line. */
  reconciledWith?: string | null
}

export type MatchReason =
  | 'exact_reference'
  | 'exact_amount_and_date'
  | 'exact_amount'
  | 'amount_within_tolerance'
  | 'party_name'
  | 'date_proximity'

export interface MatchCandidate {
  statementLineId: string
  bookEntryId: string
  /** 0–1. Never 1 unless the bank's own reference matched. */
  score: number
  reasons: MatchReason[]
  /** Minor units. Non-zero means the amounts are close but not equal. */
  differenceMinor: number
  daysApart: number
}

function daysBetween(a: string, b: string): number {
  const left = Date.parse(`${a.slice(0, 10)}T00:00:00Z`)
  const right = Date.parse(`${b.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(left) || Number.isNaN(right)) return 999
  return Math.abs(Math.round((left - right) / 86_400_000))
}

/** Loose containment: a bank narrative rarely quotes a reference cleanly. */
function referenceMatches(description: string, reference: string): boolean {
  if (!reference || reference.length < 4) return false
  const haystack = description.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const needle = reference.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return needle.length >= 4 && haystack.includes(needle)
}

/**
 * Score one possible pairing.
 *
 * The amount must be in the right DIRECTION and the right ballpark before
 * anything else is considered: a deposit can never match a payment out, and
 * scoring on name similarity alone produces confident nonsense.
 */
export function scoreMatch(
  line: StatementLine,
  entry: BookEntry,
  toleranceMinor = 0,
): MatchCandidate | null {
  if (line.matchedTo || entry.reconciledWith) return null

  // Opposite directions are never the same movement.
  if (Math.sign(line.amountMinor) !== Math.sign(entry.amountMinor)) return null

  const differenceMinor = line.amountMinor - entry.amountMinor
  if (Math.abs(differenceMinor) > toleranceMinor) return null

  const daysApart = daysBetween(line.onDate, entry.onDate)
  // A month apart is not the same transaction, whatever the amount says.
  if (daysApart > 30) return null

  const reasons: MatchReason[] = []
  let score = 0

  if (referenceMatches(line.description, entry.reference)) {
    // The bank quoted our own reference. Nothing else comes close to this.
    reasons.push('exact_reference')
    score += 0.7
  }

  if (differenceMinor === 0) {
    if (daysApart === 0) {
      reasons.push('exact_amount_and_date')
      score += 0.5
    } else {
      reasons.push('exact_amount')
      score += 0.35
    }
  } else {
    reasons.push('amount_within_tolerance')
    score += 0.15
  }

  if (entry.partyName && referenceMatches(line.description, entry.partyName)) {
    reasons.push('party_name')
    score += 0.2
  }

  if (daysApart <= 3 && !reasons.includes('exact_amount_and_date')) {
    reasons.push('date_proximity')
    score += 0.1
  }

  // Only the bank's own reference earns certainty. Everything else is a
  // strong hint that a person still confirms.
  const capped = reasons.includes('exact_reference') ? Math.min(score, 1) : Math.min(score, 0.9)

  return {
    statementLineId: line.id,
    bookEntryId: entry.id,
    score: capped,
    reasons,
    differenceMinor,
    daysApart,
  }
}

export interface MatchSuggestion extends MatchCandidate {
  confidence: 'certain' | 'likely' | 'possible'
  /** True when this line has more than one plausible partner. */
  isAmbiguous: boolean
}

/**
 * Suggestions for a statement, best first.
 *
 * A line with two equally good candidates is marked AMBIGUOUS rather than
 * having one picked for it. Two invoices for the same amount from the same
 * customer in the same week is a completely ordinary situation, and the wrong
 * guess sends a receipt to the wrong invoice.
 */
export function suggestMatches(
  lines: StatementLine[],
  entries: BookEntry[],
  options: { toleranceMinor?: number; minScore?: number } = {},
): MatchSuggestion[] {
  const tolerance = options.toleranceMinor ?? 0
  const minScore = options.minScore ?? 0.3

  const suggestions: MatchSuggestion[] = []

  for (const line of lines) {
    const candidates = entries
      .map((entry) => scoreMatch(line, entry, tolerance))
      .filter((candidate): candidate is MatchCandidate => Boolean(candidate))
      .filter((candidate) => candidate.score >= minScore)
      .sort((a, b) => b.score - a.score)

    if (candidates.length === 0) continue

    const best = candidates[0]!
    const runnerUp = candidates[1]

    // "Equally good" means within a hair, not merely close. Two candidates at
    // 0.9 and 0.55 is not ambiguous; a person would pick the same one.
    const isAmbiguous = Boolean(runnerUp && best.score - runnerUp.score < 0.1)

    suggestions.push({
      ...best,
      confidence: best.score >= 0.95 ? 'certain' : best.score >= 0.6 ? 'likely' : 'possible',
      isAmbiguous,
    })
  }

  return suggestions.sort((a, b) => b.score - a.score)
}

// ─── The reconciliation itself ───────────────────────────────────────────────

export type ReconcileRuleCode =
  | 'RECONCILE_LINE_ALREADY_MATCHED'
  | 'RECONCILE_ENTRY_ALREADY_MATCHED'
  | 'RECONCILE_DIRECTION_MISMATCH'
  | 'RECONCILE_DIFFERENCE_UNEXPLAINED'

export function validateReconcile(
  line: StatementLine,
  entry: BookEntry,
  options: { toleranceMinor?: number; differenceReason?: string } = {},
): ReconcileRuleCode[] {
  const problems: ReconcileRuleCode[] = []

  if (line.matchedTo) problems.push('RECONCILE_LINE_ALREADY_MATCHED')
  if (entry.reconciledWith) problems.push('RECONCILE_ENTRY_ALREADY_MATCHED')

  if (Math.sign(line.amountMinor) !== Math.sign(entry.amountMinor)) {
    problems.push('RECONCILE_DIRECTION_MISMATCH')
  }

  const difference = line.amountMinor - entry.amountMinor

  // A difference is usually a bank charge, and writing it off is a real
  // accounting entry. It needs a reason so it lands somewhere on purpose.
  if (difference !== 0 && !options.differenceReason?.trim()) {
    problems.push('RECONCILE_DIFFERENCE_UNEXPLAINED')
  }

  return [...new Set(problems)]
}

export interface ReconciliationSummary {
  statementLines: number
  matchedLines: number
  unmatchedLines: number
  bookEntries: number
  matchedEntries: number
  unmatchedEntries: number
  /** Minor units. The bank's closing balance. */
  statementBalanceMinor: number
  /** Minor units. What the books say the account holds. */
  bookBalanceMinor: number
  /** statement − book. Anything but zero needs explaining. */
  differenceMinor: number
  /**
   * The unmatched items that ACCOUNT for the difference, so the gap is a list
   * rather than a number.
   */
  reconcilingItems: Array<{
    id: string
    side: 'statement' | 'book'
    amountMinor: number
    description: string
  }>
}

/**
 * The reconciliation statement itself.
 *
 * The point is not the difference figure — it is that the difference is
 * ENUMERATED. "Out by 4,300" is a problem; "out by 4,300, which is these three
 * uncleared cheques" is a reconciliation.
 */
export function summariseReconciliation(
  lines: StatementLine[],
  entries: BookEntry[],
  statementBalanceMinor: number,
  bookBalanceMinor: number,
): ReconciliationSummary {
  const unmatchedLines = lines.filter((line) => !line.matchedTo)
  const unmatchedEntries = entries.filter((entry) => !entry.reconciledWith)

  return {
    statementLines: lines.length,
    matchedLines: lines.length - unmatchedLines.length,
    unmatchedLines: unmatchedLines.length,
    bookEntries: entries.length,
    matchedEntries: entries.length - unmatchedEntries.length,
    unmatchedEntries: unmatchedEntries.length,
    statementBalanceMinor,
    bookBalanceMinor,
    differenceMinor: statementBalanceMinor - bookBalanceMinor,
    reconcilingItems: [
      ...unmatchedLines.map((line) => ({
        id: line.id,
        side: 'statement' as const,
        amountMinor: line.amountMinor,
        description: line.description,
      })),
      ...unmatchedEntries.map((entry) => ({
        id: entry.id,
        side: 'book' as const,
        amountMinor: entry.amountMinor,
        description: entry.reference,
      })),
    ].sort((a, b) => Math.abs(b.amountMinor) - Math.abs(a.amountMinor)),
  }
}

/**
 * The key that stops a re-imported statement creating duplicate lines.
 *
 * Built from the BANK's own reference where there is one. Falling back to
 * date+amount+description is weaker — two identical 500 withdrawals on one day
 * are indistinguishable — so the fallback includes the line's position in the
 * file, which at least makes a straight re-import idempotent.
 */
export function statementLineKey(
  line: { externalRef: string | null; onDate: string; amountMinor: number; description: string },
  positionInFile: number,
): string {
  if (line.externalRef) return `ref:${line.externalRef}`

  const normalised = line.description
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 40)
  return `pos:${line.onDate.slice(0, 10)}:${line.amountMinor}:${normalised}:${positionInFile}`
}
