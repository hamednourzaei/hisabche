// ============================================
// backend/src/services/timesheets/billing.domain.ts
//
// Turning recorded time into something a client can be invoiced for.
//
// ---------------------------------------------------------------------------
// RECORDED, BILLABLE AND BILLED ARE THREE DIFFERENT NUMBERS
//
// A day has eight recorded hours, six of them billable, and four already on an
// invoice. Systems that conflate any two of these either bill for internal
// time or bill the same hour twice, and both are the kind of mistake a client
// notices before you do.
//
// So every entry carries all three states explicitly, and an entry that has
// been invoiced is LOCKED against the invoice that took it — not by a flag
// that can be cleared, but by the invoice id itself.
// ============================================

export type BillingMethod =
  /** Bill the hours at a rate. */
  | 'hourly'
  /** A fixed price; time is tracked for margin, not for billing. */
  | 'fixed'
  /** Not billed at all — internal work, warranty, goodwill. */
  | 'non_billable'

export interface TimeEntry {
  id: string
  projectId: string
  taskId?: string | null
  employeeId: string
  onDate: string
  /** Minutes, not hours: 1.5 hours cannot be stored exactly as a float. */
  minutes: number
  /** The person marked this as billable when they logged it. */
  billable: boolean
  /** Minor units per hour. Null falls back to the project rate. */
  rateMinor?: number | null
  /** Set once invoiced. Its presence is the lock. */
  invoiceId?: string | null
  description: string
}

export interface ProjectBillingConfig {
  projectId: string
  method: BillingMethod
  /** Minor units per hour, used when an entry has no rate of its own. */
  defaultRateMinor: number
  /** Minor units. A cap on what may be billed in total. */
  budgetCapMinor?: number | null
}

export interface BillableLine {
  projectId: string
  employeeId: string
  /** Entries rolled into this line. */
  entryIds: string[]
  minutes: number
  rateMinor: number
  /** Minor units. minutes ÷ 60 × rate, rounded once at the end. */
  amountMinor: number
  description: string
}

function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value)
}

export interface TimeTotals {
  recordedMinutes: number
  billableMinutes: number
  /** Already on an invoice. */
  billedMinutes: number
  /** Billable and not yet invoiced. What can be billed right now. */
  unbilledMinutes: number
  unbilledAmountMinor: number
}

export function summarise(entries: TimeEntry[], config: ProjectBillingConfig): TimeTotals {
  const recorded = entries.reduce((sum, entry) => sum + entry.minutes, 0)

  // A fixed-price or non-billable project has no billable time however the
  // individual entries were flagged: the project's method wins over a person
  // ticking a box on a form.
  const billableEntries =
    config.method === 'hourly' ? entries.filter((entry) => entry.billable) : []

  const billable = billableEntries.reduce((sum, entry) => sum + entry.minutes, 0)
  const billed = billableEntries
    .filter((entry) => entry.invoiceId)
    .reduce((sum, entry) => sum + entry.minutes, 0)

  const unbilled = billableEntries.filter((entry) => !entry.invoiceId)

  return {
    recordedMinutes: recorded,
    billableMinutes: billable,
    billedMinutes: billed,
    unbilledMinutes: billable - billed,
    unbilledAmountMinor: unbilled.reduce(
      (sum, entry) =>
        sum +
        roundHalfAwayFromZero((entry.minutes / 60) * (entry.rateMinor ?? config.defaultRateMinor)),
      0,
    ),
  }
}

export type TimesheetRuleCode =
  | 'TIME_ALREADY_INVOICED'
  | 'TIME_NOT_BILLABLE'
  | 'TIME_ZERO_MINUTES'
  | 'TIME_BUDGET_CAP_EXCEEDED'
  | 'TIME_RATE_MISSING'

/**
 * Whether these entries may go onto an invoice.
 *
 * An already-invoiced entry is refused, not skipped. Skipping it silently
 * produces an invoice for less than the operator expected and no explanation
 * of where the missing hours went.
 */
