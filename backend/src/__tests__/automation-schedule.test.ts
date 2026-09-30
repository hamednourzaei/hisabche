// ============================================
// Engine N16 — scheduled and recurring automation.
// Capabilities #57, #58, #63, #64, #112.
//
// ⚠️ A SCHEDULE IS THE MOST DANGEROUS THING IN THIS PRODUCT, BECAUSE IT RUNS
// WHEN NOBODY IS WATCHING.
//
// A user who clicks a button is present for the result. A schedule is not: it
// fires at 03:15, posts something, and the shop sees the effect days later. So
// the tests here are overwhelmingly about the ways a schedule goes wrong
// SILENTLY, because a loud failure costs an afternoon and a silent one costs a
// quarter.
//
//   1. A CADENCE THAT SKIPS MONTHS. «The 31st» run through month arithmetic
//      fires in March, because February has no 31st — so a month-end close
//      silently skips a month every year.
//   2. A CONDITION THAT NEVER PASSES. A first run has no «days since last run»,
//      so a `days_since_last_run > 30` condition would be false forever and an
//      automation that has never fired could never fire.
//   3. A FAILURE NOBODY HEARS. `stop` that disables without recording why is a
//      month-end close that broke in March and is still shown as configured in
//      September.
//   4. A SKIP WITH NO REASON. A history of only what ran cannot answer «why did
//      it stop happening» — which is the only question a shop actually has.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  afterFailure,
  isDueOn,
  shouldRun,
  summariseRuns,
  type Automation,
  type RunContext,
  type RunRecord,
} from '../services/automation/schedule.domain'

const automation = (over: Partial<Automation> = {}): Automation => ({
  id: 'auto-1',
  name: 'Monthly close',
  enabled: true,
  cadence: { kind: 'monthly', dayOfMonth: 1, from: '2026-01-01' },
  conditions: null,
  action: { type: 'month_end', payload: {} },
  onFailure: 'stop',
  maxAttempts: 3,
  ...over,
})

const context = (over: Partial<RunContext> = {}): RunContext => ({
  dayOfMonth: 1,
  daysSinceLastRun: 30,
  amountMinor: null,
  hasOpenItems: true,
  ...over,
})

describe('N16 — a monthly slot clamps to a short month instead of skipping it', () => {
  it('the 31st runs on the 28th of February', () => {
    // ⚠️ THE failure this prevents. A shop whose close is configured for the 31st
    // would skip February entirely and run twice in March.
    const late = automation({ cadence: { kind: 'monthly', dayOfMonth: 31, from: '2026-01-01' } })

    expect(isDueOn(late, '2026-02-28')).toBe(true)
    expect(isDueOn(late, '2028-02-29')).toBe(true)
    expect(isDueOn(late, '2026-03-31')).toBe(true)
  })

  it('does not run twice in the same short month', () => {
    const late = automation({ cadence: { kind: 'monthly', dayOfMonth: 31, from: '2026-01-01' } })

    expect(isDueOn(late, '2026-02-27')).toBe(false)
    expect(isDueOn(late, '2026-02-28')).toBe(true)
  })

  it('does not run before its start date', () => {
    const later = automation({ cadence: { kind: 'monthly', dayOfMonth: 15, from: '2026-06-01' } })

    expect(isDueOn(later, '2026-05-15')).toBe(false)
    expect(isDueOn(later, '2026-06-15')).toBe(true)
  })
})

describe('N16 — an interval counts from its start, not from the epoch', () => {
  it('fires every N days from the start date', () => {
    const weekly = automation({ cadence: { kind: 'interval', everyDays: 7, from: '2026-09-01' } })

    expect(isDueOn(weekly, '2026-09-01')).toBe(true)
    expect(isDueOn(weekly, '2026-09-08')).toBe(true)
    expect(isDueOn(weekly, '2026-09-09')).toBe(false)
  })

  it('never fires before its start', () => {
    const weekly = automation({ cadence: { kind: 'interval', everyDays: 7, from: '2026-09-01' } })

    expect(isDueOn(weekly, '2026-08-25')).toBe(false)
  })

  it('a one-shot runs once and only once', () => {
    const once = automation({ cadence: { kind: 'once', on: '2026-09-30' } })

    expect(isDueOn(once, '2026-09-30')).toBe(true)
    expect(isDueOn(once, '2026-10-01')).toBe(false)
  })
})

