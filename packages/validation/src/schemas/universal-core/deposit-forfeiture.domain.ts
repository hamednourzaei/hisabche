// ============================================
// WP-13 gap B — DEPOSIT_AUTO_FORFEIT_NOT_WIRED.
//
// A cancelled order must NOT silently swallow the customer's deposit. Forfeiting
// is a POLICY a shop enables explicitly — off by default, like every other
// money-moving switch in this codebase — and it needs a stated reason so the
// audit trail can say why the customer lost money.
//
// This file returns a DECISION. It never posts, never moves money, never touches
// the ledger. The capability that owns the deposit applies it with its own row
// locks, exactly like `order-deposit.domain.ts` decides and the SQL applies.
//
// ⚠️ UNKNOWN IS NOT ZERO. An invalid date is a refusal, not "day 0" (which would
// grant the forfeiture). `daysBetween` in payments.domain returns 0 on a bad
// date; that is fine for aging buckets, not for a decision that takes money.
// ============================================

/** Whole days. Off unless a shop enables it. */
export interface DepositForfeiturePolicy {
  enabled: boolean
  /** Whole days after cancellation before a forfeiture may happen. */
  afterCancelDays: number
  /** Cap, 0–100, of the still-unapplied deposit that may be forfeited. */
  maxShareOfDepositPercent: number
  /** A forfeiture without a reason is not auditable. */
  reasonRequired: boolean
}

export const DEFAULT_DEPOSIT_FORFEITURE_POLICY: DepositForfeiturePolicy = {
  enabled: false,
  afterCancelDays: 0,
  maxShareOfDepositPercent: 100,
  reasonRequired: true,
}

export const DEPOSIT_FORFEITURE_MIN_REASON_LENGTH = 3

export type DepositForfeitureRefusal =
  | 'POLICY_OFF'
  | 'AMOUNT_INVALID'
  | 'PERCENT_INVALID'
  | 'DATE_INVALID'
  | 'REASON_REQUIRED'
  | 'REASON_TOO_LONG'
  | 'WITHIN_GRACE'
  | 'NOTHING_TO_FORFEIT'

export interface DepositForfeitureInput {
  /** What the customer handed over, integer minor units. */
  depositAmountMinor: number
  /** Part already consumed by an invoice — not forfeitable a second time. */
  alreadyAppliedMinor: number
  /** ISO day the order was cancelled. */
  cancelledOn: string
  /** ISO day the decision is taken. */
  asOf: string
  reason: string | null | undefined
}

export type DepositForfeitureDecision =
  | { forfeit: false; reason: DepositForfeitureRefusal }
  | { forfeit: true; amountMinor: number; daysAfterCancel: number }

/** Strict ISO-day difference, or `null` when either side is not a real day. */
function dayDiff(from: string, to: string): number | null {
  const start = Date.parse(`${String(from ?? '').slice(0, 10)}T00:00:00Z`)
  const end = Date.parse(`${String(to ?? '').slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return Math.round((end - start) / 86_400_000)
}

/**
 * Decide whether a cancelled order's deposit may be forfeited, and how much.
 *
 * ⚠️ THE CAP IS ON THE STILL-UNAPPLIED PART, not on the original deposit. A
 * deposit partly used against an invoice has already left the liability; taking
 * a percentage of the original would charge the customer twice.
 */
export function decideDepositForfeiture(
  input: DepositForfeitureInput,
  policy: DepositForfeiturePolicy = DEFAULT_DEPOSIT_FORFEITURE_POLICY,
): DepositForfeitureDecision {
  if (!policy.enabled) return { forfeit: false, reason: 'POLICY_OFF' }

  if (
    !Number.isSafeInteger(input.depositAmountMinor) ||
    input.depositAmountMinor <= 0 ||
    !Number.isSafeInteger(input.alreadyAppliedMinor) ||
    input.alreadyAppliedMinor < 0 ||
    input.alreadyAppliedMinor > input.depositAmountMinor
  ) {
    return { forfeit: false, reason: 'AMOUNT_INVALID' }
  }
  if (
    !Number.isInteger(policy.maxShareOfDepositPercent) ||
    policy.maxShareOfDepositPercent < 0 ||
    policy.maxShareOfDepositPercent > 100 ||
    !Number.isInteger(policy.afterCancelDays) ||
    policy.afterCancelDays < 0
  ) {
    return { forfeit: false, reason: 'PERCENT_INVALID' }
  }

  const daysAfterCancel = dayDiff(input.cancelledOn, input.asOf)
  if (daysAfterCancel === null || daysAfterCancel < 0) {
    return { forfeit: false, reason: 'DATE_INVALID' }
  }

  const reason = (input.reason ?? '').trim()
  if (policy.reasonRequired && reason.length < DEPOSIT_FORFEITURE_MIN_REASON_LENGTH) {
    return { forfeit: false, reason: 'REASON_REQUIRED' }
  }
  if (reason.length > 500) return { forfeit: false, reason: 'REASON_TOO_LONG' }

  if (daysAfterCancel < policy.afterCancelDays) {
    return { forfeit: false, reason: 'WITHIN_GRACE' }
  }

  const forfeitableMinor = input.depositAmountMinor - input.alreadyAppliedMinor
  if (forfeitableMinor <= 0) return { forfeit: false, reason: 'NOTHING_TO_FORFEIT' }

  const capped = Math.floor((forfeitableMinor * policy.maxShareOfDepositPercent) / 100)
  if (capped <= 0) return { forfeit: false, reason: 'NOTHING_TO_FORFEIT' }

  return { forfeit: true, amountMinor: capped, daysAfterCancel }
}
