// ============================================
// Capabilities #123, #124 — installment plans, late fees, and the block toggle.
// Engine N4.
//
// ⚠️ THE DECISION THIS IS BUILT ON (owner, 30 September 2026).
//
// «یک فاکتور ساخته می‌شه و اگر قسطی باشه، هرکسی دسترسی داره می‌تونه بره توی
// فاکتور و پرداخت قسط رو اضافه کنه. پس یک فاکتور داریم، نه چند تا.»
//
// That is the answer to the question that blocked this for months, and it is
// the answer that makes the work SMALL. There is ONE claims document. A schedule
// is a set of DUE DATES against it. Money arrives through the payment path that
// already exists and already allocates correctly.
//
// ⚠️ SO NOTHING HERE TOUCHES THE MONEY PATH, AND THAT IS THE POINT.
//
// `PaymentsService.recordPayment` + `outstandingOf` already handle N payments
// against one invoice: `outstanding = total − Σ allocated`, the aging buckets
// already split on `due_date`, and a repeat request is already idempotent. An
// engine that created a receivable PER INSTALLMENT would have been a second
// claims model competing with the first — G2, and a set of balances that
// disagree with the invoice list by construction.
//
// So the schedule here is ADVISORY: it says when money was agreed to arrive and
// what has not. It is never the source of what is owed. `outstandingOf` still
// is.
//
// ⚠️ THE LATE FEE IS A FEE, NOT A PENALTY ENGINE.
//
// The owner's second answer: a late fee, so the shop can block a debtor or not —
// «دست خودمونه» — and the debt still shows. So:
//
//   * the fee is COMPUTED here and POSTED as an ordinary payment-side entry by
//     the caller, which means it goes through the ledger like any other money
//   * blocking is a POLICY FLAG, and it is OFF by default
//   * the debt is shown either way
//
// ⚠️ OFF BY DEFAULT, AND THE REASON IS THE SAME AS EVERYWHERE ELSE.
//
// SoD is off by default because most shops are one person. This is off by
// default because most shops do not charge late fees, and a system that blocks
// a customer who is nine days late over a rule they never enabled is worse than
// no rule (G4: every setting needs a stated default).
// ============================================

/** Minor units everywhere. `computeInvoiceMoney` and the ledger take minor. */
export type Minor = number

export interface InstallmentSchedule {
  id: string
  invoiceId: string
  seq: number
  dueDate: string
  amountMinor: Minor
  paidMinor: Minor
}

export interface SchedulePlanInput {
  totalMinor: Minor
  /** How many payments. Must be ≥ 2 — a single payment is not a plan. */
  count: number
  /** The first due date. Later ones are monthly from this one. */
  firstDueDate: string
}

/**
 * Split a total into N payments.
 *
 * ⚠️ THE REMAINDER GOES ON THE FIRST PAYMENT, not the last and not "the largest
 * one". Two wrong choices here look identical and are both unfair:
 *
 *   * putting it on the LAST means the customer's first payment is short by a
 *     fraction of a currency unit, and every customer notices that
 *   * putting it on the largest is a rule nobody asked for
 *
 * The first payment is the one the customer is told about first, so it carries
 * the rounding and the sum is exact — which is the only property that matters,
 * because a schedule that does not foot is a schedule nobody trusts.
 */
export function planSchedule(input: SchedulePlanInput): {
  seq: number
  dueDate: string
  amountMinor: Minor
}[] {
  if (!Number.isSafeInteger(input.count) || input.count < 2) {
    throw new Error('INSTALLMENT_COUNT_INVALID: an installment plan needs at least 2 payments')
  }
  if (!Number.isSafeInteger(input.totalMinor) || input.totalMinor <= 0) {
    throw new Error('INSTALLMENT_TOTAL_INVALID')
  }

  const base = Math.floor(input.totalMinor / input.count)
  const remainder = input.totalMinor - base * input.count

  return Array.from({ length: input.count }, (_, index) => {
    const seq = index + 1
    return {
      seq,
      dueDate: addMonths(input.firstDueDate, index),
      amountMinor: base + (index === 0 ? remainder : 0),
    }
  })
}

/**
 * Add whole months to an ISO day.
 *
 * ⚠️ DAY-OF-MONTH CLAMPING IS EXPLICIT. `new Date('2026-01-31')` plus one month
 * lands in March, so a plan starting on the 31st silently skips February and
 * the customer is billed twice in March. A date is not a duration, and adding a
 * month to a date is not arithmetic on milliseconds.
 */
