// ============================================
// Dashboard date ranges.
//
// "Last 7 days" has to mean the same seven days whether the user picked it in
// the browser or on a phone — otherwise the two devices show different totals
// for what the UI calls the same period, and the numbers look wrong rather than
// merely different.
//
// So the preset → dates rule lives here, with no DOM and no date library, and
// each renderer supplies only the control: a popover on web, an action sheet on
// mobile.
// ============================================

export interface DateRange {
  from: Date
  to: Date
}

export type PresetKey =
  | 'today'
  | 'yesterday'
  | 'weekAgo'
  | '7days'
  | '14days'
  | '30days'
  | '60days'
  | '90days'
  | 'thisMonth'
  | 'lastMonth'
  | 'last3Months'
  | 'last6Months'
  | 'thisYear'
  | 'lastYear'
  | 'custom'

export interface PresetDefinition {
  key: PresetKey
  labelKey: string
}

/**
 * Presets a compact control offers, in order.
 *
 * Web's popover groups all fifteen under headings; a phone action sheet cannot
 * carry that many without becoming a scroll of its own, so mobile shows this
 * subset — the ranges a shop owner actually switches between day to day. The
 * *meaning* of each is identical because both resolve through `presetRange`.
 */
export const COMPACT_PRESETS: readonly PresetDefinition[] = [
  { key: 'today', labelKey: 'dateRange.today' },
  { key: '7days', labelKey: 'dateRange.7days' },
  { key: '30days', labelKey: 'dateRange.30days' },
  { key: 'thisMonth', labelKey: 'dateRange.thisMonth' },
  { key: 'lastMonth', labelKey: 'dateRange.lastMonth' },
  { key: 'thisYear', labelKey: 'dateRange.thisYear' },
]

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Dates a preset resolves to.
 *
 * `now` is injected so this is a pure function — the same input always gives
 * the same range, which is what makes it testable and what stops two platforms
 * disagreeing across a midnight boundary.
 *
 * Day counts are inclusive of today: "7 days" is today plus the six before it,
 * matching what the web picker has always produced.
 */
export function presetRange(preset: PresetKey, now: Date = new Date()): DateRange {
  const today = startOfDay(now)
  const todayEnd = endOfDay(now)

  const daysBack = (days: number): DateRange => {
    const d = new Date(today)
    d.setDate(d.getDate() - days)
    return { from: startOfDay(d), to: todayEnd }
  }

  const monthsBack = (months: number): DateRange => {
    const d = new Date(today)
    d.setMonth(d.getMonth() - months)
    return { from: startOfDay(d), to: todayEnd }
  }

  switch (preset) {
    case 'today':
      return { from: today, to: todayEnd }
    case 'yesterday': {
      const d = new Date(today)
      d.setDate(d.getDate() - 1)
      return { from: startOfDay(d), to: endOfDay(d) }
    }
    case 'weekAgo':
      return daysBack(7)
    case '7days':
      return daysBack(6)
    case '14days':
      return daysBack(13)
    case '30days':
      return daysBack(29)
    case '60days':
      return daysBack(59)
    case '90days':
      return daysBack(89)
    case 'thisMonth':
      return { from: startOfDay(new Date(today.getFullYear(), today.getMonth(), 1)), to: todayEnd }
    case 'lastMonth':
      return {
        from: startOfDay(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        // Day 0 of this month is the last day of the previous one.
        to: endOfDay(new Date(today.getFullYear(), today.getMonth(), 0)),
      }
    case 'last3Months':
      return monthsBack(3)
    case 'last6Months':
      return monthsBack(6)
    case 'thisYear':
      return { from: startOfDay(new Date(today.getFullYear(), 0, 1)), to: todayEnd }
    case 'lastYear':
      return {
        from: startOfDay(new Date(today.getFullYear() - 1, 0, 1)),
        to: endOfDay(new Date(today.getFullYear() - 1, 11, 31)),
      }
    default:
      // 'custom' carries its dates on the state, not in this table.
      return { from: today, to: todayEnd }
  }
}
