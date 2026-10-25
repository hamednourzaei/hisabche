// ============================================
// packages/validation/src/schemas/installment-plan.ts
//
// The plan of one invoice, as the invoice page reads it. Shared by the server
// (`InstallmentService`) and the device (the local engine's
// `routes/installments.ts`): both hand the stored rows and what the invoice
// still owes to these functions. Neither re-derives who has paid which part.
// ============================================

import { planSchedule, type Minor } from './installment.domain'
import { daysBetween } from './payments.domain'

export interface InstallmentLine {
  seq: number
  dueDate: string
  /** Major units of the invoice's currency. */
  amount: number
  paid: number
  remaining: number
  /** Whole days past the due date with something still unpaid; 0 otherwise. */
  daysLate: number
}

export interface InstallmentPlan {
  invoiceId: string
  currency: string
  /** What the invoice owes now (total − allocated), major units. */
  outstanding: number
  /** Empty = the invoice has no plan. */
  lines: InstallmentLine[]
  /** The next unpaid installment, or null when there is no plan or it is all paid. */
  nextDue: { seq: number; dueDate: string; remaining: number } | null
}

export interface InstallmentStoredRow {
  seq: number
  due_date: string
  amount_minor: number | string
}

/** What an invoice owes, in the hundredths a plan is kept in. Never negative. */
export function outstandingHundredths(outstandingMajor: number | string | null): number {
  return Math.max(0, Math.round((Number(outstandingMajor) || 0) * 100))
}

export function buildInstallmentPlan(input: {
  invoiceId: string
  currency: string | null
  outstandingHundredths: number
  rows: readonly InstallmentStoredRow[]
  asOf: string
}): InstallmentPlan {
  const plannedMinor = input.rows.reduce((sum, row) => sum + Number(row.amount_minor), 0)
  // Paid toward the plan = what the plan asked for, less what is still owed.
  // Never negative: a later credit note can leave more owed than planned.
  let paidLeft = Math.max(0, plannedMinor - input.outstandingHundredths)

  const lines: InstallmentLine[] = input.rows.map((row) => {
    const amountMinor = Number(row.amount_minor)
    const paidMinor = Math.min(amountMinor, paidLeft)
    paidLeft -= paidMinor
    const remainingMinor = amountMinor - paidMinor
    const dueDate = String(row.due_date).slice(0, 10)
    return {
      seq: row.seq,
      dueDate,
      amount: amountMinor / 100,
      paid: paidMinor / 100,
      remaining: remainingMinor / 100,
      // A paid installment is never late, however old it is.
      daysLate: remainingMinor > 0 ? Math.max(0, daysBetween(dueDate, input.asOf)) : 0,
    }
  })

  const next = lines.find((line) => line.remaining > 0) ?? null
  return {
    invoiceId: input.invoiceId,
    currency: input.currency ?? '',
    outstanding: input.outstandingHundredths / 100,
    lines,
    nextDue: next ? { seq: next.seq, dueDate: next.dueDate, remaining: next.remaining } : null,
  }
}

export type InstallmentRefusal = 'INSTALLMENT_NOTHING_OWED' | 'INSTALLMENT_COUNT_INVALID'

/**
 * Split what an invoice owes NOW into `count` monthly parts — or say why not.
 * The refusals are the names both runtimes raise.
 */
export function planInstallments(
  owedHundredths: number,
  input: { count: number; firstDueDate: string },
):
  | { refusal: InstallmentRefusal }
  | { lines: { seq: number; dueDate: string; amountMinor: Minor }[] } {
  if (owedHundredths <= 0) return { refusal: 'INSTALLMENT_NOTHING_OWED' }
  // A part smaller than one minor unit cannot be asked for.
  if (owedHundredths < input.count) return { refusal: 'INSTALLMENT_COUNT_INVALID' }
  return {
    lines: planSchedule({
      totalMinor: owedHundredths,
      count: input.count,
      firstDueDate: input.firstDueDate,
    }),
  }
}
