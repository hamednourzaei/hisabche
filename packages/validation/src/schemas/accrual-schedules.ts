import { z } from 'zod'

export const createAccrualScheduleSchema = z.object({
  source_document_type: z.string().min(1).max(64),
  source_document_id: z.string().uuid(),
  description: z.string().min(1).max(200),
  total_amount_minor: z.number().int().positive(),
  currency: z.string().min(3).max(8),
  periods_count: z.number().int().min(1).max(120),
  start_date: z.string().min(8).max(32),
  debit_account_id: z.string().uuid(),
  credit_account_id: z.string().uuid(),
})

export interface PlannedAccrualPeriod {
  periodIndex: number
  periodDate: string
  amountMinor: number
}

export function buildAccrualPeriods(
  totalAmountMinor: number,
  periodsCount: number,
  startDateIso: string,
): PlannedAccrualPeriod[] {
  const base = Math.floor(totalAmountMinor / periodsCount)
  const remainder = totalAmountMinor - base * periodsCount
  const start = new Date(`${startDateIso.slice(0, 10)}T00:00:00Z`)

  const periods: PlannedAccrualPeriod[] = []
  for (let i = 0; i < periodsCount; i++) {
    // ⚠️ Clamp to the month's last day. `Date.UTC(y, m + i, 31)` in a 28-day
    // month silently becomes the 3rd of the NEXT month, so a schedule starting
    // on 31 Jan skipped February (V61 audit, 12 Nov 2026).
    const year = start.getUTCFullYear()
    const month = start.getUTCMonth() + i
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const d = new Date(Date.UTC(year, month, Math.min(start.getUTCDate(), lastDay)))
    periods.push({
      periodIndex: i + 1,
      periodDate: d.toISOString().slice(0, 10),
      amountMinor: i === periodsCount - 1 ? base + remainder : base,
    })
  }
  return periods
}
