// ============================================
// packages/validation/src/schemas/deferral.domain.ts
//
// OPTION 4: DEFERRED REVENUE & REVENUE RECOGNITION
//
// Stated in integer minor units.
// 1,200 over 12 months: one reclass entry, 12 recognitions, last absorbs rounding.
// ============================================

export interface DeferralScheduleLine {
  readonly periodIndex: number // 1..periods
  readonly recognitionDate: string // YYYY-MM-DD
  readonly amountMinor: number
  readonly isRecognized: boolean
}

export interface DeferralSchedule {
  readonly id: string
  readonly sourceInvoiceId: string
  readonly totalMinor: number
  readonly periods: number
  readonly startDate: string
  readonly lines: readonly DeferralScheduleLine[]
}

/**
 * Build a deferred revenue recognition schedule.
 * All amounts integer minor units; last period absorbs rounding difference so
 * sum(lines.amountMinor) === totalMinor exactly.
 */
export function buildDeferralSchedule(
  totalMinor: number,
  periods: number,
  startDate: string,
): readonly DeferralScheduleLine[] {
  if (periods <= 0 || totalMinor <= 0) return []

  const basePerPeriod = Math.floor(totalMinor / periods)
  const lines: DeferralScheduleLine[] = []
  let cumulative = 0

  const start = new Date(startDate)

  for (let i = 1; i <= periods; i++) {
    const isLast = i === periods
    const amountMinor = isLast ? totalMinor - cumulative : basePerPeriod
    cumulative += amountMinor

    const lineDate = new Date(start)
    lineDate.setMonth(lineDate.getMonth() + (i - 1))
    const recognitionDate = lineDate.toISOString().slice(0, 10)

    lines.push({
      periodIndex: i,
      recognitionDate,
      amountMinor,
      isRecognized: false,
    })
  }

  return lines
}
