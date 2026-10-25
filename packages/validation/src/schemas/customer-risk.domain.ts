// ============================================
// Capabilities #3, #9, #13, #18 — customer risk and health.
// Engine N21.
//
// ⚠️ RISK IS READ FROM THE SHOP'S OWN LEDGER, AND FROM NOTHING ELSE.
//
// The same boundary as the supplier engine: no bureau, no external score, no
// industry table. Everything here is computed from what this shop has actually
// been paid and has actually owed — which is enough for a real signal, and is
// entirely sourced.
//
// `POSITIONING-2026-09-15.md` records what happens otherwise: benchmark claims
// that had to be deleted from the landing because nothing in the codebase backed
// them.
//
// ⚠️ A LATE PAYMENT IS NOT A RISK BY ITSELF. EVERY CUSTOMER WAS LATE ONCE.
//
// The failure a naive implementation has is averaging payment lateness across
// all history, so a customer who paid on time for five years and slipped once
// comes out at 20 days average and gets flagged. What matters is the RECENT
// behaviour, and what matters more is the DIRECTION of the change: a customer
// who used to pay in 3 days and now takes 40 is deteriorating, and that is a
// completely different conversation from one who has always taken 40.
//
// So the signals are: recent lateness, the TREND, and whether an overdue debt is
// growing. Each is reported with its own figure, because «high risk» with no
// evidence is a label a salesperson argues with and cannot verify.
//
// ⚠️ AND A CUSTOMER WHO HAS PAID EVERYTHING IS NOT LOW RISK — THEY ARE NO RISK.
//
// `null`, specifically. A shop that blocks or chases a customer who has never
// missed a payment because a score said 12% is a shop that loses a customer for
// a number.
export type RiskBand = 'healthy' | 'watch' | 'at_risk' | 'unknown'

export interface PaymentBehaviour {
  /** Invoice id — the evidence has to point at something. */
  invoiceId: string
  issuedOn: string
  dueOn: string
  settledOn: string | null
  amountMinor: number
  /** What is still owed. Zero for a settled invoice. */
  outstandingMinor: number
}

export interface CustomerRiskInput {
  customerId: string
  payments: readonly PaymentBehaviour[]
  /** Set when the shop has configured a limit. Null when it has not. */
  creditLimitMinor: number | null
  /** A promised date the customer broke that is not yet an invoice. */
  brokenPromiseCount?: number
  /**
   * ⚠️ WHAT "TODAY" IS FOR THE OVERDUE TEST. Optional, and the caller that knows
   * the date passes it. Without it the rule uses the latest date in the record,
   * which keeps the function pure and its history reproducible — but it also
   * means the newest unpaid invoice is never itself overdue, because it sets
   * the reference.
   */
  asOf?: string | undefined
}

export interface PaymentSignal {
  key: 'RECENT_LATE' | 'TREND' | 'GROWING_DEBT' | 'BROKEN_PROMISE'
  /** One line a person can read and check. */
  detail: string
  /** 0–100. Signals do not sum — see `worstSignal`. */
  weight: number
  /** The figures behind the signal. Shown, not summarised. */
  evidence: Record<string, number>
}

export interface CustomerRisk {
  customerId: string
  band: RiskBand
  /** ⚠️ Null means «nothing to measure», never zero. */
  score: number | null
  signals: PaymentSignal[]
  facts: {
    invoices: number
    settled: number
    unsettled: number
    /** Mean days late across SETTLED invoices only. Null when none settled. */
    averageDaysLate: number | null
    /** The most recent quarter's mean, for the trend. */
    recentDaysLate: number | null
    /** Mean across the earlier ones. Null when there is no earlier history. */
    olderDaysLate: number | null
    outstandingMinor: number
    creditLimitMinor: number | null
  }
  /**
   * ⚠️ WHY THE BAND, WHEN THERE IS NO SIGNAL. A caller must be able to say
   * «nothing to measure» rather than rendering an empty chart.
   */
  reason: null | 'NEVER_BOUGHT' | 'TOO_FEW_SETTLED' | 'NO_SETTLED_INVOICES'
}

const round1 = (v: number) => Math.round(v * 10) / 10

