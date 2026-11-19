// ============================================
// WP-15 — MILESTONE_INVOICE_WIRING_PARTIAL.
//
// An invoice may be issued only for APPROVED time. Unapproved hours are work in
// progress, not revenue. The rule is pure so the device and the server agree on
// what may be billed before either writes an invoice.
// ============================================

export interface TimeEntryForBilling {
  id: string
  hours: number
  approved: boolean
  billable: boolean
  /** The agreed rate, integer minor units per hour. */
  rateMinor: number
}

export interface BillableTime {
  approvedHours: number
  billableHours: number
  amountMinor: number
  entryIds: readonly string[]
}

/** `null` when any operand is unknown — never a revenue figure built on a guess. */
export function billableTimeOf(entries: readonly TimeEntryForBilling[]): BillableTime | null {
  let approvedHours = 0
  let billableHours = 0
  let amountMinor = 0
  const entryIds: string[] = []

  for (const entry of entries) {
    if (!Number.isFinite(entry.hours) || entry.hours < 0) return null
    if (!Number.isSafeInteger(entry.rateMinor) || entry.rateMinor < 0) return null
    if (!entry.approved) continue
    approvedHours += entry.hours
    if (!entry.billable) continue
    billableHours += entry.hours
    amountMinor += Math.round(entry.hours * entry.rateMinor)
    entryIds.push(entry.id)
  }

  if (!Number.isFinite(approvedHours) || !Number.isFinite(amountMinor)) return null
  return { approvedHours, billableHours, amountMinor, entryIds }
}

export interface MilestoneReadiness {
  ready: boolean
  approvedHours: number
  requiredHours: number
  remainingHours: number
}

/**
 * A milestone is ready only when APPROVED hours cover the agreed effort. An
 * unapproved entry must never unlock an invoice, however many hours it claims.
 */
export function milestoneReadiness(
  time: BillableTime | null,
  requiredHours: number,
): MilestoneReadiness | null {
  if (time === null || !Number.isFinite(requiredHours) || requiredHours < 0) return null
  const remainingHours = Math.max(0, requiredHours - time.approvedHours)
  return {
    ready: remainingHours === 0 && time.approvedHours > 0,
    approvedHours: time.approvedHours,
    requiredHours,
    remainingHours,
  }
}
