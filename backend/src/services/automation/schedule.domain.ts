// ============================================
// Capabilities #57, #58, #63, #64, #112 — scheduled and recurring automation.
// Engine N16.
//
// ⚠️ WHAT THIS IS: A DECLARATION LANGUAGE, NOT A RUNNER.
//
// Something already runs the work. `distributed-work.ts` claims a scheduled slot
// across every instance with `FOR UPDATE SKIP LOCKED`; `email-outbox.ts` has its
// own claim family; `AssetsService.postDue`, `CurrencyService.revalue` and
// `runMonthEnd` are the units of work. This module decides WHAT EXISTS and WHEN
// — and produces the claim call, it does not replace the runtime (Phase 0
// removed two parallel runtimes; this adds none).
//
// ⚠️ WHY A DECLARATION LANGUAGE AT ALL, WHEN A CRON STRING WOULD DO.
//
// Because a cron string is a schedule and nothing else: no condition, no scope,
// no failure state, no history, and no way to ask «what is this shop's automation
// actually doing?». Every capability in this phase needs at least two of those,
// and the fifth one needs all six. A cron string cannot grow into them without
// becoming a worse version of this.
//
// ⚠️ A SCHEDULE DECIDES WHEN, NEVER WHETHER. It cannot skip a step or decide one
// is unnecessary — that is a CONDITION, and it is evaluated at run time with real
// data. `RulesEngine` says the same about its own role: «a rule produces a
// DECISION, it never performs one». A schedule that could skip work on its own
// judgement is a schedule that can silently stop doing its job.
//
// ⚠️ AND A SCHEDULE NEVER CREATES ITS OWN TABLE.
//
// `actionType` is a CLOSED SET naming an existing operation. There is no
// `sql`, no `http`, no `script` — a shop's automation that could execute
// arbitrary text would be a remote-code-execution surface wearing a scheduler's
// clothes, and `G4` says a setting nobody was asked about must have a stated
// default, which is not expressible for «run whatever you like».
// ============================================

import { isMonthlySlot, type ScheduleCalendar } from '@hisabche/validation'

/** The closed set of things automation can do. Each names an existing operation. */
export type ActionType =
  /** Capability #64 — raise a draft invoice from a standing arrangement. */
  | 'recurring_invoice'
  /** Capability #64 — raise a draft expense from a standing arrangement. */
  | 'recurring_expense'
  /** Capability #58 — the ordered month-end close. */
  | 'month_end'
  /** Capability #70 — post the depreciation that has fallen due. */
  | 'post_depreciation'
  /** Capability #112 — a campaign's scheduled touches. */
  | 'campaign_touch'

export type ConditionField =
  'day_of_month' | 'days_since_last_run' | 'amount_over' | 'has_open_items' | 'never_run'

export type ConditionOperator = 'equals' | 'greater_than' | 'less_than' | 'exists'

export interface Condition {
  field: ConditionField
  operator: ConditionOperator
  /** Null for `exists`. */
  value?: number | null
}

export type ScheduleCadence =
  /** Once, on a date. */
  | { kind: 'once'; on: string }
  /** Every N days from a start date. */
  | { kind: 'interval'; everyDays: number; from: string }
  /** A named monthly slot, so the 1st stays the 1st across months of 28 days. */
  /**
   * …in a named calendar. Absent = Gregorian, which is what every row saved
   * before the field existed meant.
   */
  | {
      kind: 'monthly'
      dayOfMonth: number
      from: string
      calendar?: ScheduleCalendar | undefined
      /** Minute of the day (0–1439) in `timeZone`; absent = the daily pass. */
      atMinute?: number | undefined
      timeZone?: string | undefined
    }

export interface Automation {
  id: string
  name: string
  enabled: boolean
  cadence: ScheduleCadence
  /**
   * ⚠️ `null` OR `[]` BOTH MEAN «ALWAYS».
   *
   * The first version documented `[]` as an empty AND (false) and then computed
   * it as true, because `?? []` collapses null to an empty array and an empty
   * `.every()` is vacuously true. Rather than ship a rule and a comment that
   * disagree — and rather than reject `[]` so a caller writing it by mistake
   * gets nothing — both spellings mean the same thing, because a shop that
   * typed no conditions meant no conditions.
   */
  conditions: Condition[] | null
  action: {
    type: ActionType
    /** What the action operates on. Shape depends on `type`. */
    payload: Record<string, unknown>
  }
  /**
   * ⚠️ WHAT HAPPENS WHEN IT FAILS. Not optional and not free-text: a schedule
   * with no failure policy is a schedule that stops forever on the first error,
   * and the shop finds out when the customer complains.
   *
   *   stop     try once more at the next slot, then disable and report
   *   keep     keep trying, counting attempts
   *   ignore   record the failure and move on
   */
  onFailure: 'stop' | 'keep' | 'ignore'
  /** How many attempts before `onFailure` applies. */
  maxAttempts: number
}