/** Whole days between two ISO days. Negative when paid early. */
export function daysLate(dueOn: string, settledOn: string): number {
  return Math.round(
    (Date.parse(`${settledOn.slice(0, 10)}T00:00:00Z`) -
      Date.parse(`${dueOn.slice(0, 10)}T00:00:00Z`)) /
      86_400_000,
  )
}

/** Below this many SETTLED invoices, an average is a guess. */
export const MIN_SETTLED_FOR_A_SCORE = 3

/**
 * How risky this customer's payment behaviour is, and why.
 *
 * ⚠️ THE WORST SIGNAL WINS, NOT THE AVERAGE. Two customers each with one bad
 * month and two good ones average out to «fine», which is exactly the signal a
 * sales person needs not to lose — and a customer who is deteriorating is not
 * visible in an average at all, which is what `TREND` exists for.
 */
export function customerRisk(input: CustomerRiskInput): CustomerRisk {
  const { payments } = input

  const settled = payments.filter((p) => p.settledOn !== null && p.amountMinor > 0)
  const outstandingMinor = payments.reduce((sum, p) => sum + Math.max(0, p.outstandingMinor), 0)

  const latenesses = settled.map((p) => ({ ...p, late: daysLate(p.dueOn, p.settledOn!) }))

  const facts: CustomerRisk['facts'] = {
    invoices: payments.length,
    settled: settled.length,
    unsettled: payments.length - settled.length,
    averageDaysLate: null,
    recentDaysLate: null,
    olderDaysLate: null,
    outstandingMinor,
    creditLimitMinor: input.creditLimitMinor,
  }

  if (payments.length === 0) {
    return {
      customerId: input.customerId,
      band: 'unknown',
      score: null,
      signals: [],
      facts,
      reason: 'NEVER_BOUGHT',
    }
  }

  if (settled.length < MIN_SETTLED_FOR_A_SCORE) {
    // ⚠️ A customer with one settled invoice has no payment HISTORY, and the
    // `unknown` band is a real state a UI has to render — not a gap to fill with
    // the one number that exists.
    return {
      customerId: input.customerId,
      band: 'unknown',
      score: null,
      signals: [],
      facts,
      reason: settled.length === 0 ? 'NO_SETTLED_INVOICES' : 'TOO_FEW_SETTLED',
    }
  }

  facts.averageDaysLate = round1(latenesses.reduce((sum, p) => sum + p.late, 0) / latenesses.length)

  // ⚠️ THE TREND SPLITS THE HISTORY, it does not compare against a fixed
  // window. A fixed 90-day window on a customer who buys twice a year is
  // always empty, and the customer always looks like they have stopped.
  const sorted = [...latenesses].sort((a, b) => a.dueOn.localeCompare(b.dueOn))
  const recent = sorted.slice(-Math.ceil(sorted.length / 2))
  const older = sorted.slice(0, sorted.length - recent.length)

  facts.recentDaysLate = round1(recent.reduce((sum, p) => sum + p.late, 0) / recent.length)
  facts.olderDaysLate =
    older.length > 0 ? round1(older.reduce((sum, p) => sum + p.late, 0) / older.length) : null

  const signals: PaymentSignal[] = []

  // ── Recent lateness ────────────────────────────────────────
  const recentLate = facts.recentDaysLate ?? 0
  if (recentLate > 30) {
    signals.push({
      key: 'RECENT_LATE',
      detail: `paying ${Math.round(recentLate)} days late on their last ${recent.length} invoices`,
      weight: Math.min(100, Math.round(40 + recentLate / 2)),
      evidence: { recentDaysLate: facts.recentDaysLate ?? 0, sampleSize: recent.length },
    })
  }

  // ── The direction ───────────────────────────────────────────
  if (facts.olderDaysLate !== null) {
    const deterioration = (facts.recentDaysLate ?? 0) - facts.olderDaysLate
    // ⚠️ ONLY DETERIORATION COUNTS. Improving is not a risk signal, and a score
    // that rewards a customer becoming punctual is a score that punishes the shop
    // for being forgiven.
    if (deterioration >= 10) {
      signals.push({
        key: 'TREND',
        detail: `used to pay in ${Math.round(facts.olderDaysLate)} days, now ${Math.round(facts.recentDaysLate ?? 0)}`,
        weight: Math.min(95, Math.round(30 + deterioration)),
        evidence: {
          olderDaysLate: facts.olderDaysLate,
          recentDaysLate: facts.recentDaysLate ?? 0,
          deterioration: round1(deterioration),
        },
      })
    }
  }

  // ── Debt that is growing ───────────────────────────────────
  //
  // ⚠️ THIS NEEDS AN `asOf` AND THE FIRST VERSION HAD NEITHER RIGHT.
  //
  // It compared each due date against the customer's own LATEST date, which
  // made the comparison self-referential: the newest unpaid invoice could never
  // be overdue because it WAS the reference. With three overdue invoices the
  // newest one set the date and the other two compared against it — so the
  // signal fired on two of three, or on none.
  //
  // The caller supplies `asOf`. It defaults to the latest date anywhere in the
  // record, which is the best a pure function can do without reading a clock,
  // and it is what the `run the same record scores the same forever` test
  // depends on. A caller that knows today's date passes it.
  const asOf = input.asOf ?? latestDateAnywhere(payments)
  // ⚠️ `<`, NOT `<=`. An invoice due ON the reference date is due, not late.
  const overdue = payments.filter(
    (p) => p.outstandingMinor > 0 && p.settledOn === null && p.dueOn < asOf,
  )

  if (overdue.length >= 2) {
    signals.push({
      key: 'GROWING_DEBT',
      detail: `${overdue.length} invoices are past their date and unpaid`,
      weight: Math.min(100, 45 + overdue.length * 10),
      evidence: { overdueCount: overdue.length, outstandingMinor },
    })
  }

  // ── A broken promise, which never became an invoice ─────────
  if (input.brokenPromiseCount && input.brokenPromiseCount > 0) {
    signals.push({
      key: 'BROKEN_PROMISE',
      detail: `missed ${input.brokenPromiseCount} promised payment dates`,
      weight: Math.min(70, 20 + input.brokenPromiseCount * 10),
      evidence: { brokenPromises: input.brokenPromiseCount },
    })
  }

  if (signals.length === 0) {
    return {
      customerId: input.customerId,
      band: 'healthy',
      // ⚠️ A REAL score, not null. This customer is measurably fine, and the
      // difference between «we measured and it is good» and «we could not
      // measure» is the difference between a customer on the list and one
      // quietly dropped from it.
      score: 5,
      signals: [],
      facts,
      reason: null,
    }
  }

  const worst = signals.reduce((a, b) => (b.weight > a.weight ? b : a))
  const band: RiskBand = worst.weight >= 80 ? 'at_risk' : worst.weight >= 45 ? 'watch' : 'healthy'

  return { customerId: input.customerId, band, score: worst.weight, signals, facts, reason: null }
}

