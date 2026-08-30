// ============================================
// backend/src/services/currency/revaluation.domain.ts
//
// What a foreign-currency balance is worth today, and what changed.
//
// ---------------------------------------------------------------------------
// TWO KINDS OF EXCHANGE DIFFERENCE, AND THEY ARE NOT THE SAME
//
//   REALISED    the money actually moved. An invoice raised at 70 AFN/USD is
//               settled when the rate is 73, so the business really is 3 AFN
//               per dollar better off. This is a fact.
//
//   UNREALISED  nothing moved. A receivable still outstanding is simply worth
//               more today than it was. This is an OPINION about a rate, and
//               it reverses the moment the rate moves back.
//
// They post to different accounts and they behave differently: realised
// differences are permanent, unrealised ones are re-computed every period and
// the previous period's is REVERSED first. Netting them together produces a
// figure that is neither, and a business that thinks it made money it did not.
//
// ---------------------------------------------------------------------------
// THE INVOICE KEEPS ITS OWN RATE
//
// Same principle as the tax snapshot: the rate an invoice was raised at is
// frozen onto it. Revaluation never rewrites that rate — it computes what the
// remaining balance is worth NOW and books the difference separately. An
// invoice whose stated amount changes when a rate moves is an invoice nobody
// can reconcile against the copy the customer holds.
// ============================================

export interface ForeignBalance {
  /** What the balance is FOR: an invoice, a bank account, a payable. */
  sourceType: 'receivable' | 'payable' | 'bank' | 'cash'
  sourceId: string
  currency: string
  /** Minor units OF THE FOREIGN CURRENCY still outstanding. */
  foreignMinor: number
  /** The rate this balance was originally recorded at. Frozen. */
  bookedRate: number
  /** Minor units of the BASE currency it was recorded as. */
  bookedBaseMinor: number
}

export interface RevaluationLine {
  sourceType: ForeignBalance['sourceType']
  sourceId: string
  currency: string
  foreignMinor: number
  bookedRate: number
  closingRate: number
  bookedBaseMinor: number
  /** Minor units of base currency at today's rate. */
  revaluedBaseMinor: number
  /** revalued − booked. Positive is a gain FOR AN ASSET. */
  differenceMinor: number
}

function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value)
}

/**
 * What one balance is worth at a closing rate.
 *
 * The sign convention is the trap. A receivable worth more in base currency is
 * a GAIN; a payable worth more is a LOSS — the business owes more. Computing
 * both as "revalued minus booked" and posting them the same way turns a rising
 * dollar into a windfall on money you owe.
 */
export function revalue(balance: ForeignBalance, closingRate: number): RevaluationLine {
  const revaluedBaseMinor = roundHalfAwayFromZero(balance.foreignMinor * closingRate)
  const raw = revaluedBaseMinor - balance.bookedBaseMinor

  const isLiability = balance.sourceType === 'payable'

  return {
    sourceType: balance.sourceType,
    sourceId: balance.sourceId,
    currency: balance.currency,
    foreignMinor: balance.foreignMinor,
    bookedRate: balance.bookedRate,
    closingRate,
    bookedBaseMinor: balance.bookedBaseMinor,
    revaluedBaseMinor,
    // An asset worth more is a gain; a liability worth more is a loss.
    differenceMinor: isLiability ? -raw : raw,
  }
}

export interface RevaluationRun {
  asOf: string
  /** Rates used, by currency. Recorded so the run can be reproduced. */
  rates: Record<string, number>
  lines: RevaluationLine[]
  /** Minor units. Net across every balance. Positive is a gain. */
  netDifferenceMinor: number
  gainMinor: number
  lossMinor: number
  /**
   * The previous run's net, which THIS run reverses before booking its own.
   * Unrealised differences are an opinion about a rate, and last month's
   * opinion must not still be sitting in the books underneath this month's.
   */
  reversesPreviousMinor: number
}

export function runRevaluation(
  balances: ForeignBalance[],
  rates: Record<string, number>,
  asOf: string,
  previousNetMinor = 0,
): RevaluationRun {
  const lines = balances
    // A balance in a currency we have no rate for is SKIPPED, not valued at
    // zero or at 1. Guessing a rate is how a revaluation invents a loss.
    .filter((balance) => typeof rates[balance.currency] === 'number')
    .filter((balance) => balance.foreignMinor !== 0)
    .map((balance) => revalue(balance, rates[balance.currency]!))

  const gainMinor = lines
    .filter((line) => line.differenceMinor > 0)
    .reduce((sum, line) => sum + line.differenceMinor, 0)

  const lossMinor = lines
    .filter((line) => line.differenceMinor < 0)
    .reduce((sum, line) => sum + line.differenceMinor, 0)

  return {
    asOf: asOf.slice(0, 10),
    rates,
    lines,
    netDifferenceMinor: gainMinor + lossMinor,
    gainMinor,
    lossMinor,
    reversesPreviousMinor: -previousNetMinor,
  }
}

// ─── Realised difference ─────────────────────────────────────────────────────

export interface SettlementInput {
  /** Minor units of foreign currency being settled. */
  foreignMinor: number
  /** The rate the original document was booked at. */
  bookedRate: number
  /** The rate on the day the money actually moved. */
  settlementRate: number
  sourceType: 'receivable' | 'payable'
}

/**
 * The difference that actually happened when money moved.
 *
 * Permanent, unlike a revaluation: the cash is in the account. Booked at
 * settlement and never revisited.
 */
export function realisedDifferenceMinor(input: SettlementInput): number {
  const bookedBase = roundHalfAwayFromZero(input.foreignMinor * input.bookedRate)
  const settledBase = roundHalfAwayFromZero(input.foreignMinor * input.settlementRate)
  const raw = settledBase - bookedBase

  // Same sign rule as revaluation: receiving more base currency than expected
  // is a gain; paying more is a loss.
  return input.sourceType === 'payable' ? -raw : raw
}

// ─── Rates ───────────────────────────────────────────────────────────────────

export interface RateQuote {
  currency: string
  rate: number
  /** The date this rate is FOR, not the date it was fetched. */
  onDate: string
}

export type RateRuleCode = 'RATE_NOT_FOUND' | 'RATE_STALE' | 'RATE_INVALID'

/**
 * The rate to use for a date.
 *
 * The most recent quote ON OR BEFORE that date — never a later one. Using a
 * rate from after the transaction values a past event with information nobody
 * had at the time, which is the thing that makes a restated figure impossible
 * to defend.
 *
 * A quote older than `staleAfterDays` is returned WITH a staleness flag rather
 * than refused: an old rate is usually all a shop has, and knowing it is old
 * is more useful than being blocked.
 */
export function rateFor(
  quotes: RateQuote[],
  currency: string,
  onDate: string,
  staleAfterDays = 7,
): { rate: number; onDate: string; isStale: boolean } | { error: RateRuleCode } {
  const target = onDate.slice(0, 10)

  const candidates = quotes
    .filter((quote) => quote.currency === currency && quote.onDate.slice(0, 10) <= target)
    .sort((a, b) => (a.onDate < b.onDate ? 1 : -1))

  const best = candidates[0]
  if (!best) return { error: 'RATE_NOT_FOUND' }
  if (!(best.rate > 0)) return { error: 'RATE_INVALID' }

  const ageDays = Math.round(
    (Date.parse(`${target}T00:00:00Z`) - Date.parse(`${best.onDate.slice(0, 10)}T00:00:00Z`)) /
      86_400_000,
  )

  return { rate: best.rate, onDate: best.onDate.slice(0, 10), isStale: ageDays > staleAfterDays }
}
