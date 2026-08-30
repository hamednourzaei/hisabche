// ============================================
// backend/src/services/assets/depreciation.domain.ts
//
// What a fixed asset is worth as it wears out.
//
// ---------------------------------------------------------------------------
// A SCHEDULE, NOT A FORMULA RUN MONTHLY
//
// The obvious implementation is a monthly job that computes "this period's
// depreciation" and posts it. It is also the one that goes wrong quietly: a
// month the job did not run is a month of depreciation that never happened,
// and nothing in the books says so.
//
// So the whole schedule is computed ONCE, up front, as a list of dated
// entries. Posting is then a matter of "which scheduled entries are due and
// not yet posted" — a question with a definite answer that survives a missed
// run, a crash, and a device that was offline for six weeks.
//
// ---------------------------------------------------------------------------
// EVERYTHING IN MINOR UNITS, AND THE LAST PERIOD ABSORBS THE REMAINDER
//
// 100,000 over 3 years is 2,777.77… a month. Thirty-six of those do not add
// up to 100,000. Rather than let the asset settle at a book value of 0.12,
// the FINAL period takes whatever is left, so the schedule sums exactly to
// the depreciable amount. That is what makes the asset reach its salvage
// value on its last day instead of near it.
// ============================================

export type DepreciationMethod =
  /** Equal amount every period. */
  | 'straight_line'
  /** A factor of the REMAINING book value each period. */
  | 'declining'
  /** Declining until straight line would give more, then straight line. */
  | 'declining_then_straight'

export interface AssetInput {
  /** Minor units. What was paid, including anything capitalised into it. */
  costMinor: number
  /** Minor units. What it is expected to be worth at the end. Not depreciated. */
  salvageMinor: number
  /** Total periods over which it depreciates. */
  periods: number
  method: DepreciationMethod
  /** For the declining methods. 2 is double-declining. */
  decliningFactor?: number | undefined
  /** ISO date of the first scheduled entry. */
  firstPeriodOn: string
  /** Months between entries. 1 is monthly, 12 is annual. */
  periodMonths: number
  /**
   * The asset was acquired part-way through its first period, so that entry
   * covers only the days actually held. Odoo calls this prorata temporis.
   */
  prorataFrom?: string | null | undefined
}

export interface DepreciationEntry {
  /** 1-based. The period this entry belongs to. */
  period: number
  /** ISO date this entry is dated. */
  onDate: string
  /** Minor units depreciated in this period. */
  amountMinor: number
  /** Minor units depreciated so far, inclusive of this entry. */
  accumulatedMinor: number
  /** Minor units. cost − accumulated. Never below salvage. */
  bookValueMinor: number
}

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1 + months, 1))

  // Clamp to the month's length: adding one month to 31 January must give 28
  // or 29 February, not 3 March.
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(d!, lastDay))

  return date.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86_400_000)
}

function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value)
}

export type AssetRuleCode =
  | 'ASSET_COST_INVALID'
  | 'ASSET_SALVAGE_EXCEEDS_COST'
  | 'ASSET_PERIODS_INVALID'
  | 'ASSET_FACTOR_INVALID'
  | 'ASSET_PERIOD_MONTHS_INVALID'

export function validateAsset(input: AssetInput): AssetRuleCode[] {
  const problems: AssetRuleCode[] = []

  if (input.costMinor <= 0) problems.push('ASSET_COST_INVALID')

  // Salvage above cost would make the asset appreciate, which this is not
  // the model for.
  if (input.salvageMinor < 0 || input.salvageMinor > input.costMinor) {
    problems.push('ASSET_SALVAGE_EXCEEDS_COST')
  }

  if (!Number.isInteger(input.periods) || input.periods < 1) problems.push('ASSET_PERIODS_INVALID')
  if (!Number.isInteger(input.periodMonths) || input.periodMonths < 1) {
    problems.push('ASSET_PERIOD_MONTHS_INVALID')
  }

  if (input.method !== 'straight_line') {
    const factor = input.decliningFactor ?? 2
    if (factor <= 1) problems.push('ASSET_FACTOR_INVALID')
  }

  return problems
}

/**
 * The whole depreciation schedule, computed once.
 *
 * Every entry is dated, so posting later is "which of these are due and
 * unposted" rather than "what would this month's figure be" — a question that
 * has the same answer whether it is asked on time or six weeks late.
 */