/** What the runtime knows about a schedule's past. */
export interface AutomationState {
  automationId: string
  lastRunAt: string | null
  attempts: number
  /** False once `onFailure: 'stop'` has exhausted its attempts. */
  stillEnabled: boolean
}

/** The facts a condition is evaluated against. Never read from a request body. */
export interface RunContext {
  dayOfMonth: number
  /** Days since the last successful run, or null if it has never run. */
  daysSinceLastRun: number | null
  /** The amount the action is about, when it has one. */
  amountMinor: number | null
  hasOpenItems: boolean
}

export type ConditionResult = { pass: boolean; field: ConditionField; value: unknown }

export function evaluateCondition(condition: Condition, context: RunContext): ConditionResult {
  const base = { field: condition.field }

  switch (condition.field) {
    case 'day_of_month':
      return {
        ...base,
        pass: context.dayOfMonth === (condition.value ?? 1),
        value: context.dayOfMonth,
      }

    case 'days_since_last_run':
      // ⚠️ A schedule that has never run does not have a gap — and a condition
      // of «more than 30 days since last run» must be TRUE for a first run, or
      // the automation that has never fired can never fire.
      return {
        ...base,
        pass:
          context.daysSinceLastRun === null
            ? true
            : context.daysSinceLastRun > (condition.value ?? 0),
        value: context.daysSinceLastRun,
      }

    case 'amount_over':
      return {
        ...base,
        // ⚠️ An action with no amount does not fail a threshold test. Refusing to
        // run because there was nothing to compare would be a silent skip.
        pass: context.amountMinor === null ? true : context.amountMinor > (condition.value ?? 0),
        value: context.amountMinor,
      }

    case 'has_open_items':
      return { ...base, pass: context.hasOpenItems, value: context.hasOpenItems }

    case 'never_run':
      return { ...base, pass: context.daysSinceLastRun === null, value: context.daysSinceLastRun }

    default:
      return { ...base, pass: false, value: null }
  }
}

/**
 * Whether this slot should run this automation.
 *
 * ⚠️ ALL CONDITIONS MUST PASS. An empty array is NOT «always» — it is an empty
 * `AND`, which is false. That is deliberate: `conditions: null` is how you say
 * «always», and making `[]` mean the same thing would mean two different
 * intentions in the same field.
 */
export function shouldRun(
  automation: Automation,
  context: RunContext,
  state: AutomationState | null,
): { run: boolean; reason: string; conditions: ConditionResult[] } {
  if (!automation.enabled) return { run: false, reason: 'DISABLED', conditions: [] }
  if (state && !state.stillEnabled) {
    return { run: false, reason: 'EXHAUSTED', conditions: [] }
  }

  const results = (automation.conditions ?? []).map((c) => evaluateCondition(c, context))
  const failed = results.find((r) => !r.pass)

  if (failed) {
    return {
      run: false,
      reason: `CONDITION:${failed.field}`,
      conditions: results,
    }
  }

  return { run: true, reason: 'OK', conditions: results }
}

/**
 * Is this date a slot for this cadence?
 *
 * ⚠️ MONTHLY DOES NOT ADD MONTHS. A cadence of «the 31st» run through
 * `addMonths`-style arithmetic fires in March for a February that has no
 * 31st — so a shop's end-of-month close would silently skip a month every
 * year. A monthly slot on the 31st runs on the 28th of a short month, and says
 * so, rather than not running at all.
 */
/** Whether this cadence names a time of day (and so belongs to the timed pass). */
export function isTimed(cadence: ScheduleCadence): boolean {
  return cadence.kind === 'monthly' && cadence.atMinute !== undefined && !!cadence.timeZone
}

