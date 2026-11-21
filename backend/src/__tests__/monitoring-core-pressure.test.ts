// ============================================
// backend/src/__tests__/monitoring-core-pressure.test.ts
//
// pressure-v1 contract tests (mission §5.4):
//   - real components only, weights renormalize over measured components
//   - nothing measurable → UNKNOWN with a reason, never «healthy at 0»
//   - percentiles are conservative bucket bounds, open bucket flagged atLeast
//   - status thresholds are the documented registry constants
// ============================================

import { describe, expect, it } from 'vitest'

import {
  PRESSURE_THRESHOLDS,
  PRESSURE_WEIGHTS,
  type CoreSlo,
} from '../services/monitoring/core-registry'
import {
  RETRY_TIMEOUT_BUDGET,
  computePressure,
  estimatePercentile,
  statusForPressure,
  type PressureInput,
} from '../services/monitoring/core-pressure.domain'

const SLO: CoreSlo = { p95TargetMs: 800, errorBudgetPercent: 1 }

function input(overrides: Partial<PressureInput> = {}): PressureInput {
  return {
    operationCount: 100,
    errorCount: 0,
    durationBuckets: [100, 0, 0, 0, 0, 0],
    queueDepth: null,
    retryCount: null,
    timeoutCount: 0,
    dependencyWaitTotalMs: null,
    dependencyMeasuredCount: 0,
    slo: SLO,
    ...overrides,
  }
}

describe('estimatePercentile', () => {
  it('returns null for an empty window — no latency, not zero latency', () => {
    expect(estimatePercentile([0, 0, 0, 0, 0, 0], 95)).toBeNull()
  })

  it('returns the bucket upper bound the percentile falls in', () => {
    // 90 fast (<50) + 10 slow (<250): p95 lands in the <250 bucket.
    const estimate = estimatePercentile([90, 0, 10, 0, 0, 0], 95)
    expect(estimate).toEqual({ value: 250, atLeast: false })
  })

  it('flags the open-ended bucket as atLeast, never a fabricated exact value', () => {
    const estimate = estimatePercentile([0, 0, 0, 0, 0, 10], 99)
    expect(estimate).toEqual({ value: 1000, atLeast: true })
  })

  it('p50 of a single fast observation is the first bucket bound', () => {
    expect(estimatePercentile([1, 0, 0, 0, 0, 0], 50)).toEqual({ value: 50, atLeast: false })
  })
})

describe('statusForPressure', () => {
  it('uses the documented thresholds', () => {
    expect(statusForPressure(null)).toBe('unknown')
    expect(statusForPressure(PRESSURE_THRESHOLDS.warning - 1)).toBe('healthy')
    expect(statusForPressure(PRESSURE_THRESHOLDS.warning)).toBe('warning')
    expect(statusForPressure(PRESSURE_THRESHOLDS.critical - 1)).toBe('warning')
    expect(statusForPressure(PRESSURE_THRESHOLDS.critical)).toBe('critical')
    expect(statusForPressure(100)).toBe('critical')
  })
})

