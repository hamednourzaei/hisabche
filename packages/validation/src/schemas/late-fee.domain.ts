// ============================================
// packages/validation/src/schemas/late-fee.domain.ts
//
// Capability #124 — what a late fee is, worked out from facts. The server
// (`LateFeeService`) and the device (the local engine's `routes/late-fees.ts`)
// read their own rows into these shapes and ask this file: what is the state,
// what is overdue, what may be charged, what is the line on the fee invoice.
// The charge itself (an ordinary sale invoice) is each runtime's invoice path.
//
// The overdue arithmetic is `overdueInstallments` (installment.domain).
// ============================================

import {
  overdueInstallments,
  type InstallmentSchedule,
  type LateFeeSettings,
} from './installment.domain'
import { LATE_FEE_PERIOD_DAYS, type LateFeePolicy } from './late-fee'
import { minor } from './money'

/** Why nothing can be charged on this invoice — or `ready`. */
export type LateFeeState =
  | 'ready'
  | 'off'
  | 'other_currency'
  | 'not_sale'
  | 'cancelled'
  | 'no_customer'
  | 'no_due_date'
  | 'fee_invoice'

export const LATE_FEE_LANGUAGES = ['fa', 'af', 'en'] as const
export type LateFeeLanguage = (typeof LATE_FEE_LANGUAGES)[number]

/** The line written on the fee invoice. A stored document, so it has a language. */
export const FEE_LINE: Record<LateFeeLanguage, (invoiceNumber: string, seq: number) => string> = {
  fa: (n, seq) =>
    seq > 0 ? `جریمه‌ی دیرکرد فاکتور ${n} — قسط ${seq}` : `جریمه‌ی دیرکرد فاکتور ${n}`,
  af: (n, seq) => (seq > 0 ? `جریمه‌ی تأخیر بل ${n} — قسط ${seq}` : `جریمه‌ی تأخیر بل ${n}`),
  en: (n, seq) =>
    seq > 0 ? `Late fee on invoice ${n} — installment ${seq}` : `Late fee on invoice ${n}`,
}

export interface LateFeeLine {
  /** The installment; 0 = the invoice as a whole (it has no plan). */
  seq: number
  dueDate: string
  daysLate: number
  /** Major units of the invoice's currency, like every amount below. */
  overdue: number
  /** What the policy asks for in total, as of today. */
  fee: number
  /** What has already been charged for this line. */
  assessed: number
  /** What a manager can charge now. */
  toAssess: number
  /** True when the cap limited the fee. */
  capped: boolean
}

export interface LateFeeAssessment {
  id: string
  seq: number
  periodNo: number
  dueDate: string
  daysLate: number
  overdue: number
  fee: number
  assessedAt: string
  /** Null while the fee invoice has not been issued yet. */
  feeInvoiceId: string | null
}

export interface LateFeePreview {
  invoiceId: string
  invoiceNumber: string
  currency: string
  state: LateFeeState
  policy: LateFeePolicy | null
  lines: LateFeeLine[]
  totalToAssess: number
  assessments: LateFeeAssessment[]
}

/** A stored assessment, as both databases keep it. */
export interface LateFeeAssessmentRow {
  id: string
  seq: number
  period_no: number
  due_date: string
  days_late: number
  overdue_minor: number | string
  fee_minor: number | string
  currency: string
  fee_invoice_id: string | null
  assessed_at: string
}

export interface LateFeeInvoiceFacts {
  id: string
  invoiceNumber: string
  type: string
  status: string
  customerId: string | null
  currency: string
  dueDate: string | null
  totalMinor: number
  allocatedMinor: number
}

export interface PlannedInstallment {
  seq: number
  dueDate: string
  amount: number
  paid: number
}

const major = (hundredths: number | string) => Number(hundredths) / 100

/**
 * The domain's settings for an invoice in `currency`, or why there are none.
 *
 * ⚠️ A fixed amount in another currency is LEFT OUT, not converted.
 */
export function settingsFor(
  policy: LateFeePolicy | null,
  currency: string,
): { settings: LateFeeSettings } | { state: 'off' | 'other_currency' } {
  if (!policy || !policy.isEnabled) return { state: 'off' }
  if (policy.basis === 'per_period') {
    if (policy.currency !== currency) return { state: 'other_currency' }
    return {
      settings: {
        basis: 'per_period',
        value: minor(policy.amount ?? 0),
        graceDays: policy.graceDays,
        maxShareOfOverduePercent: policy.maxSharePercent,
      },
    }
  }
  return {
    settings: {
      basis: 'percentage',
      value: policy.percent ?? 0,
      graceDays: policy.graceDays,
      maxShareOfOverduePercent: policy.maxSharePercent,
    },
  }
}

/** Which period an assessment made today belongs to. A percentage is charged once: 0. */
export function periodOf(policy: LateFeePolicy, daysLate: number): number {
  return policy.basis === 'per_period' ? Math.floor(daysLate / LATE_FEE_PERIOD_DAYS) : 0
}

/**
 * What may be charged now on one line, in hundredths.
 *
 * A period already assessed is never assessed again — whatever the policy has
 * become since. Otherwise it is what the policy asks for in total, less what
 * has been charged.
 */