export function validateBilling(
  entries: TimeEntry[],
  config: ProjectBillingConfig,
  alreadyBilledMinor = 0,
): TimesheetRuleCode[] {
  const problems: TimesheetRuleCode[] = []

  if (config.method !== 'hourly') problems.push('TIME_NOT_BILLABLE')

  for (const entry of entries) {
    if (entry.invoiceId) problems.push('TIME_ALREADY_INVOICED')
    if (!entry.billable) problems.push('TIME_NOT_BILLABLE')
    if (entry.minutes <= 0) problems.push('TIME_ZERO_MINUTES')

    const rate = entry.rateMinor ?? config.defaultRateMinor
    // Billing an hour at zero is not a discount; it is a rate somebody forgot
    // to set, and it silently gives the work away.
    if (!(rate > 0)) problems.push('TIME_RATE_MISSING')
  }

  if (config.budgetCapMinor != null) {
    const amount = entries.reduce(
      (sum, entry) =>
        sum +
        roundHalfAwayFromZero((entry.minutes / 60) * (entry.rateMinor ?? config.defaultRateMinor)),
      0,
    )
    if (alreadyBilledMinor + amount > config.budgetCapMinor) {
      problems.push('TIME_BUDGET_CAP_EXCEEDED')
    }
  }

  return [...new Set(problems)]
}

/**
 * Roll time into invoice lines.
 *
 * Grouped by employee and rate, because those are the two things a client
 * questions. Rounding happens ONCE per line, on the summed minutes — rounding
 * each entry and adding them turns eleven six-minute calls into a different
 * number than one sixty-six-minute block.
 */
export function buildBillableLines(
  entries: TimeEntry[],
  config: ProjectBillingConfig,
): BillableLine[] {
  if (config.method !== 'hourly') return []

  const groups = new Map<string, TimeEntry[]>()

  for (const entry of entries) {
    if (!entry.billable || entry.invoiceId) continue
    const rate = entry.rateMinor ?? config.defaultRateMinor
    const key = `${entry.employeeId}:${rate}`
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }

  return (
    [...groups.entries()]
      .map(([key, group]) => {
        const rateMinor = Number(key.split(':')[1])
        const minutes = group.reduce((sum, entry) => sum + entry.minutes, 0)

        return {
          projectId: config.projectId,
          employeeId: group[0]!.employeeId,
          entryIds: group.map((entry) => entry.id).sort(),
          minutes,
          rateMinor,
          amountMinor: roundHalfAwayFromZero((minutes / 60) * rateMinor),
          description: `${Math.floor(minutes / 60)}h ${minutes % 60}m`,
        }
      })
      // Stable order so the same timesheet always produces the same invoice.
      .sort((a, b) => (a.employeeId < b.employeeId ? -1 : a.employeeId > b.employeeId ? 1 : 0))
  )
}

export interface ProjectProfitability {
  projectId: string
  /** Minor units invoiced to the client. */
  revenueMinor: number
  /** Minor units of employee time at COST, not at the billing rate. */
  labourCostMinor: number
  /** Minor units of materials and expenses charged to the project. */
  expenseMinor: number
  marginMinor: number
  marginPercent: number | null
  /** Hours worked that will never be billed. The real leak on fixed price. */
  unbillableMinutes: number
}

/**
 * Whether a project actually made money.
 *
 * Labour is valued at COST — what the employee is paid — not at the rate the
 * client is charged. Using the billing rate on both sides makes every project
 * look like it broke exactly even, which is the most common way an agency
 * discovers a loss only at year end.
 */
export function profitability(input: {
  projectId: string
  revenueMinor: number
  expenseMinor: number
  entries: TimeEntry[]
  /** Minor units per hour that each employee actually costs. */
  costRateByEmployee: Map<string, number>
}): ProjectProfitability {
  const labourCostMinor = input.entries.reduce(
    (sum, entry) =>
      sum +
      roundHalfAwayFromZero(
        (entry.minutes / 60) * (input.costRateByEmployee.get(entry.employeeId) ?? 0),
      ),
    0,
  )

  const marginMinor = input.revenueMinor - labourCostMinor - input.expenseMinor

  return {
    projectId: input.projectId,
    revenueMinor: input.revenueMinor,
    labourCostMinor,
    expenseMinor: input.expenseMinor,
    marginMinor,
    marginPercent:
      input.revenueMinor === 0 ? null : Math.round((marginMinor / input.revenueMinor) * 1000) / 10,
    unbillableMinutes: input.entries
      .filter((entry) => !entry.billable)
      .reduce((sum, entry) => sum + entry.minutes, 0),
  }
}
