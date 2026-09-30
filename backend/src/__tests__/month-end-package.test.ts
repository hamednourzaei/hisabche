// ============================================
// Capability #69 — the month-end package.
//
// ⚠️ WHAT IS WORTH TESTING HERE, AND WHY IT IS NOT THE ARITHMETIC.
//
// Five engines already do their own work correctly: `postDue`, the
// `fx_revaluation` ledger source, `repost.domain`, `postYearEndClose` and
// `setPeriodLock`. None of them is touched by this module. What this module
// adds is an ORDER and a STOP CONDITION, and the stop condition is the only part
// that can quietly ruin a shop's books.
//
// The failure it prevents: a month-end that posts depreciation, fails the FX
// revaluation, and then LOCKS the period anyway. The shop sees «done». The
// period is sealed. The error inside it is now permanent and the only way out is
// a manual unlock by someone who has to know to look. That is the single worst
// state a bookkeeping system can be in, and it happens by default unless
// something refuses to run the last step.
//
// So: five tests on ordering, six on stopping, and nothing at all re-testing the
// engines.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  MONTH_END_ORDER,
  decideMonthEnd,
  monthEndsFiscalYear,
  summariseMonthEnd,
  type MonthEndPlan,
  type StepOutcome,
} from '../services/accounting/month-end.domain'

const plan = (over: Partial<MonthEndPlan> = {}): MonthEndPlan => ({
  fromDate: '2026-09-01',
  toDate: '2026-09-30',
  closesYear: false,
  ...over,
})

const ok = (step: StepOutcome['step'], detail?: string): StepOutcome => ({
  step,
  status: 'ok',
  ...(detail ? { detail } : {}),
})

describe('#69 — the order is fixed and it is not arbitrary', () => {
  it('period lock is LAST, always', () => {
    // ⚠️ THE assertion. A lock is a promise that nothing more will be written
    // into that period. Any ordering that puts it before a step that writes
    // either seals a half-finished month or makes the later step fail.
    expect(MONTH_END_ORDER[MONTH_END_ORDER.length - 1]).toBe('period_lock')
  })

  it('depreciation and revaluation come before cost repost and the year close', () => {
    const index = (step: string) => MONTH_END_ORDER.indexOf(step as never)
    // Revaluation reads balances; anything that writes them has to land first or
    // the two steps disagree depending on when the scheduler ran.
    expect(index('depreciation')).toBeLessThan(index('fx_revaluation'))
    expect(index('fx_revaluation')).toBeLessThan(index('cost_repost'))
    expect(index('cost_repost')).toBeLessThan(index('year_end_close'))
  })

  it('runs every remaining step in the declared order', () => {
    const decision = decideMonthEnd(plan(), [])
    expect(decision.run).toEqual([...MONTH_END_ORDER])
    expect(decision.violations).toEqual([])
  })
})

describe('#69 — a failed step stops the run before the lock', () => {
  it('a failure on the FIRST step means nothing else runs', () => {
    const decision = decideMonthEnd(plan(), [
      { step: 'depreciation', status: 'failed', reason: 'asset has no accounts' },
    ])

    expect(decision.run).toEqual([])
    expect(decision.violations).toEqual([
      {
        code: 'MONTH_END_STEP_FAILED',
        step: 'depreciation',
        reason: 'asset has no accounts',
      },
    ])
  })

  it('a failure in the MIDDLE still stops before the lock', () => {
    // ⚠️ The realistic case: depreciation posted fine, revaluation failed. The
    // temptation is to carry on — depreciation is already in and rolling it back
    // is worse. But carrying on means locking a period with a known hole.
    const decision = decideMonthEnd(plan(), [
      ok('depreciation', '3 periods'),
      { step: 'fx_revaluation', status: 'failed', reason: 'no rate for PKR' },
    ])

    expect(decision.run).toEqual([])
    expect(decision.violations[0]?.step).toBe('fx_revaluation')
    expect(decision.violations[0]?.code).toBe('MONTH_END_STEP_FAILED')
  })

  it('the lock is what is withheld, specifically', () => {
    const decision = decideMonthEnd(plan(), [
      ok('depreciation'),
      { step: 'fx_revaluation', status: 'failed', reason: 'boom' },
    ])

    // The whole point stated as one assertion: after a failure the run is
    // EMPTY, so `period_lock` is not merely reordered to last — it does not run
    // at all.
    expect(decision.run).toEqual([])
    expect(decision.run).not.toContain('period_lock')
  })

  it('nothing_to_do is NOT a failure and does not stop the run', () => {
    // A shop with no assets, no foreign balances and no repriced stock should
    // still be able to close its month. Treating "nothing to do" as failure
    // would make month-end impossible for exactly the small shops most of this
    // product's users are.
    const decision = decideMonthEnd(plan(), [
      { step: 'depreciation', status: 'nothing_to_do' },
      { step: 'fx_revaluation', status: 'nothing_to_do' },
      { step: 'cost_repost', status: 'nothing_to_do' },
    ])

    expect(decision.violations).toEqual([])
    expect(decision.run).toEqual(['year_end_close', 'period_lock'])
  })

  it('every step done means nothing left to run', () => {
    const decision = decideMonthEnd(plan(), [
      ok('depreciation'),
      ok('fx_revaluation'),
      ok('cost_repost'),
      ok('year_end_close'),
      ok('period_lock'),
    ])

    expect(decision.run).toEqual([])
    expect(decision.violations).toEqual([])
  })
})

describe('#69 — the summary separates "locked" from "finished"', () => {
  it('a good run reports locked with no failure', () => {
    const summary = summariseMonthEnd(plan(), [ok('period_lock')])
    expect(summary.locked).toBe(true)
    expect(summary.failedAt).toBeUndefined()
  })

  it('a failed run reports NOT locked and names where it stopped', () => {
    // ⚠️ A summary that renders both as «done» is how a shop ends a month not
    // knowing its books are still open — and §7٫5 in practice.
    const summary = summariseMonthEnd(plan(), [
      ok('depreciation', '3 periods'),
      { step: 'fx_revaluation', status: 'failed', reason: 'no rate for PKR' },
    ])

    expect(summary.locked).toBe(false)
    expect(summary.failedAt).toBe('fx_revaluation')
  })

  it('carries the period dates so a report cannot be read against the wrong month', () => {
    const summary = summariseMonthEnd(plan({ fromDate: '2026-09-01', toDate: '2026-09-30' }), [])
    expect(summary).toMatchObject({ fromDate: '2026-09-01', toDate: '2026-09-30' })
  })
})

describe('#69 — the fiscal year end comes from configuration', () => {
  it('matches the START month, so a partial December still closes the year', () => {
    // ⚠️ A shop whose books close on the 31st and which runs a period 1–30
    // December has still had its closing month. Matching on the end date would
    // say it had not, and the year would close in January.
    expect(monthEndsFiscalYear('2026-12-01', '12-31')).toBe(true)
    expect(monthEndsFiscalYear('2026-11-01', '12-31')).toBe(false)
  })

  it('honours a non-December year end rather than assuming one', () => {
    // Several markets close in March. Assuming December here would close a year
    // for the wrong business on the wrong day.
    expect(monthEndsFiscalYear('2026-03-01', '03-31')).toBe(true)
    expect(monthEndsFiscalYear('2026-12-01', '03-31')).toBe(false)
  })

  it('a misconfigured year end is reported, never guessed', () => {
    expect(() => monthEndsFiscalYear('2026-12-01', '13-01')).toThrow(
      /MONTH_END_FISCAL_YEAR_END_INVALID/,
    )
  })
})