export function chargeableMinor(
  policy: LateFeePolicy,
  line: { daysLate: number; feeMinor: number },
  assessed: readonly { periodNo: number; feeMinor: number }[],
): number {
  if (assessed.some((row) => row.periodNo === periodOf(policy, line.daysLate))) return 0
  const already = assessed.reduce((sum, row) => sum + row.feeMinor, 0)
  return Math.max(0, line.feeMinor - already)
}

/**
 * What is due and when: the installment plan when the invoice has one,
 * otherwise the invoice as one line on its own due date. `null` = no plan and
 * no due date, so nothing can be late.
 */
export function lateFeeSchedule(
  invoice: LateFeeInvoiceFacts,
  plannedLines: readonly PlannedInstallment[],
): InstallmentSchedule[] | null {
  if (plannedLines.length > 0) {
    return plannedLines.map((line) => ({
      id: `${invoice.id}:${line.seq}`,
      invoiceId: invoice.id,
      seq: line.seq,
      dueDate: line.dueDate,
      amountMinor: minor(line.amount),
      paidMinor: minor(line.paid),
    }))
  }
  if (!invoice.dueDate) return null
  return [
    {
      id: invoice.id,
      invoiceId: invoice.id,
      seq: 0,
      dueDate: invoice.dueDate,
      amountMinor: invoice.totalMinor,
      paidMinor: Math.min(invoice.totalMinor, Math.max(0, invoice.allocatedMinor)),
    },
  ]
}

/** What is overdue on the invoice, what the policy asks for, and what was charged. */
export function buildLateFeePreview(input: {
  invoice: LateFeeInvoiceFacts
  policy: LateFeePolicy | null
  assessments: readonly LateFeeAssessmentRow[]
  /** The installments of the plan (empty when there is none). */
  plannedLines: readonly PlannedInstallment[]
  /** True when this invoice is itself a late fee — no fee on a fee. */
  isFeeInvoice: boolean
  asOf: string
}): LateFeePreview {
  const { invoice, policy, assessments } = input
  const base = {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    currency: invoice.currency,
    policy,
    assessments: assessments.map((row) => ({
      id: row.id,
      seq: row.seq,
      periodNo: row.period_no,
      dueDate: String(row.due_date).slice(0, 10),
      daysLate: row.days_late,
      overdue: major(row.overdue_minor),
      fee: major(row.fee_minor),
      assessedAt: row.assessed_at,
      feeInvoiceId: row.fee_invoice_id,
    })),
  }
  const nothing = (state: LateFeeState): LateFeePreview => ({
    ...base,
    state,
    lines: [],
    totalToAssess: 0,
  })

  if (invoice.type !== 'sale') return nothing('not_sale')
  if (invoice.status === 'cancelled') return nothing('cancelled')
  if (input.isFeeInvoice) return nothing('fee_invoice')
  if (!invoice.customerId) return nothing('no_customer')

  const resolved = settingsFor(policy, invoice.currency)
  if ('state' in resolved) return nothing(resolved.state)

  const schedule = lateFeeSchedule(invoice, input.plannedLines)
  if (schedule === null) return nothing('no_due_date')

  const lines = overdueInstallments(schedule, input.asOf, resolved.settings).map((line) => {
    const charged = assessments
      .filter((row) => row.seq === line.seq)
      .map((row) => ({ periodNo: row.period_no, feeMinor: Number(row.fee_minor) }))
    const toAssessMinor = chargeableMinor(policy!, line, charged)
    return {
      seq: line.seq,
      dueDate: line.dueDate,
      daysLate: line.daysLate,
      overdue: major(line.overdueMinor),
      fee: major(line.feeMinor),
      assessed: major(charged.reduce((sum, row) => sum + row.feeMinor, 0)),
      toAssess: major(toAssessMinor),
      capped: line.capped,
    }
  })

  return {
    ...base,
    state: 'ready',
    lines,
    totalToAssess: major(lines.reduce((sum, line) => sum + minor(line.toAssess), 0)),
  }
}

export interface LateFeeWork {
  unfinished: { id: string; seq: number; periodNo: number; feeMinor: number }[]
  chargeable: {
    seq: number
    dueDate: string
    daysLate: number
    overdueMinor: number
    periodNo: number
    feeMinor: number
  }[]
}

/**
 * What an `assess` call must do, given its preview: finish the assessments
 * whose fee invoice was never issued, and charge the lines that can be charged.
 * A refusal is the name both runtimes raise.
 */
export function planLateFeeAssessment(preview: LateFeePreview): { refusal: string } | LateFeeWork {
  if (preview.state !== 'ready') return { refusal: `LATE_FEE_${preview.state.toUpperCase()}` }
  const unfinished = preview.assessments
    .filter((row) => row.feeInvoiceId === null)
    .map((row) => ({
      id: row.id,
      seq: row.seq,
      periodNo: row.periodNo,
      feeMinor: minor(row.fee),
    }))
  const chargeable = preview.lines
    .filter((line) => line.toAssess > 0)
    .map((line) => ({
      seq: line.seq,
      dueDate: line.dueDate,
      daysLate: line.daysLate,
      overdueMinor: minor(line.overdue),
      periodNo: periodOf(preview.policy!, line.daysLate),
      feeMinor: minor(line.toAssess),
    }))
  if (unfinished.length === 0 && chargeable.length === 0) {
    return { refusal: 'LATE_FEE_NOTHING_TO_ASSESS' }
  }
  return { unfinished, chargeable }
}
