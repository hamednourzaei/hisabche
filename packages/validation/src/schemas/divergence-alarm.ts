// ============================================
// packages/validation/src/schemas/divergence-alarm.ts
//
// WHEN A DIVERGENCE RATE IS WORTH TELLING SOMEBODY ABOUT.
//
// ⚠️ WHY THIS IS A PURE FILE IN THE CORE AND NOT A `if` INSIDE THE WORKER.
//
// The decision being made is a business rule: «how much disagreement between the
// shared core and the server is normal, and how much means stop trusting the
// rollout». It is exactly the kind of thing that gets re-typed differently in
// the next consumer (a dashboard, a migration script, a support query), and two
// thresholds that disagree is how a system reports «all clear» while a table
// fills with diverged invoices.
//
// So the arithmetic lives here, with no database and no clock, and the worker
// only supplies counts.
//
// ⚠️ THE «OFF» STATE IS ITS OWN CONDITION, NOT A ZERO THRESHOLD.
//
// This repo has already been bitten by «off with a threshold of zero» meaning
// «on»: `if (score < minScore)` with `minScore: 0` is never true, so a feature
// switched off at zero was in fact alarming on everything. Here «off» is the
// absence of a threshold (`null`), and zero is a perfectly legal threshold that
// means «any divergence at all».
// ============================================

/** Stable code, so a test and a support query can name the same thing. */
export type DivergenceAlarmCode = 'ALARM_OFF' | 'ALARM_RATE_EXCEEDED' | 'ALARM_BELOW_THRESHOLD'

export interface DivergenceWindow {
  capability: string
  /** Rows recorded in the window. */
  divergences: number
  /** Opportunities the core was compared on (payments recorded, etc.). */
  opportunities: number
}

export interface DivergenceThreshold {
  /**
   * Divergence rate, as a PERCENTAGE of opportunities (0–100).
   *
   * `null` means the alarm is OFF. There is no default that quietly turns it on,
   * and no default that quietly turns it off — the caller must say.
   */
  percent: number | null
  /**
   * A window this small cannot express a rate honestly: one divergence out of
   * two opportunities is 50 %, and would fire on every quiet morning. Below this
   * many opportunities the window is REPORTED but not judged.
   */
  minOpportunities: number
}

/**
 * The shipped defaults.
 *
 * ⚠️ `percent: null` — THE ALARM IS OFF UNTIL SOMEBODY TURNS IT ON.
 *
 * Shadow mode itself is off until `setShadowMode(true)`, so there are no
 * divergences to alarm about, and a default-on alarm would page on zero data.
 * When shadow mode is switched on for a capability, this threshold is the value
 * to set deliberately, per capability, with the divergence history behind it.
 */
export const DEFAULT_DIVERGENCE_THRESHOLD: DivergenceThreshold = {
  percent: null,
  minOpportunities: 20,
}

export interface DivergenceVerdict {
  /** True only when the alarm is on AND the window is large enough AND over. */
  alarm: boolean
  code: DivergenceAlarmCode
  /** `divergences / opportunities`, in percent. `null` when nothing was compared. */
  ratePercent: number | null
  /** What the window measured, for the message. */
  observed: { divergences: number; opportunities: number }
  /** A sentence a human reads. Built here so every reader says it the same way. */
  message: string
}

/** Is the alarm switched on at all? A separate question from "did it fire". */
export function isDivergenceAlarmEnabled(threshold: DivergenceThreshold): boolean {
  return threshold.percent !== null
}

/**
 * Judge one capability's window.
 *
 * ⚠️ STRICTLY GREATER THAN. A threshold of 5 % does not fire at exactly 5 %:
 * «the boundary is not yet the problem» — the same `<` not `<=` rule the repo
 * settled on for supplier risk and discount limits. A threshold that fires on
 * its own boundary cannot be reasoned about, because the boundary value is
 * ambiguous.
 */
export function evaluateDivergenceWindow(
  window: DivergenceWindow,
  threshold: DivergenceThreshold = DEFAULT_DIVERGENCE_THRESHOLD,
): DivergenceVerdict {
  const observed = { divergences: window.divergences, opportunities: window.opportunities }

  // Nothing compared: the rate is unknown, and unknown is not zero.
  const ratePercent =
    window.opportunities > 0 ? (window.divergences / window.opportunities) * 100 : null

  if (!isDivergenceAlarmEnabled(threshold)) {
    return {
      alarm: false,
      code: 'ALARM_OFF',
      ratePercent,
      observed,
      message: `Alarm is off for ${window.capability}.`,
    }
  }

  // A window too small to carry a rate is reported, not judged. Saying «fine»
  // here would be the same mistake as reporting an unreadable count as zero.
  if (window.opportunities < threshold.minOpportunities) {
    return {
      alarm: false,
      code: 'ALARM_BELOW_THRESHOLD',
      ratePercent,
      observed,
      message:
        `${window.capability}: only ${window.opportunities} compared, ` +
        `which is under the ${threshold.minOpportunities} needed to judge a rate.`,
    }
  }

  const limit = threshold.percent as number
  if (ratePercent !== null && ratePercent > limit) {
    return {
      alarm: true,
      code: 'ALARM_RATE_EXCEEDED',
      ratePercent,
      observed,
      message:
        `${window.capability}: ${window.divergences} divergences in ${window.opportunities} ` +
        `comparisons (${ratePercent.toFixed(2)}%), above the ${limit}% limit.`,
    }
  }

  return {
    alarm: false,
    code: 'ALARM_BELOW_THRESHOLD',
    ratePercent,
    observed,
    message:
      `${window.capability}: ${window.divergences} divergences in ${window.opportunities} ` +
      `comparisons (${ratePercent?.toFixed(2) ?? 'n/a'}%), within the ${limit}% limit.`,
  }
}

/**
 * One sentence for the whole run: the capabilities that fired, or that nothing
 * did. Never invents a capability that was not measured.
 */
export function summarizeDivergenceAlarms(
  verdicts: readonly (DivergenceVerdict & { capability: string })[],
): { firing: string[]; message: string } {
  const firing = verdicts.filter((v) => v.alarm).map((v) => v.capability)
  if (firing.length === 0) {
    return { firing, message: 'No capability crossed its divergence limit.' }
  }
  return {
    firing,
    message: `${firing.length} capability(ies) crossed their divergence limit: ${firing.join(', ')}.`,
  }
}