describe('computePressure', () => {
  it('a core with no traffic and no gauges is UNKNOWN with a reason', () => {
    const result = computePressure(
      input({ operationCount: 0, durationBuckets: [0, 0, 0, 0, 0, 0] }),
    )
    expect(result.pressure).toBeNull()
    expect(result.status).toBe('unknown')
    expect(result.reason).toBe('no operations in window')
    expect(result.coverage).toBe(0)
    expect(result.formulaVersion).toBe('pressure-v1')
  })

  it('a healthy fast core scores low, not zero-by-default', () => {
    const result = computePressure(input())
    expect(result.pressure).not.toBeNull()
    expect(result.status).toBe('healthy')
    // latency 50/800 and errors 0 are the only measured components.
    const present = result.components.filter((c) => c.value !== null)
    expect(present.map((c) => c.key)).toEqual(['latency', 'errors', 'retryTimeout'])
  })

  it('weights renormalize over measured components (no queue penalty)', () => {
    const result = computePressure(input())
    const latency = 50 / SLO.p95TargetMs
    const expected = Math.round(
      (100 * (PRESSURE_WEIGHTS.latency * latency)) /
        (PRESSURE_WEIGHTS.latency + PRESSURE_WEIGHTS.errors + PRESSURE_WEIGHTS.retryTimeout),
    )
    expect(result.pressure).toBe(expected)
    const totalWeight = Object.values(PRESSURE_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(result.coverage).toBeCloseTo(
      (PRESSURE_WEIGHTS.latency + PRESSURE_WEIGHTS.errors + PRESSURE_WEIGHTS.retryTimeout) /
        totalWeight,
      5,
    )
  })

  it('saturating the error budget drives the core critical', () => {
    const result = computePressure(input({ errorCount: 10, durationBuckets: [0, 0, 0, 0, 0, 100] }))
    expect(result.status).toBe('critical')
    const errors = result.components.find((c) => c.key === 'errors')
    expect(errors?.value).toBe(1)
  })

  it('queue saturation counts only when the core declares a capacity', () => {
    const withQueue = computePressure(
      input({ queueDepth: 100, slo: { ...SLO, queueCapacity: 100 } }),
    )
    const queue = withQueue.components.find((c) => c.key === 'queue')
    expect(queue?.value).toBe(1)

    const noCapacity = computePressure(input({ queueDepth: 100 }))
    expect(noCapacity.components.find((c) => c.key === 'queue')?.value).toBeNull()
  })

  it('unmeasured queue is null with a note, never zero', () => {
    const result = computePressure(input())
    const queue = result.components.find((c) => c.key === 'queue')
    expect(queue?.value).toBeNull()
    expect(queue?.note).toContain('not measurable')
  })

  it('timeouts alone compute the retry/timeout rate; unmeasured retries are noted', () => {
    const result = computePressure(input({ timeoutCount: 5 }))
    const component = result.components.find((c) => c.key === 'retryTimeout')
    expect(component?.value).toBeCloseTo(0.05 / RETRY_TIMEOUT_BUDGET, 5)
    expect(component?.note).toContain('retries unmeasured')
  })

  it('measured retries add to the rate without a note', () => {
    const result = computePressure(input({ timeoutCount: 2, retryCount: 3 }))
    const component = result.components.find((c) => c.key === 'retryTimeout')
    expect(component?.value).toBeCloseTo(0.05 / RETRY_TIMEOUT_BUDGET, 5)
    expect(component?.note).toBeNull()
  })

  it('dependency wait normalizes against half the SLO target', () => {
    const result = computePressure(
      input({ dependencyWaitTotalMs: 4000, dependencyMeasuredCount: 10 }),
    )
    const component = result.components.find((c) => c.key === 'dependencyWait')
    expect(component?.value).toBeCloseTo(400 / (SLO.p95TargetMs * 0.5), 5)
  })

  it('dependency wait with zero measured operations stays null', () => {
    const result = computePressure(input({ dependencyWaitTotalMs: 0, dependencyMeasuredCount: 0 }))
    expect(result.components.find((c) => c.key === 'dependencyWait')?.value).toBeNull()
  })

  it('pressure never exceeds 100 even when every component saturates', () => {
    const result = computePressure(
      input({
        errorCount: 100,
        durationBuckets: [0, 0, 0, 0, 0, 100],
        queueDepth: 1000,
        retryCount: 100,
        timeoutCount: 100,
        dependencyWaitTotalMs: 100_000,
        dependencyMeasuredCount: 100,
        slo: { ...SLO, queueCapacity: 10 },
      }),
    )
    expect(result.pressure).toBe(100)
    expect(result.status).toBe('critical')
    expect(result.coverage).toBe(1)
  })

  it('every component carries its documented weight', () => {
    const result = computePressure(input())
    for (const component of result.components) {
      expect(component.weight).toBe(PRESSURE_WEIGHTS[component.key])
    }
  })
})
