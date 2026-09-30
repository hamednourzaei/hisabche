// ============================================
// Capabilities #130, #131 — cohorts, funnels, segments.
// Engine N10.
//
// ⚠️ A COHORT IS ABOUT CUSTOMERS, AND THE UNIT IS THE CUSTOMER. NEVER THE ORDER.
//
// The obvious implementation groups invoices by month and measures how much each
// month's buyers came back for. That measures repeat-purchase rate on a
// revenue-weighted basis: a shop whose second month was one large order looks
// more loyal than one with fifty small repeat buyers, which is the opposite of
// what retention means.
//
// So every cohort here is keyed on the CUSTOMER, and the metrics are counts of
// customers, never sums of money. Money appears only as an average per customer,
// where it cannot drown out the small ones.
//
// ⚠️ COHORTS ARE BACKWARD-LOOKING AND SAID TO BE.
//
// A cohort measured from this month's buyers can only report what already
// happened. Every row carries `observedThrough`, and a row whose window extends
// past it is REPORTED AS INCOMPLETE rather than shown as a drop-off — because
// "30% retained at month 2" for a cohort three weeks old is not a fall in
// retention, it is three weeks of not having happened yet. This is the single
// most misread chart in this class of product.
//
// ⚠️ AND A SEGMENT IS A DEFINITION, NOT A LIST OF IDS.
//
// `topSpenders(500)` today and the same call next month produce different
// customers, so caching the ids would show a stale answer under a fresh name.
// A segment is the QUERY, evaluated when it is read.
import type { OpenInvoice } from '../payments/payments.domain'

// ─── Cohorts (#130) ─────────────────────────────────────────────────────────

export interface CohortRow {
  /** `YYYY-MM` of the customer's first ever purchase. */
  cohort: string
  /** How many customers started in it. */
  size: number
  /** For each month after the cohort started, how many of them bought again. */
  retained: (number | null)[]
  /** Customers in this cohort that never bought again. */
  churned: number
  /**
   * ⚠️ The last month this row can say anything about. A later month is null,
   * NOT zero — see the header.
   */
  observedThrough: string
  /** Mean spend per customer in the cohort. Money never drives the shape. */
  averageValuePerCustomer: number | null
}

const monthKey = (isoDay: string) => isoDay.slice(0, 7)

const round2 = (v: number) => Math.round(v * 100) / 100

/**
 * ⚠️ HOW MANY MONTHS AFTER A COHORT THE TABLE SHOWS.
 *
 * Fixed rather than derived from the newest cohort, because a table whose width
 * depends on its data is a table that changes shape when the data changes — and
 * a retention chart that resizes itself every month cannot be compared with
 * last month's. Twelve is a year of retention, which is the horizon a shop
 * actually plans a repeat customer on.
 */
export const COHORT_WINDOW_MONTHS = 12

