// ============================================
// Capability #55 — automatic bank reconciliation, within a stated boundary.
//
// ⚠️ THIS IS THE THING `reconciliation.domain.ts` REFUSED TO DO, AND WHY THAT
// REFUSAL WAS RIGHT — READ THIS BEFORE CHANGING ANYTHING HERE.
//
// Its own header says: «Nothing here reconciles anything» and gives the reason.
// Two invoices for the same amount from the same customer in the same week is
// completely ordinary, and the wrong guess sends a receipt to the wrong invoice.
// The person who finds out is the customer being chased for a debt they already
// paid.
//
// So this module does NOT automate that decision. It AUTOMATES THE UNAMBIGUOUS
// CASE, and it is drawn so tightly that a shop can set it to zero and lose
// nothing:
//
//   * only `confidence: 'certain'` — a tier that existed in the type and had no
//     caller until now
//   * never `isAmbiguous`
//   * never when the partner could equally be something else
//   * never a bank CHARGE, which is not a payment at all and is the single most
//     mis-matched line in a real statement
//   * a per-workspace floor, and the default is that NOTHING is automatic
//
// ⚠️ THE DEFAULT IS ZERO, AND THAT IS THE POINT.
//
// G4: every setting needs a stated default. The default here is «a person looks
// at every line», because the cost of that is a minute and the cost of being
// wrong is a customer relationship. A shop that wants automation turns it on
// with an explicit number; it does not arrive switched on because a field was
// absent.
//
// ⚠️ AND NOTHING HERE WRITES. It returns a list the caller may act on — the same
// separation `RulesEngine` and the categorization engine both use. Writing is
// `reconcileLine`, which already exists and already records who did it.
// ============================================

import type { MatchSuggestion } from './reconciliation.domain'

/**
 * ⚠️ WHY BANK CHARGES ARE EXCLUDED BY NAME, NOT BY PATTERN.
 *
 * A bank's own fee appears on a statement with a description like «CHARGE»,
 * «SERVICE FEE» or «BANK CHARGE» and an amount that matches nothing in the
 * books. Auto-matching it is how a fee gets booked against a customer invoice
 * and the shop ends up with a duplicate. There is also a route that already
 * handles it properly — `difference_reason`, which says where the difference
 * lands — and this module does not touch it.
 *
 * ⚠️ The match is on WORDS, and words come from the BANK, not from us. So this
 * list is deliberately short: a long one would start matching a supplier whose
 * name happens to contain «fee», and that is a worse error than a fee left
 * unmatched.
 */
const BANK_CHARGE_MARKERS = [
  'charge',
  'fee',
  'commission charge',
  'service charge',
  'overdraft',
  'interest charge',
  'atm',
  'pos fee',
  'maintenance',
  'sms',
  'statement fee',
]

/** Is this statement line the bank's own charge rather than a payment? */
export function isBankCharge(description: string): boolean {
  const text = description.toLowerCase()
  return BANK_CHARGE_MARKERS.some((marker) => text.includes(marker))
}

export interface AutoMatchSettings {
  /**
   * ⚠️ THE THRESHOLD, ON THE EXISTING SCORE. 0 means nothing is automatic,
   * which is the default and is the safe answer. Anything above 0 is the shop
   * saying it has looked at its own statement and knows its own patterns.
   */
  minScore: number
  /** Only these tiers may be matched automatically. */
  allowedTiers: MatchSuggestion['confidence'][]
}

export const DEFAULT_AUTO_MATCH_SETTINGS: AutoMatchSettings = {
  minScore: 0,
  allowedTiers: ['certain'],
}

export type AutoMatchDecision =
  /** Safe to match. The caller may act; nothing has been written yet. */
  | { kind: 'auto'; lineId: string; partnerId: string; score: number }
  /** Refused, with the reason. Every refusal is one of these, never silence. */
  | {
      kind: 'refused'
      lineId: string
      reason: 'BELOW_THRESHOLD' | 'AMBIGUOUS' | 'TIER_NOT_ALLOWED' | 'NO_SUGGESTION' | 'BANK_CHARGE'
      score: number | null
    }