/** The calendar day and minute-of-day in an IANA zone; null for a zone Intl does not know. */
export function localClock(timeZone: string, now: Date): { day: string; minute: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now)
    const read = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
    const day = `${read('year')}-${read('month')}-${read('day')}`
    const minute = Number(read('hour')) * 60 + Number(read('minute'))
    return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(minute) ? { day, minute } : null
  } catch {
    return null
  }
}

/**
 * The latest day a cadence may be evaluated for at `now`.
 *
 * A cadence with no time of day is evaluated for the UTC day, as always. A
 * TIMED one is evaluated for its own local day — but only once its minute has
 * come; before that, «today» has not happened yet for it and the answer is
 * yesterday. So a slot on the 5th at 18:30 runs on the first pass at or after
 * 18:30 local on the 5th, and never before.
 *
 * ⚠️ An unknown zone falls back to the UTC day rather than never running.
 */
export function evaluationDay(cadence: ScheduleCadence, utcToday: string, now: Date): string {
  if (cadence.kind !== 'monthly' || cadence.atMinute === undefined || !cadence.timeZone) {
    return utcToday
  }
  const local = localClock(cadence.timeZone, now)
  if (!local) return utcToday
  if (local.minute >= cadence.atMinute) return local.day
  const before = new Date(Date.parse(`${local.day}T00:00:00Z`) - 86_400_000)
  return before.toISOString().slice(0, 10)
}

export function isDueOn(automation: Automation, on: string): boolean {
  const day = on.slice(0, 10)
  const cadence = automation.cadence

  switch (cadence.kind) {
    case 'once':
      return day === cadence.on.slice(0, 10)

    case 'interval': {
      if (day < cadence.from.slice(0, 10)) return false
      const elapsed = Math.round(
        (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${cadence.from.slice(0, 10)}T00:00:00Z`)) /
          86_400_000,
      )
      return elapsed % cadence.everyDays === 0
    }

    case 'monthly': {
      if (day < cadence.from.slice(0, 10)) return false
      // ⚠️ CLAMP TO THE LAST DAY, not skip the month — and count the days in
      // the cadence's OWN calendar: the 1st of a solar Hijri month is the 21st
      // to 23rd of a Gregorian one.
      return isMonthlySlot(day, cadence.dayOfMonth, cadence.calendar ?? 'gregory')
    }

    default:
      return false
  }
}

export type RunOutcome =
  | { kind: 'ran'; automationId: string; detail: string }
  | { kind: 'skipped'; automationId: string; reason: string }
  /** The work itself failed. The failure policy decides what happens next. */
  | { kind: 'failed'; automationId: string; reason: string; disable: boolean }

/**
 * What the failure policy says about an error.
 *
 * ⚠️ `stop` DISABLES after the attempts run out, and says so. A schedule that
 * keeps failing silently is a schedule the shop believes is working — and the
 * month-end close that has been failing since March is the single most expensive
 * kind of silent failure in this product.
 */
export function afterFailure(
  automation: Automation,
  attempts: number,
): { disable: boolean; retry: boolean } {
  switch (automation.onFailure) {
    case 'ignore':
      return { disable: false, retry: false }
    case 'keep':
      return { disable: false, retry: true }
    case 'stop':
      return { disable: attempts >= automation.maxAttempts, retry: true }
    default:
      return { disable: false, retry: true }
  }
}

/** What one run produced, for the history a shop can read. */
export interface RunRecord {
  automationId: string
  at: string
  outcome: RunOutcome['kind']
  detail: string
  durationMs: number
}

/**
 * Every run is recorded, including the skips.
 *
 * ⚠️ THE SKIPS ARE THE POINT. A history that only records what ran cannot answer
 * «why did my daily backup stop happening in March» — which is the question a
 * shop actually has. A skip with a reason is an answer; an absence is not.
 */
export function summariseRuns(records: readonly RunRecord[]): {
  ran: number
  skipped: number
  failed: number
  lastRanAt: string | null
  lastSkippedReason: string | null
} {
  const ran = records.filter((r) => r.outcome === 'ran')
  const failed = records.filter((r) => r.outcome === 'failed')
  const skipped = records.filter((r) => r.outcome === 'skipped')

  return {
    ran: ran.length,
    skipped: skipped.length,
    failed: failed.length,
    lastRanAt: ran.at(-1)?.at ?? null,
    lastSkippedReason: skipped.at(-1)?.detail ?? null,
  }
}
