// ============================================
// backend/src/services/capacity/capacity-estimator.ts
//
// V76 Phase 10 — Resource Capacity Model.
// Separates Measured Capacity, Safe Capacity (with SLO headroom), and
// Simulation-Only Projected Capacity. Returns INSUFFICIENT_BENCHMARK_DATA
// whenever measured benchmark evidence is absent or stale.
// ============================================

import type {
  BenchmarkRunRecord,
  CapacityEstimateSummary,
  ConfidenceLevel,
  WorkloadProfile,
} from '@hisabche/validation'

const PROFILE_SAFETY_FACTOR: Record<WorkloadProfile, number> = {
  light: 0.85,
  standard: 0.75,
  heavy: 0.65,
  financial_intensive: 0.65,
  inventory_intensive: 0.7,
  sync_intensive: 0.7,
  reporting_intensive: 0.6,
  mixed_production: 0.75,
}

export function estimateCapacityFromBenchmarks(
  runs: readonly BenchmarkRunRecord[],
  workloadProfile: WorkloadProfile,
  hypotheticalResourceMultiplier = 1,
): CapacityEstimateSummary {
  const validRuns = runs.filter((r) => r.status === 'COMPLETED' && r.maxStableConcurrency > 0)

  const matchingRuns = validRuns.filter((r) => r.workloadProfile === workloadProfile)
  const sourceRuns = matchingRuns.length > 0 ? matchingRuns : validRuns

  if (sourceRuns.length === 0) {
    return {
      measuredCapacity: null,
      safeCapacity: null,
      projectedCapacity: null,
      projectedIsSimulationOnly: true,
      limitingResource: 'unknown',
      confidence: 'INSUFFICIENT_DATA',
      status: 'INSUFFICIENT_BENCHMARK_DATA',
      workloadProfile,
      lastValidBenchmarkAt: null,
      gitRevision: null,
    }
  }

  const latest = [...sourceRuns].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0]!
  const measuredCapacity = latest.maxStableConcurrency
  const factor = PROFILE_SAFETY_FACTOR[workloadProfile] ?? 0.75
  const safeCapacity = Math.max(1, Math.floor(measuredCapacity * factor))

  const projectedCapacity =
    hypotheticalResourceMultiplier > 1
      ? Math.floor(safeCapacity * hypotheticalResourceMultiplier)
      : null

  let confidence: ConfidenceLevel = 'MEDIUM'
  if (matchingRuns.length >= 2 && latest.environment === 'isolated_staging') {
    confidence = 'HIGH'
  } else if (matchingRuns.length === 0 || latest.errorRate > 0.01) {
    confidence = 'LOW'
  }

  return {
    measuredCapacity,
    safeCapacity,
    projectedCapacity,
    projectedIsSimulationOnly: true,
    limitingResource: latest.limitingResource,
    confidence,
    status: 'READY',
    workloadProfile,
    lastValidBenchmarkAt: latest.finishedAt,
    gitRevision: latest.gitRevision,
  }
}
