import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DIVERGENCE_THRESHOLD,
  evaluateDivergenceWindow,
  isDivergenceAlarmEnabled,
  summarizeDivergenceAlarms,
} from '../index'

// ============================================
// The divergence alarm's decision, without a database.
//
// The worker only counts rows and posts a notification; everything that could
// be wrong about «when is this worth waking somebody» is asserted here.
// ============================================

const ON = { percent: 5, minOpportunities: 20 }

describe('the alarm has an OFF state that is not a zero threshold', () => {
  it('ships OFF', () => {
    expect(DEFAULT_DIVERGENCE_THRESHOLD.percent).toBeNull()
    expect(isDivergenceAlarmEnabled(DEFAULT_DIVERGENCE_THRESHOLD)).toBe(false)
  })

  it('⚠️ off does not fire even when every comparison diverged', () => {
    // The bug this prevents: `score < minScore` with a zero threshold is never
    // true, so "off at zero" silently alarmed on everything. «Off» is a
    // separate condition, not a boundary value.
    const verdict = evaluateDivergenceWindow(
      { capability: 'payment.record', divergences: 50, opportunities: 50 },
      DEFAULT_DIVERGENCE_THRESHOLD,
    )
    expect(verdict.alarm).toBe(false)
    expect(verdict.code).toBe('ALARM_OFF')
    // …and the rate is still reported, so the window is not hidden.
    expect(verdict.ratePercent).toBe(100)
  })

  it('a zero threshold is ON and fires on a single divergence', () => {
    const verdict = evaluateDivergenceWindow(
      { capability: 'payment.record', divergences: 1, opportunities: 100 },
      { percent: 0, minOpportunities: 20 },
    )
    expect(isDivergenceAlarmEnabled({ percent: 0, minOpportunities: 20 })).toBe(true)
    expect(verdict.alarm).toBe(true)
    expect(verdict.code).toBe('ALARM_RATE_EXCEEDED')
  })
})

describe('the threshold comparison is strictly greater than', () => {
  it('exactly on the boundary does NOT fire', () => {
    // 5 % of 100 opportunities is 5 divergences.
    const verdict = evaluateDivergenceWindow(
      { capability: 'payment.record', divergences: 5, opportunities: 100 },
      ON,
    )
    expect(verdict.ratePercent).toBe(5)
    expect(verdict.alarm).toBe(false)
  })

  it('one unit over the boundary DOES fire', () => {
    const verdict = evaluateDivergenceWindow(
      { capability: 'payment.record', divergences: 6, opportunities: 100 },
      ON,
    )
    expect(verdict.alarm).toBe(true)
    expect(verdict.code).toBe('ALARM_RATE_EXCEEDED')
  })
})

describe('a window too small to carry a rate is reported, not judged', () => {
  it('one divergence out of two is not an alarm', () => {
    // 50 % from two comparisons is a quiet morning, not an incident.
    const verdict = evaluateDivergenceWindow(
      { capability: 'payment.record', divergences: 1, opportunities: 2 },
      ON,
    )
    expect(verdict.alarm).toBe(false)
    expect(verdict.code).toBe('ALARM_BELOW_THRESHOLD')
    expect(verdict.ratePercent).toBe(50)
    expect(verdict.message).toContain('20')
  })

  it('zero opportunities gives an unknown rate, never 0 %', () => {
    const verdict = evaluateDivergenceWindow(
      { capability: 'payment.record', divergences: 0, opportunities: 0 },
      ON,
    )
    expect(verdict.ratePercent).toBeNull()
    expect(verdict.alarm).toBe(false)
  })

  it('no divergence over a large window does not fire', () => {
    const verdict = evaluateDivergenceWindow(
      { capability: 'payment.record', divergences: 0, opportunities: 500 },
      ON,
    )
    expect(verdict.alarm).toBe(false)
    expect(verdict.ratePercent).toBe(0)
    expect(verdict.message).toContain('within')
  })
})

describe('the summary names what fired and nothing else', () => {
  it('lists only the capabilities that crossed', () => {
    const a = {
      ...evaluateDivergenceWindow(
        { capability: 'payment.record', divergences: 9, opportunities: 100 },
        ON,
      ),
      capability: 'payment.record',
    }
    const b = {
      ...evaluateDivergenceWindow(
        { capability: 'invoice.create', divergences: 0, opportunities: 100 },
        ON,
      ),
      capability: 'invoice.create',
    }
    const summary = summarizeDivergenceAlarms([a, b])
    expect(summary.firing).toEqual(['payment.record'])
    expect(summary.message).toContain('payment.record')
    expect(summary.message).not.toContain('invoice.create')
  })

  it('says so plainly when nothing fired', () => {
    const summary = summarizeDivergenceAlarms([])
    expect(summary.firing).toEqual([])
    expect(summary.message).toBe('No capability crossed its divergence limit.')
  })
})
