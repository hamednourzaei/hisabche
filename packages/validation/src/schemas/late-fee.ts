// ============================================
// Late payment fee policy (#124) — what a person may save.
//
// ⚠️ OFF UNLESS TURNED ON. A business with no policy charges nothing, and
// saving a policy does not turn it on by itself: `isEnabled` is stated.
//
// ⚠️ A FIXED AMOUNT ALWAYS HAS ITS CURRENCY and is only charged on an invoice
// in that currency — it is never converted. A percentage has no currency.
//
// Shared so the form refuses what the server would refuse, with the same codes.
// ============================================

import { z } from 'zod'

export const LATE_FEE_BASES = ['per_period', 'percentage'] as const
export type LateFeeBasisName = (typeof LATE_FEE_BASES)[number]

/** Days in the period a fixed amount is charged for. Stated to the person. */
export const LATE_FEE_PERIOD_DAYS = 30

export const lateFeePolicySchema = z
  .object({
    isEnabled: z.boolean(),
    basis: z.enum(LATE_FEE_BASES),
    /** `per_period`: the amount charged for each full period late, in `currency`. */
    amount: z.number().positive().max(1_000_000_000_000).nullable().default(null),
    currency: z.string().trim().length(3).nullable().default(null),
    /** `percentage`: the share of what is overdue, charged once. */
    percent: z.number().positive().max(100).nullable().default(null),
    /** Whole days after the due date before anything is charged. */
    graceDays: z.number().int().min(0).max(365).default(0),
    /** Never more than this share of what is overdue, however late it is. */
    maxSharePercent: z.number().positive().max(100).default(100),
  })
  .superRefine((value, ctx) => {
    if (value.basis === 'per_period') {
      if (value.amount === null) {
        ctx.addIssue({ code: 'custom', path: ['amount'], message: 'LATE_FEE_AMOUNT_REQUIRED' })
      }
      if (!value.currency) {
        ctx.addIssue({ code: 'custom', path: ['currency'], message: 'LATE_FEE_CURRENCY_REQUIRED' })
      }
    }
    if (value.basis === 'percentage' && value.percent === null) {
      ctx.addIssue({ code: 'custom', path: ['percent'], message: 'LATE_FEE_PERCENT_REQUIRED' })
    }
  })

export type LateFeePolicyInput = z.infer<typeof lateFeePolicySchema>

/** The saved policy as the API returns it. */
export interface LateFeePolicy extends LateFeePolicyInput {
  updatedAt: string
}