describe('N16 — a condition that can never pass is worse than no condition', () => {
  it('a first run satisfies "days since last run"', () => {
    // ⚠️ THE failure this prevents. A schedule guarded by «more than 30 days
    // since the last run», on a shop that has never run it, would be false
    // forever — an automation that could never fire, configured and shown as
    // enabled.
    const monthly = automation({
      conditions: [{ field: 'days_since_last_run', operator: 'greater_than', value: 30 }],
    })

    expect(shouldRun(monthly, context({ daysSinceLastRun: null }), null).run).toBe(true)
  })

  it('and really is false once it HAS run too recently', () => {
    const monthly = automation({
      conditions: [{ field: 'days_since_last_run', operator: 'greater_than', value: 30 }],
    })

    const verdict = shouldRun(monthly, context({ daysSinceLastRun: 5 }), null)

    expect(verdict.run).toBe(false)
    expect(verdict.reason).toBe('CONDITION:days_since_last_run')
  })

  it('no conditions and an empty list both mean ALWAYS', () => {
    // ⚠️ Two spellings of the same intention. Rejecting `[]` would leave a shop
    // who cleared the conditions with an automation that silently stopped.
    expect(shouldRun(automation({ conditions: null }), context(), null).run).toBe(true)
    expect(shouldRun(automation({ conditions: [] }), context(), null).run).toBe(true)
  })

  it('ALL conditions must pass, not any', () => {
    const both = automation({
      conditions: [
        { field: 'day_of_month', operator: 'equals', value: 1 },
        // ⚠️ `has_open_items` is a BOOLEAN condition — its value is null and the
        // operator is `exists`. The first version wrote `value: true`, which
        // does not type-check, and would have been ignored at runtime had it
        // compiled: a number field silently comparing a boolean.
        { field: 'has_open_items', operator: 'exists', value: null },
      ],
    })

    expect(shouldRun(both, context({ dayOfMonth: 1, hasOpenItems: true }), null).run).toBe(true)
    expect(shouldRun(both, context({ dayOfMonth: 1, hasOpenItems: false }), null).run).toBe(false)
  })

  it('an action with no amount does not fail an amount threshold', () => {
    // ⚠️ Refusing to run because there was nothing to compare would be a silent
    // skip — the worst outcome for an automation.
    const over = automation({
      conditions: [{ field: 'amount_over', operator: 'greater_than', value: 1_000_000 }],
    })

    expect(shouldRun(over, context({ amountMinor: null }), null).run).toBe(true)
    expect(shouldRun(over, context({ amountMinor: 100 }), null).run).toBe(false)
  })
})

describe('N16 — disabled and exhausted are different states', () => {
  it('a disabled automation does not run', () => {
    const verdict = shouldRun(automation({ enabled: false }), context(), null)

    expect(verdict.run).toBe(false)
    expect(verdict.reason).toBe('DISABLED')
  })

  it('an automation disabled BY ITS FAILURE POLICY says so', () => {
    // ⚠️ Same effect, different cause — and the difference is what tells a shop
    // «this is off because you turned it off» versus «this broke in March».
    const verdict = shouldRun(automation(), context(), {
      automationId: 'auto-1',
      lastRunAt: '2026-03-01',
      attempts: 3,
      stillEnabled: false,
    })

    expect(verdict.reason).toBe('EXHAUSTED')
  })
})

describe('N16 — a failure eventually stops, and says so', () => {
  it('"stop" disables once the attempts are used up', () => {
    // ⚠️ THE failure this file is mostly about: a month-end close that broke in
    // March and is still shown as configured in September.
    expect(afterFailure(automation(), 1)).toEqual({ disable: false, retry: true })
    expect(afterFailure(automation(), 3)).toEqual({ disable: true, retry: true })
  })

  it('"keep" never disables', () => {
    const patient = automation({ onFailure: 'keep', maxAttempts: 3 })

    expect(afterFailure(patient, 99)).toEqual({ disable: false, retry: true })
  })

  it('"ignore" records and moves on', () => {
    const detached = automation({ onFailure: 'ignore' })

    expect(afterFailure(detached, 1)).toEqual({ disable: false, retry: false })
  })
})

describe('N16 — the history answers why it stopped', () => {
  const records: RunRecord[] = [
    { automationId: 'a', at: '2026-09-01', outcome: 'ran', detail: 'closed', durationMs: 900 },
    {
      automationId: 'a',
      at: '2026-09-02',
      outcome: 'skipped',
      detail: 'CONDITION:has_open_items',
      durationMs: 1,
    },
    {
      automationId: 'a',
      at: '2026-09-03',
      outcome: 'failed',
      detail: 'BUDGET_EXCEEDED',
      durationMs: 40,
    },
  ]

  it('counts each outcome separately', () => {
    expect(summariseRuns(records)).toMatchObject({ ran: 1, skipped: 1, failed: 1 })
  })

  it('keeps the last REASON a run was skipped', () => {
    // ⚠️ A history of only what ran cannot answer «why did it stop happening»,
    // which is the only question a shop has about automation.
    expect(summariseRuns(records).lastSkippedReason).toBe('CONDITION:has_open_items')
  })

  it('reports when it last actually ran', () => {
    expect(summariseRuns(records).lastRanAt).toBe('2026-09-01')
  })

  it('an empty history is empty, not broken', () => {
    expect(summariseRuns([])).toEqual({
      ran: 0,
      skipped: 0,
      failed: 0,
      lastRanAt: null,
      lastSkippedReason: null,
    })
  })
})