export function addMonths(isoDay: string, months: number): string {
  const [year, month, day] = isoDay.slice(0, 10).split('-').map(Number)
  const target = new Date(Date.UTC(year!, month! - 1 + months, 1))
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()
  const clamped = Math.min(day!, lastDay)

  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`
}

// ─── Late fees ───────────────────────────────────────────────────────────────

export type LateFeeBasis = 'per_period' | 'percentage'

export interface LateFeeSettings {
  basis: LateFeeBasis
  /** For `per_period`: minor units charged per full period late.
   *  For `percentage`: a percentage of the overdue amount. */
  value: number
  /** Whole days after `dueDate` before anything is charged. */
  graceDays: number
  /** Never charge more than this share of what is overdue, however late it is. */
  maxShareOfOverduePercent: number
}

/**
 * ⚠️ OFF BY DEFAULT, EXPLICITLY.
 *
 * Not `undefined` and not "whatever the caller sends". A shop that has never
 * been asked about late fees does not charge them, and a system that silently
 * starts charging because a field was absent is the exact silent-money-loss
 * shape this codebase keeps finding (G4).
 */
export const DEFAULT_LATE_FEE_SETTINGS: LateFeeSettings = {
  basis: 'per_period',
  value: 0,
  graceDays: 0,
  maxShareOfOverduePercent: 100,
}

export interface OverdueInstallment {
  scheduleId: string
  invoiceId: string
  seq: number
  dueDate: string
  daysLate: number
  overdueMinor: Minor
  feeMinor: Minor
  /** True when the cap stopped it. A capped fee is a fact worth showing. */
  capped: boolean
}

/**
 * What is overdue on `asOf`, and what it costs.
 *
 * ⚠️ A FEE IS CHARGED ON THE OVERDUE AMOUNT, NOT ON THE WHOLE INVOICE. A shop
 * that has paid nine of ten installments should not be charged a late fee on
 * the ten it never owed to be late about.
 *
 * ⚠️ AND A PAID INSTALLMENT IS NEVER LATE, however old it is. `paidMinor` is
 * compared with `amountMinor` here rather than with a date, because a payment
 * recorded on time against an invoice marked late should not keep accruing.
 */
export function overdueInstallments(
  schedule: readonly InstallmentSchedule[],
  asOf: string,
  settings: LateFeeSettings = DEFAULT_LATE_FEE_SETTINGS,
): OverdueInstallment[] {
  if (settings.value <= 0) return []

  const today = asOf.slice(0, 10)
  const out: OverdueInstallment[] = []

  for (const line of schedule) {
    const overdueMinor = Math.max(0, line.amountMinor - line.paidMinor)
    if (overdueMinor === 0) continue

    const daysLate = daysBetween(line.dueDate, today)
    if (daysLate <= settings.graceDays) continue

    const raw =
      settings.basis === 'per_period'
        ? settings.value * Math.floor(daysLate / 30)
        : Math.round((overdueMinor * settings.value) / 100)

    // ⚠️ ZERO UNTIL A WHOLE MONTH. `per_period` with a 30-day divisor is
    // deliberately coarse: charging for a month that has not happened is a fee
    // nobody can explain.
    const cappedAt = Math.round((overdueMinor * settings.maxShareOfOverduePercent) / 100)
    const feeMinor = Math.min(Math.max(0, raw), cappedAt)

    out.push({
      scheduleId: line.id,
      invoiceId: line.invoiceId,
      seq: line.seq,
      dueDate: line.dueDate,
      daysLate,
      overdueMinor,
      feeMinor,
      capped: feeMinor < Math.max(0, raw),
    })
  }

  return out
}

/** Whole days from `from` to `to`. Both ISO days. */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.slice(0, 10).split('-').map(Number)
  const [ty, tm, td] = to.slice(0, 10).split('-').map(Number)
  const ms = Date.UTC(ty!, tm! - 1, td!) - Date.UTC(fy!, fm! - 1, fd!)
  return Math.round(ms / 86_400_000)
}

// ─── Blocking policy ─────────────────────────────────────────────────────────

export interface BlockPolicy {
  /** Whether a late installment may freeze the customer's credit. */
  blockOnOverdue: boolean
  /** Days late before it counts. Shares `graceDays` with the fee. */
  graceDays: number
  /**
   * ⚠️ NEVER block a customer whose whole debt is smaller than this. A frozen
   * customer owing 200 units stops buying, which costs the shop more than the
   * 200. The threshold is a shop's decision, so it is one — and it defaults to
   * off.
   */
  minAmountToBlockMinor: Minor
}

export const DEFAULT_BLOCK_POLICY: BlockPolicy = {
  blockOnOverdue: false,
  graceDays: 0,
  minAmountToBlockMinor: 0,
}

export type BlockDecision =
  | { blocked: false; reason: 'POLICY_OFF' | 'WITHIN_GRACE' | 'BELOW_THRESHOLD' }
  | { blocked: true; reason: 'OVERDUE'; daysLate: number; amountMinor: Minor }

/**
 * Whether an overdue invoice should freeze the customer's credit.
 *
 * ⚠️ This RETURNS A DECISION and does not apply it — the same separation
 * `RulesEngine` uses. Blocking a customer stops them buying; that belongs to the
 * capability that owns credit, with the caller recording why.
 */
export function decideBlock(
  overdue: readonly OverdueInstallment[],
  policy: BlockPolicy = DEFAULT_BLOCK_POLICY,
): BlockDecision {
  if (!policy.blockOnOverdue) return { blocked: false, reason: 'POLICY_OFF' }

  const counted = overdue.filter((o) => o.daysLate > policy.graceDays)
  if (counted.length === 0) return { blocked: false, reason: 'WITHIN_GRACE' }

  const amountMinor = counted.reduce((sum, o) => sum + o.overdueMinor, 0)
  if (amountMinor < policy.minAmountToBlockMinor) {
    return { blocked: false, reason: 'BELOW_THRESHOLD' }
  }

  return {
    blocked: true,
    reason: 'OVERDUE',
    daysLate: Math.max(...counted.map((o) => o.daysLate)),
    amountMinor,
  }
}