/** Add whole months to a `YYYY-MM` key. */
function monthKeyPlus(monthKeyValue: string, months: number): string {
  const parts = monthKeyValue.split('-').map(Number)
  let year = parts[0] ?? 1970
  let month = parts[1] ?? 1

  for (let i = 0; i < months; i += 1) {
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return `${year}-${String(month).padStart(2, '0')}`
}

/**
 * Retention by first-purchase month.
 *
 * ⚠️ A CUSTOMER WITH ONE INVOICE IS IN THE COHORT AND HAS NOT LEFT IT. They
 * have not churned — they have not been observed long enough. Counting them as
 * churned at month 0 is the mistake that makes every cohort chart read as a
 * cliff, and it is why the first period's retention is always the cohort size.
 */
export function buildCohorts(
  invoices: readonly OpenInvoice[],
  customerOf: (invoice: OpenInvoice) => string | null,
  asOf: string,
): CohortRow[] {
  interface CustomerRecord {
    first: string
    months: Set<string>
    total: number
  }

  const byCustomer = new Map<string, CustomerRecord>()

  for (const invoice of invoices) {
    if (invoice.total <= 0) continue
    const customerId = customerOf(invoice)
    if (!customerId) continue

    const month = monthKey(invoice.invoiceDate || invoice.dueDate)
    const existing = byCustomer.get(customerId)

    if (existing) {
      existing.months.add(month)
      existing.total += invoice.total
      continue
    }

    byCustomer.set(customerId, { first: month, months: new Set([month]), total: invoice.total })
  }

  const groups = new Map<string, CustomerRecord[]>()
  for (const record of byCustomer.values()) {
    const bucket = groups.get(record.first) ?? []
    bucket.push(record)
    groups.set(record.first, bucket)
  }

  const currentMonth = monthKey(asOf)
  const rows: CohortRow[] = []

  for (const [cohort, customers] of [...groups.entries()].sort()) {
    const size = customers.length
    // ⚠️ THE WINDOW IS FIXED AT TWELVE MONTHS, and it includes the months AFTER
    // the current one.
    //
    // A window ending at the current month stops at today, so a cohort from this
    // month would return a one-element row and a chart would have no cell to
    // show as "not yet". The cells must EXIST and be null — a missing cell is
    // indistinguishable from a column that was not requested.
    const window = Array.from({ length: COHORT_WINDOW_MONTHS }, (_, offset) =>
      monthKeyPlus(cohort, offset),
    )

    const retained = window.map((target, offset) => {
      // ⚠️ The cohort's own month is always the whole cohort — not retention.
      if (offset === 0) return size

      // ⚠️ NOT YET OBSERVED IS `null`, NEVER 0. A cohort three weeks old has not
      // had a chance to churn, and rendering its unfilled months as 0 is how a
      // retention chart invents a cliff.
      if (target > currentMonth) return null

      return customers.filter((c) => c.months.has(target)).length
    })

    const lastObservedIndex = window.reduce(
      (last, month, index) => (month <= currentMonth ? index : last),
      0,
    )
    const lastCount = retained[lastObservedIndex] ?? size

    rows.push({
      cohort,
      size,
      retained,
      churned: Math.max(0, size - lastCount),
      observedThrough: currentMonth,
      averageValuePerCustomer: round2(customers.reduce((s, c) => s + c.total, 0) / size),
    })
  }

  return rows
}

// ─── Segments (#108, #131) ──────────────────────────────────────────────────

export type SegmentOperator = 'greater_than' | 'less_than' | 'between' | 'equals'

export interface SegmentRule {
  field: 'total_spent' | 'invoice_count' | 'average_invoice' | 'days_since_last' | 'overdue'
  operator: SegmentOperator
  value: number
  /** Only for `between`. */
  valueTo?: number
}

export interface SegmentFacts {
  totalSpent: number
  invoiceCount: number
  averageInvoice: number
  daysSinceLast: number | null
  overdue: number
}

export function evaluateSegment(rules: readonly SegmentRule[], facts: SegmentFacts): boolean {
  // ⚠️ ALL rules, same as the automation engine and the same reason: a segment
  // someone wrote expecting «OR» and getting «AND» returns a silently different
  // list of customers.
  return rules.every((rule) => evaluateRule(rule, facts))
}

function evaluateRule(rule: SegmentRule, facts: SegmentFacts): boolean {
  const actual =
    rule.field === 'total_spent'
      ? facts.totalSpent
      : rule.field === 'invoice_count'
        ? facts.invoiceCount
        : rule.field === 'average_invoice'
          ? facts.averageInvoice
          : rule.field === 'days_since_last'
            ? facts.daysSinceLast
            : facts.overdue

  // ⚠️ AN ABSENT VALUE SATISFIES NOTHING. `daysSinceLast: null` means the
  // customer has never bought, which is not "less than 30 days" — it is the
  // opposite, and a segment that included them would list every dormant
  // customer as a recent one.
  if (actual === null) return false

  switch (rule.operator) {
    case 'greater_than':
      return actual > rule.value
    case 'less_than':
      return actual < rule.value
    case 'equals':
      return actual === rule.value
    case 'between':
      return actual >= rule.value && actual <= (rule.valueTo ?? rule.value)
    default:
      return false
  }
}

// ─── Funnels (#131) ─────────────────────────────────────────────────────────

export interface FunnelStep {
  name: string
  /** How many distinct customers reached this step. */
  customers: number
  /** How many who also reached the one before. Non-increasing by construction. */
  fromPrevious: number
  /** customers / previous, or null when the previous step was empty. */
  conversionPercent: number | null
}

export interface Funnel {
  steps: FunnelStep[]
  /**
   * ⚠️ End to end, as a percentage. Null when the first step is empty — and a
   * funnel that starts at zero has no conversion rate, not a conversion rate
   * of zero.
   */
  overallPercent: number | null
}

/**
 * ⚠️ THE STEPS ARE ORDERED AND NON-INCREASING, and that is enforced by
 * intersecting rather than by trusting the caller's counts.
 *
 * A caller that computed each step independently would produce a funnel where
 * step 3 has more customers than step 2 — because some customers' invoices fall
 * in one month and not another. Intersecting makes that impossible, and a funnel
 * that goes UP is a funnel nobody can read.
 */
export function buildFunnel(
  steps: readonly { name: string; customerIds: ReadonlySet<string> }[],
): Funnel {
  const result: FunnelStep[] = []
  let previous: Set<string> | null = null

  for (const [index, step] of steps.entries()) {
    // ⚠️ The annotation is required: without it, `reached` is inferred from
    // `previous` and `previous` is inferred from `reached`, and TypeScript
    // resolves the cycle to `any` rather than complaining — which would let a
    // `Set<never>` through and silently empty every step.
    const reached: Set<string> =
      previous === null
        ? new Set(step.customerIds)
        : new Set([...previous].filter((id) => step.customerIds.has(id)))

    result.push({
      name: step.name,
      customers: reached.size,
      fromPrevious: reached.size,
      conversionPercent:
        index === 0 || !previous || previous.size === 0
          ? null
          : round2((reached.size / previous.size) * 100),
    })

    previous = reached
  }

  const first = result[0]?.customers ?? 0
  const last = result[result.length - 1]?.customers ?? 0

  return { steps: result, overallPercent: first === 0 ? null : round2((last / first) * 100) }
}