export function buildSchedule(input: AssetInput): DepreciationEntry[] {
  if (validateAsset(input).length > 0) return []

  const depreciable = input.costMinor - input.salvageMinor
  if (depreciable <= 0) return []

  const raw: number[] = []

  if (input.method === 'straight_line') {
    const perPeriod = roundHalfAwayFromZero(depreciable / input.periods)
    for (let i = 0; i < input.periods; i += 1) raw.push(perPeriod)
  } else {
    const factor = input.decliningFactor ?? 2
    const rate = factor / input.periods
    const straightPerPeriod = roundHalfAwayFromZero(depreciable / input.periods)

    let remaining = depreciable

    for (let i = 0; i < input.periods; i += 1) {
      const declining = roundHalfAwayFromZero(remaining * rate)

      // The hybrid switches the moment straight line would give MORE. Without
      // the switch, declining alone never reaches zero — it approaches it, and
      // the asset never finishes depreciating.
      const amount =
        input.method === 'declining_then_straight'
          ? Math.max(declining, Math.min(straightPerPeriod, remaining))
          : declining

      const capped = Math.min(amount, remaining)
      raw.push(capped)
      remaining -= capped
    }
  }

  // ── prorata: the first period covers only the days actually held ──
  if (input.prorataFrom) {
    const fullPeriodDays = daysBetween(
      input.prorataFrom,
      addMonths(input.prorataFrom, input.periodMonths),
    )
    const heldDays = daysBetween(input.prorataFrom, input.firstPeriodOn)

    if (fullPeriodDays > 0 && heldDays >= 0 && heldDays < fullPeriodDays) {
      const full = raw[0] ?? 0
      const prorated = roundHalfAwayFromZero((full * heldDays) / fullPeriodDays)
      // What the first period does not take is not lost — it moves to the end,
      // where the remainder is absorbed anyway.
      raw[0] = prorated
    }
  }

  // ── the last period absorbs the rounding remainder ──
  // Thirty-six roundings of 2,777.77 do not sum to 100,000. Rather than leave
  // the asset at a book value of 0.12 forever, the final entry takes whatever
  // is left, so the schedule sums EXACTLY to the depreciable amount.
  const scheduled = raw.reduce((sum, amount) => sum + amount, 0)
  if (raw.length > 0) raw[raw.length - 1] = raw[raw.length - 1]! + (depreciable - scheduled)

  const entries: DepreciationEntry[] = []
  let accumulated = 0

  for (let i = 0; i < raw.length; i += 1) {
    const amount = raw[i]!
    accumulated += amount

    entries.push({
      period: i + 1,
      onDate: addMonths(input.firstPeriodOn, i * input.periodMonths),
      amountMinor: amount,
      accumulatedMinor: accumulated,
      bookValueMinor: input.costMinor - accumulated,
    })
  }

  return entries
}

/**
 * Entries that are due and have not been posted.
 *
 * This is what makes a missed month recoverable: the schedule is fixed, so a
 * run six weeks late posts the four entries it owes rather than one figure
 * that quietly swallowed three.
 */
export function duePostings(
  schedule: DepreciationEntry[],
  postedPeriods: number[],
  asOf: string,
): DepreciationEntry[] {
  const posted = new Set(postedPeriods)
  const today = asOf.slice(0, 10)

  return schedule.filter((entry) => entry.onDate <= today && !posted.has(entry.period))
}

/** Net book value on a date, from the schedule alone. */
export function bookValueMinor(
  costMinor: number,
  schedule: DepreciationEntry[],
  asOf: string,
): number {
  const today = asOf.slice(0, 10)
  const accumulated = schedule
    .filter((entry) => entry.onDate <= today)
    .reduce((sum, entry) => sum + entry.amountMinor, 0)

  return costMinor - accumulated
}

// ─── Disposal ────────────────────────────────────────────────────────────────

export interface DisposalResult {
  /** Minor units removed from the asset account. */
  costMinor: number
  /** Minor units removed from accumulated depreciation. */
  accumulatedMinor: number
  netBookValueMinor: number
  proceedsMinor: number
  /** Positive is a gain, negative is a loss. */
  gainOrLossMinor: number
  /** Depreciation periods that will never now be posted. */
  cancelledPeriods: number[]
}

/**
 * Selling or scrapping an asset before its schedule ends.
 *
 * The gain or loss is proceeds less NET BOOK VALUE — not less cost. Comparing
 * against cost reports a loss on every asset ever sold after being used, which
 * is exactly backwards.
 *
 * Remaining scheduled entries are cancelled and NAMED, so the schedule does
 * not keep depreciating something the business no longer owns.
 */
export function disposeAsset(
  costMinor: number,
  schedule: DepreciationEntry[],
  disposal: { onDate: string; proceedsMinor: number },
): DisposalResult {
  const onDate = disposal.onDate.slice(0, 10)

  const taken = schedule.filter((entry) => entry.onDate <= onDate)
  const accumulated = taken.reduce((sum, entry) => sum + entry.amountMinor, 0)
  const netBookValue = costMinor - accumulated

  return {
    costMinor,
    accumulatedMinor: accumulated,
    netBookValueMinor: netBookValue,
    proceedsMinor: disposal.proceedsMinor,
    gainOrLossMinor: disposal.proceedsMinor - netBookValue,
    cancelledPeriods: schedule
      .filter((entry) => entry.onDate > onDate)
      .map((entry) => entry.period),
  }
}
