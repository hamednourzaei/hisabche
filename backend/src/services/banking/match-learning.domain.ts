// ============================================
// backend/src/services/banking/match-learning.domain.ts
//
// N1 — what previous reconciliations teach the next one.
//
// ---------------------------------------------------------------------------
// ⚠️ G2 — `scoreMatch` ALREADY EXISTS AND IS NOT REPLACED
//
// `reconciliation.domain.ts` already scores a pairing on the four signals the
// spec names: exact reference, amount, date proximity and party name. It
// refuses opposite directions outright, caps at 30 days, and marks a
// suggestion ambiguous when the runner-up is within 0.1. All of that stays.
//
// The one signal it does not have is HISTORY. A shop whose electricity bill
// arrives every month as «DABS KABUL 4471» has matched that description to the
// same supplier eleven times, and the twelfth is scored from scratch.
//
// This module turns those eleven into a hint. It produces a bonus that the
// existing scorer adds; it does not score anything itself.
//
// ---------------------------------------------------------------------------
// ⚠️ A SUGGESTION IS NOT A RECONCILIATION
//
// The spec is explicit: «Suggestion ≠ Automatic Reconciliation; the user must
// confirm». Nothing here reconciles anything, and the bonus is deliberately
// capped BELOW the exact-reference signal — history is evidence about what a
// person usually does, not evidence about what this particular line is.
// ============================================

/** One reconciliation a person actually confirmed. */
export interface PastMatch {
  /** The bank line's description, as it arrived. */
  description: string
  /** What it was matched to — a party, or an account. */
  counterpartyId: string
}

/**
 * The strongest a learned hint may ever be.
 *
 * ⚠️ Below `exact_reference` (0.7) and below `exact_amount_and_date` (0.5) on
 * purpose. «This description usually means that supplier» is weaker evidence
 * than «the bank quoted our own reference number», and a learned signal that
 * could outweigh a hard one would let a habit override a fact.
 */
export const MAX_LEARNED_BONUS = 0.25

/** How many past confirmations before a pattern counts at all. */
const MIN_OBSERVATIONS = 3

/**
 * Reduce a bank description to the part that repeats.
 *
 * Digits are STRIPPED, not kept: «DABS KABUL 4471» and «DABS KABUL 4482» are
 * the same recurring payee with a different invoice number, and keeping the
 * number would make every month a new, unlearnable pattern.
 *
 * ⚠️ That also means a description which is ONLY digits normalises to nothing
 * and is skipped — a reference number is `scoreMatch`'s business, not this
 * module's.
 */
export function normaliseDescription(description: string): string {
  return description
    .toUpperCase()
    .replace(/[0-9]+/g, ' ')
    .replace(/[^A-Z ]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .slice(0, 4)
    .join(' ')
    .trim()
}

export interface LearnedPattern {
  pattern: string
  counterpartyId: string
  observations: number
  /** observations for THIS counterparty ÷ observations for the pattern. */
  consistency: number
}

/**
 * What the history says, per description pattern.
 *
 * ⚠️ A PATTERN MATCHED TO SEVERAL DIFFERENT PARTIES TEACHES NOTHING.
 *
 * «TRANSFER» has been matched to forty different people. Its most common
 * counterparty might be 8% of the cases, and suggesting it would be worse than
 * suggesting nothing — the `consistency` figure is what keeps that out, and
 * the caller requires it to be high before the bonus applies.
 */
export function learnPatterns(history: readonly PastMatch[]): Map<string, LearnedPattern> {
  const byPattern = new Map<string, Map<string, number>>()

  for (const match of history) {
    const pattern = normaliseDescription(match.description)
    if (!pattern) continue

    const counts = byPattern.get(pattern) ?? new Map<string, number>()
    counts.set(match.counterpartyId, (counts.get(match.counterpartyId) ?? 0) + 1)
    byPattern.set(pattern, counts)
  }

  const learned = new Map<string, LearnedPattern>()

  for (const [pattern, counts] of byPattern) {
    let best = ''
    let bestCount = 0
    let total = 0

    for (const [counterpartyId, count] of counts) {
      total += count
      if (count > bestCount) {
        best = counterpartyId
        bestCount = count
      }
    }

    if (total < MIN_OBSERVATIONS) continue

    learned.set(pattern, {
      pattern,
      counterpartyId: best,
      observations: bestCount,
      consistency: bestCount / total,
    })
  }

  return learned
}

/**
 * The bonus this pairing earns from history, and why.
 *
 * Returns 0 whenever the history does not clearly say anything — which is most
 * of the time, and is the correct answer. A learned signal that fires on weak
 * evidence turns a useful score into noise.
 */
export function learnedBonus(
  description: string,
  counterpartyId: string | null | undefined,
  learned: ReadonlyMap<string, LearnedPattern>,
): { bonus: number; pattern: string | null } {
  if (!counterpartyId) return { bonus: 0, pattern: null }

  const pattern = normaliseDescription(description)
  if (!pattern) return { bonus: 0, pattern: null }

  const hit = learned.get(pattern)
  if (!hit || hit.counterpartyId !== counterpartyId) return { bonus: 0, pattern: null }

  // Ambiguous history is no history. A pattern that goes to this counterparty
  // barely more often than to others says nothing about this line.
  if (hit.consistency < 0.6) return { bonus: 0, pattern: null }

  // Scaled by BOTH how consistent the pattern is and how much of it there is.
  // Three confirmations at 100% is real but thin; twenty is strong. The
  // observation term saturates so a very long history cannot push past the cap.
  const depth = Math.min(1, hit.observations / 10)

  return {
    bonus: Math.round(MAX_LEARNED_BONUS * hit.consistency * depth * 100) / 100,
    pattern: hit.pattern,
  }
}
