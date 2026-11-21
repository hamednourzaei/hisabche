// ============================================
// backend/src/services/monitoring/core-pressure.domain.ts
//
// THE Core Pressure formula — versioned `pressure-v1` (core-registry.ts).
// Pure: no imports beyond the registry contract, no I/O, fully testable.
//
// COMPONENTS (each normalized 0..1, null when its input is unmeasured)
//   latency        p95 / core SLO target
//   errors         5xx percent / core error budget
//   queue          queue depth / queue capacity
//   retryTimeout   (retries + timeouts) per operation, against a 5% budget
//   dependencyWait mean DB wait per measured operation, against half the SLO
//
// COMBINATION
//   pressure = 100 × Σ(weight × component) / Σ(weight of PRESENT components)
//   Weights renormalize over what is actually measured, so a core without a
//   queue is not penalized for having no queue — and a core with NOTHING
//   measurable is UNKNOWN, never «healthy at 0» (AGENTS §3: unknown ≠ zero).
//
// STATUS
//   < 40 healthy · 40–69 warning · ≥ 70 critical · null → unknown + reason.
//   Thresholds are the documented constants in core-registry.ts.
//
// PERCENTILES
//   The histogram has fixed buckets (<50,<100,<250,<500,<1000,≥1000 ms).
//   A percentile is the UPPER BOUND of the bucket it falls in — a conservative
//   estimate, flagged `atLeast` when it lands in the open-ended last bucket.
//   The UI renders «≥ 1000 ms», never a fabricated exact number.
// ============================================

import {
  DURATION_BUCKETS_MS,
  PRESSURE_THRESHOLDS,
  PRESSURE_WEIGHTS,
  type CoreSlo,
  type CoreStatus,
} from './core-registry'

export interface PercentileEstimate {
  value: number
  /** True when the estimate sits in the open-ended bucket: «at least value». */
  atLeast: boolean
}

/**
 * Percentile from the fixed six-slot histogram. `null` when there are no
 * observations — an empty window has no latency, not zero latency.
 */
export function estimatePercentile(
  buckets: readonly number[],
  percentile: number,
): PercentileEstimate | null {
  const total = buckets.reduce((sum, count) => sum + count, 0)
  if (total <= 0) return null
  const target = Math.ceil((percentile / 100) * total)
  let cumulative = 0
  for (let index = 0; index < buckets.length; index += 1) {
    cumulative += buckets[index] ?? 0
    if (cumulative >= target) {
      if (index < DURATION_BUCKETS_MS.length) {
        return { value: DURATION_BUCKETS_MS[index]!, atLeast: false }
      }
      return { value: DURATION_BUCKETS_MS[DURATION_BUCKETS_MS.length - 1]!, atLeast: true }
    }
  }
  return { value: DURATION_BUCKETS_MS[DURATION_BUCKETS_MS.length - 1]!, atLeast: true }
}

export interface PressureInput {
  /** Operations observed in the window (all groups, all instances). */
  operationCount: number
  /** 5xx count in the window. */
  errorCount: number
  /** Merged duration histogram of the window. */
  durationBuckets: readonly number[]
  /** Queue gauge (null = unmeasured / core has no queue). */
  queueDepth: number | null
  /** Retries recorded by the gauge (null = unmeasured). */
  retryCount: number | null
  /** Timeouts observed at the request boundary (always measured). */
  timeoutCount: number
  /** Total dependency wait and how many operations measured it. */
  dependencyWaitTotalMs: number | null
  dependencyMeasuredCount: number
  /** The core's documented SLO + capacity. */
  slo: CoreSlo
}

export interface PressureComponent {
  key: keyof typeof PRESSURE_WEIGHTS
  /** Normalized 0..1, or null when unmeasured. */
  value: number | null
  weight: number
  /** What the reader should know about this component's measurement. */
  note: string | null
}

