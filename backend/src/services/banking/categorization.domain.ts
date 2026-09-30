// ============================================
// Capability #62 — automatic bank categorization.
//
// ⚠️ WHAT A CATEGORY IS, AND WHY IT IS NOT A MATCH.
//
// The reconciliation core (`reconciliation.domain.ts`) answers «does this bank
// line correspond to that payment or invoice» — identity. This module answers
// a different question: «once it is matched, which account does the money sit
// in». A category is the ledger side of a match, not a substitute for one.
//
// That distinction is the whole design. If categorization could stand in for
// matching, a bank's «CASHBACK 250» line would look categorizable and the books
// would gain an expense nobody received. A line is categorized; it is never
// reconciled, here or anywhere.
//
// ⚠️ IT REUSES `match-learning`, AND G2 IS LOAD-BEARING HERE.
//
// `match-learning.domain.ts` already learns «this description matches that
// party». Its learned pattern is keyed on description + party name, and its own
// header says it produces a BONUS that the existing scorer adds, never a
// decision. This module takes the same history and produces a different
// artefact: the account a shop's own past reconciliations kept putting this
// kind of line in.
//
// So there is ONE history, read twice, for two different questions. Building a
// second learning table would be the parallel model G2 forbids, and it would
// also be wrong twice a month, because the two would disagree about what the
// shop has been doing.
//
// ⚠️ SUGGESTION IS NOT A POSTING — and here the stakes are higher than in
// matching. A reconciliation writes no money: it links two rows that already
// exist. A category CHOOSES AN ACCOUNT, and an account is where the money lands.
// An automatic category that is wrong does not look wrong — it looks like a
// plausible expense in a plausible account, and a shop finds out at year-end.
//
// Hence: nothing here posts. The caller receives a suggestion with a confidence
// and the reason for it, and the person confirms. The same rule
// `reconciliation.domain` follows, for the same underlying reason.
//
// ⚠️ DIRECTION IS NOT A CATEGORY SIGNAL.
//
// Positive is money IN, negative is money OUT, and the same description means
// opposite things in each direction far more often than a shop expects: a
// supplier's name appears on a payment going out and, months later, on a refund
// coming back. Every pattern is therefore keyed on direction as well as text,
// and a pattern learned only from outgoing lines can never fire on an incoming
// one. That is `partyBalance`'s lesson (10) applied to a place it had not yet
// reached.
// ============================================

/** Which way the money moved. Same convention as the books: in is positive. */
export type CashDirection = 'in' | 'out'

/** The account root a line belongs to. Mirrors `AccountRootType` in the ledger. */
export type CategoryRoot = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export interface CategorySuggestion {
  accountId: string
  accountName: string
  root: CategoryRoot
  /**
   * How sure this is, 0–1. ⚠️ A NUMBER IS NOT A PROBABILITY: it is the share of
   * this shop's own history that went to this account. Three payments in 2024
   * and none since scores high and is still three data points — so `sampleSize`
   * travels with it and the UI is expected to show it.
   */
  confidence: number
  sampleSize: number
  /** The descriptions that produced this pattern. So a person can judge it. */
  because: string[]
}

export type CategorizationVerdict =
  | { kind: 'categorized'; suggestion: CategorySuggestion }
  /** The history is too thin to mean anything. Say so instead of guessing. */
  | { kind: 'insufficient_history'; sampleSize: number; minimum: number }
  /** The history is split. An ambiguous line must not pick a side (§71 lesson). */
  | { kind: 'ambiguous'; candidates: CategorySuggestion[] }
  /** Nothing in history resembles this line. */
  | { kind: 'no_pattern' }

/**
 * Below this, a pattern is a coincidence rather than a habit.
 *
 * ⚠️ Three, not one. A single past reconciliation is evidence that it happened
 * once; it is not evidence of what the shop does. Two can be a one-off payment
 * that happened to match a routine. Three is the smallest number that
 * distinguishes a habit from a coincidence without waiting a quarter.
 */
