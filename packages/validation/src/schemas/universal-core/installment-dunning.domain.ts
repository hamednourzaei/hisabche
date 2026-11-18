// ============================================
// WP-13 gap C — AUTO_DUNNING_REMINDERS_SERVER_ONLY.
//
// An installment that is past due must show `overdue` on the DEVICE too. The
// status is a fact about the schedule and the clock; a reminder is a separate
// decision a shop opts into. They must not be tied together: hiding a real
// overdue status because the reminder switch is off is exactly the "unknown
// shown as zero" shape this codebase refuses.
//
// This file reuses `overdueInstallments` from installment.domain for the date
// work. It adds no second calendar. It returns decisions; the caller records
// that a reminder was actually sent.
// ============================================

import {
  overdueInstallments,
  type InstallmentSchedule,
  type LateFeeSettings,
} from '../installment.domain'

/** Reminders are off by default; most shops do not chase customers. */
export interface DunningPolicy {
  enabled: boolean
  /** Days past due before a line counts as overdue. Shares the late-fee grace. */
  graceDays: number
  /** Days between reminders. */
  reminderIntervalDays: number
  /** Never send more than this many reminders for one line. */
  maxReminders: number
}

export const DEFAULT_DUNNING_POLICY: DunningPolicy = {
  enabled: false,
  graceDays: 0,
  reminderIntervalDays: 7,
  maxReminders: 3,
}

export type InstallmentDunningStatus = 'paid' | 'due' | 'overdue'

export interface DunningEntry {
  scheduleId: string
  seq: number
  dueDate: string
  status: InstallmentDunningStatus
  daysLate: number
  overdueMinor: number
  reminderDue: boolean
  reminderCount: number
}

/**
 * `overdueInstallments` filters on `value <= 0`, which is right for late FEES
 * but would hide the overdue STATUS. Give it a settings object whose cap is 0:
 * it then uses the same grace-day date rule and produces no charge at all.
 */
const FEE_FREE_SETTINGS: LateFeeSettings = {
  basis: 'per_period',
  value: 1,
  graceDays: 0,
  maxShareOfOverduePercent: 0,
}

function validPolicy(policy: DunningPolicy): boolean {
  return (
    Number.isInteger(policy.graceDays) &&
    policy.graceDays >= 0 &&
    Number.isInteger(policy.reminderIntervalDays) &&
    policy.reminderIntervalDays > 0 &&
    Number.isInteger(policy.maxReminders) &&
    policy.maxReminders >= 0
  )
}

/**
 * Derive overdue status and — only when enabled — whether a reminder is now due.
 *
 * ⚠️ A PAID LINE IS NEVER LATE however old it is. The check is on `paidMinor`,
 * not on a date. ⚠️ AN INVALID POLICY DOES NOT SILENTLY BECOME "remind now":
 * it produces no reminders, while the overdue statuses still show.
 */
export function decideDunning(
  schedule: readonly InstallmentSchedule[],
  asOf: string,
  policy: DunningPolicy = DEFAULT_DUNNING_POLICY,
  remindersSent: Readonly<Record<string, number>> = {},
): DunningEntry[] {
  const settings: LateFeeSettings = { ...FEE_FREE_SETTINGS, graceDays: policy.graceDays }
  const overdue = new Map(
    overdueInstallments(schedule, asOf, settings).map((line) => [line.scheduleId, line]),
  )
  const remindersOn = policy.enabled && validPolicy(policy)

  return schedule.map((line) => {
    const count = Math.max(0, Math.floor(Number(remindersSent[line.id] ?? 0)) || 0)
    const late = overdue.get(line.id)
    const paid = line.paidMinor >= line.amountMinor
    const status: InstallmentDunningStatus = paid ? 'paid' : late ? 'overdue' : 'due'
    const daysLate = paid || !late ? 0 : late.daysLate

    const reminderDue =
      remindersOn &&
      status === 'overdue' &&
      count < policy.maxReminders &&
      daysLate - policy.graceDays >= policy.reminderIntervalDays * (count + 1)

    return {
      scheduleId: line.id,
      seq: line.seq,
      dueDate: line.dueDate,
      status,
      daysLate,
      overdueMinor: paid ? 0 : (late?.overdueMinor ?? 0),
      reminderDue,
      reminderCount: count,
    }
  })
}