/**
 * The latest date the shop knows about, used to decide what is overdue.
 *
 * ⚠️ DERIVED FROM THE DATA, not from `Date.now()`. A rule that reads the clock
 * itself can only be tested at whatever time the suite happens to run, and a
 * scoring function whose answer changes with the wall clock is a function whose
 * history is unreadable — you cannot tell a customer's behaviour from their
 * record's vintage.
 *
 * ⚠️ AND IT IS THE LATEST UNSETTLED DUE DATE, NOT THE LATEST DATE OF ANY KIND.
 * The first version took the maximum across every field including `settledOn`,
 * so a customer whose last settled invoice was paid in March had a "today" of
 * March — and invoices due in May were never overdue. Two invoices past their
 * date produced no signal at all, which is the one thing the rule exists to
 * catch.
 */
function todayIso(payments: readonly PaymentBehaviour[]): string {
  return latestDateAnywhere(payments)
}

/** The latest date that appears anywhere in the record. */
function latestDateAnywhere(payments: readonly PaymentBehaviour[]): string {
  return payments.reduce((latest, p) => {
    const candidates = [p.issuedOn, p.dueOn, p.settledOn].filter((d): d is string => Boolean(d))
    const max = candidates.reduce((a, b) => (a > b ? a : b), '')
    return max > latest ? max : latest
  }, '')
}