export const MIN_SAMPLE_SIZE = 3

/**
 * Two accounts are only ambiguous when they are this close.
 *
 * ⚠️ The same 0.1 as `reconciliation.domain`'s ambiguity band, and for the same
 * reason: below that margin the runner-up is noise, and picking a winner turns
 * noise into a posting. Above it, the leader is a real habit.
 */
export const AMBIGUITY_MARGIN = 0.1

/** One reconciliation the shop actually confirmed, as a learning sample. */
export interface CategoryHistory {
  direction: CashDirection
  /** Normalised with `match-learning`'s own `normaliseDescription`. */
  description: string
  /** The account the line landed in, or null if it was never categorised. */
  accountId: string | null
  accountName: string
  root: CategoryRoot
}

interface Tally {
  /** accountId → how many times this shop sent this pattern there. */
  byAccount: Map<string, { accountName: string; root: CategoryRoot; count: number }>
  descriptions: string[]
  total: number
}

/**
 * Group history by direction + normalised description, keeping a count per
 * ACCOUNT rather than one winner.
 *
 * ⚠️ Direction is part of the key, and dropping it is the obvious mistake: a
 * supplier's name on an outgoing payment and the same name on an incoming refund
 * are two different facts, and the second would otherwise inherit the first's
 * account.
 *
 * ⚠️ AND THE ACCOUNTS ARE NOT COLLAPSED HERE. The first version kept a single
 * `{accountId, count}` per key, which meant `count / count` was always 1.0 —
 * the confidence could never express doubt, so the ambiguity branch was
 * unreachable dead code. A "confidence" that cannot be less than one is not a
 * confidence; it is a constant. Keeping the split is what makes the margin mean
 * anything.
 */
export function tallyByPattern(history: readonly CategoryHistory[]): Map<string, Tally> {
  const tallies = new Map<string, Tally>()

  for (const entry of history) {
    if (!entry.accountId) continue // never categorised: not evidence of a habit
    const key = `${entry.direction}:${entry.description}`

    let tally = tallies.get(key)
    if (!tally) {
      tally = { byAccount: new Map(), descriptions: [], total: 0 }
      tallies.set(key, tally)
    }

    tally.total += 1
    if (!tally.descriptions.includes(entry.description)) {
      tally.descriptions.push(entry.description)
    }

    const existing = tally.byAccount.get(entry.accountId)
    if (existing) existing.count += 1
    else
      tally.byAccount.set(entry.accountId, {
        accountName: entry.accountName,
        root: entry.root,
        count: 1,
      })
  }

  return tallies
}

/**
 * Suggest an account for one bank line.
 *
 * ⚠️ TIES RESOLVE TO AMBIGUOUS, NOT TO THE FIRST. Picking a deterministic
 * winner from split evidence is how a bank charge gets booked as rent: the
 * answer looks right, the ledger accepts it, and there is nothing to notice.
 */
export function categorize(
  line: { direction: CashDirection; description: string },
  history: readonly CategoryHistory[],
  minimum: number = MIN_SAMPLE_SIZE,
): CategorizationVerdict {
  const key = `${line.direction}:${line.description}`
  const tally = tallyByPattern(history).get(key)

  if (!tally || tally.total < minimum) {
    return { kind: 'insufficient_history', sampleSize: tally?.total ?? 0, minimum }
  }

  const candidates: CategorySuggestion[] = [...tally.byAccount.entries()]
    .map(([accountId, info]) => ({
      accountId,
      accountName: info.accountName,
      root: info.root,
      confidence: info.count / tally.total,
      sampleSize: tally.total,
      because: [...tally.descriptions],
    }))
    .sort((left, right) => right.confidence - left.confidence)

  const best = candidates[0]!
  const runnerUp = candidates[1]

  if (runnerUp && best.confidence - runnerUp.confidence < AMBIGUITY_MARGIN) {
    return { kind: 'ambiguous', candidates: candidates.slice(0, 2) }
  }

  return { kind: 'categorized', suggestion: best }
}