export type AutoMatchReport = {
  decisions: AutoMatchDecision[]
  matched: number
  refused: number
}

/**
 * Which suggestions may be acted on without asking.
 *
 * ⚠️ EVERY REFUSAL CARRIES A REASON, in the order that decides it. The order
 * matters for the report: a statement full of bank charges should say so rather
 * than reporting them as low-scoring, because «these are fees, go and handle
 * them properly» and «these matched poorly, try again» are different pieces of
 * work for the person doing it.
 */
export function decideAutoMatches(
  suggestions: readonly MatchSuggestion[],
  settings: AutoMatchSettings = DEFAULT_AUTO_MATCH_SETTINGS,
  /**
   * The bank's own description per statement line.
   *
   * ⚠️ PASSED IN, NOT READ FROM THE SUGGESTION. `MatchCandidate` carries ids,
   * a score and the reasons — not the text — because the scorer deliberately
   * does not carry the description through. The first version reached for
   * `suggestion.line.description` and did not compile, which is the type system
   * correctly refusing a field that was never there.
   *
   * A missing description means NOT a bank charge, rather than an assumed one:
   * guessing a fee from an absent string is how a real payment gets diverted
   * into the wrong bucket.
   */
  descriptionsByLineId: Readonly<Record<string, string>> = {},
): AutoMatchReport {
  const decisions: AutoMatchDecision[] = []

  for (const suggestion of suggestions) {
    const description = descriptionsByLineId[suggestion.statementLineId]
    if (description && isBankCharge(description)) {
      decisions.push({
        kind: 'refused',
        lineId: suggestion.statementLineId,
        reason: 'BANK_CHARGE',
        score: suggestion.score,
      })
      continue
    }

    if (!settings.allowedTiers.includes(suggestion.confidence)) {
      decisions.push({
        kind: 'refused',
        lineId: suggestion.statementLineId,
        reason: 'TIER_NOT_ALLOWED',
        score: suggestion.score,
      })
      continue
    }

    // ⚠️ CHECKED SEPARATELY FROM THE TIER, and never overridden by a high score.
    // A score of 1.0 on a line with two identical candidates is not certainty,
    // it is a coin that has not been flipped yet.
    if (suggestion.isAmbiguous) {
      decisions.push({
        kind: 'refused',
        lineId: suggestion.statementLineId,
        reason: 'AMBIGUOUS',
        score: suggestion.score,
      })
      continue
    }

    // ⚠️ AUTOMATION IS OFF WHEN THE THRESHOLD IS ZERO, stated as its own check.
    //
    // Comparing the score to the threshold cannot express this: `1 < 0` and
    // `1 <= 0` are both false, so a "minimum of 0" reads as "match everything" —
    // which is the exact opposite of what a threshold of zero is meant to say.
    // Two attempts failed here before it was stated explicitly: with `<`, and
    // then with `<=`.
    if (settings.minScore <= 0) {
      decisions.push({
        kind: 'refused',
        lineId: suggestion.statementLineId,
        reason: 'BELOW_THRESHOLD',
        score: suggestion.score,
      })
      continue
    }

    if (suggestion.score < settings.minScore) {
      decisions.push({
        kind: 'refused',
        lineId: suggestion.statementLineId,
        reason: 'BELOW_THRESHOLD',
        score: suggestion.score,
      })
      continue
    }

    decisions.push({
      kind: 'auto',
      lineId: suggestion.statementLineId,
      partnerId: suggestion.bookEntryId,
      score: suggestion.score,
    })
  }

  return {
    decisions,
    matched: decisions.filter((d) => d.kind === 'auto').length,
    refused: decisions.filter((d) => d.kind === 'refused').length,
  }
}