export interface PressureResult {
  /** 0..100, or null when nothing is measurable. */
  pressure: number | null
  status: CoreStatus
  /** Why the pressure is unknown (null when computed). */
  reason: string | null
  components: PressureComponent[]
  /** Share of the total weight that was actually measured (0..1). */
  coverage: number
  formulaVersion: string
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function statusForPressure(pressure: number | null): CoreStatus {
  if (pressure === null) return 'unknown'
  if (pressure >= PRESSURE_THRESHOLDS.critical) return 'critical'
  if (pressure >= PRESSURE_THRESHOLDS.warning) return 'warning'
  return 'healthy'
}

/** Retry+timeout budget: 5% of operations. Documented, not hidden. */
export const RETRY_TIMEOUT_BUDGET = 0.05

export function computePressure(input: PressureInput): PressureResult {
  const { slo } = input
  const p95 = estimatePercentile(input.durationBuckets, 95)
  const hasTraffic = input.operationCount > 0

  const latency: PressureComponent = {
    key: 'latency',
    weight: PRESSURE_WEIGHTS.latency,
    value: p95 === null ? null : clamp01(p95.value / slo.p95TargetMs),
    note: p95?.atLeast ? 'p95 in open bucket (≥1000 ms)' : null,
  }

  const errorPercent = hasTraffic ? (input.errorCount / input.operationCount) * 100 : null
  const errors: PressureComponent = {
    key: 'errors',
    weight: PRESSURE_WEIGHTS.errors,
    value: errorPercent === null ? null : clamp01(errorPercent / slo.errorBudgetPercent),
    note: null,
  }

  const queue: PressureComponent = {
    key: 'queue',
    weight: PRESSURE_WEIGHTS.queue,
    value:
      input.queueDepth === null || !slo.queueCapacity
        ? null
        : clamp01(input.queueDepth / slo.queueCapacity),
    note: input.queueDepth === null ? 'queue not measurable for this core' : null,
  }

  // Timeouts are always measured at the boundary; retries only where a gauge
  // records them. With traffic, the rate is computable from timeouts alone —
  // the note says the retry half is unmeasured, never silently zero.
  const retryTimeoutRate = hasTraffic
    ? (input.timeoutCount + (input.retryCount ?? 0)) / input.operationCount
    : null
  const retryTimeout: PressureComponent = {
    key: 'retryTimeout',
    weight: PRESSURE_WEIGHTS.retryTimeout,
    value: retryTimeoutRate === null ? null : clamp01(retryTimeoutRate / RETRY_TIMEOUT_BUDGET),
    note: input.retryCount === null ? 'retries unmeasured; timeouts only' : null,
  }

  const meanWait =
    input.dependencyWaitTotalMs !== null && input.dependencyMeasuredCount > 0
      ? input.dependencyWaitTotalMs / input.dependencyMeasuredCount
      : null
  const dependencyWait: PressureComponent = {
    key: 'dependencyWait',
    weight: PRESSURE_WEIGHTS.dependencyWait,
    value: meanWait === null ? null : clamp01(meanWait / (slo.p95TargetMs * 0.5)),
    note: meanWait === null ? 'dependency wait not measured' : null,
  }

  const components = [latency, errors, queue, retryTimeout, dependencyWait]
  const present = components.filter((component) => component.value !== null)
  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0)
  const presentWeight = present.reduce((sum, component) => sum + component.weight, 0)

  if (!hasTraffic && present.length === 0) {
    return {
      pressure: null,
      status: 'unknown',
      reason: 'no operations in window',
      components,
      coverage: 0,
      formulaVersion: 'pressure-v1',
    }
  }
  if (present.length === 0) {
    return {
      pressure: null,
      status: 'unknown',
      reason: 'no measurable component',
      components,
      coverage: 0,
      formulaVersion: 'pressure-v1',
    }
  }

  const weighted = present.reduce(
    (sum, component) => sum + component.weight * (component.value ?? 0),
    0,
  )
  const pressure = Math.round((100 * weighted) / presentWeight)
  return {
    pressure,
    status: statusForPressure(pressure),
    reason: null,
    components,
    coverage: presentWeight / totalWeight,
    formulaVersion: 'pressure-v1',
  }
}
