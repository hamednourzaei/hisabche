/**
 * Deterministic cohort bucketing and staged rollout health/auto-halt engine (Section 9).
 */

export type RolloutRing = 'development' | 'internal' | 'canary' | 'expanded' | 'everyone'

export const ROLLOUT_RING_ORDER: readonly RolloutRing[] = [
  'development',
  'internal',
  'canary',
  'expanded',
  'everyone',
]

export interface RolloutHealthThresholds {
  /** Default: 50 devices before auto-halt can trigger (default, owner to confirm). */
  minSampleSize: number
  /** Default: 0.05 = 5% startup failures (default, owner to confirm). */
  maxStartupFailureRate: number
  /** Default: 0.03 = 3% rollbacks (default, owner to confirm). */
  maxRollbackRate: number
  /** Default: 0.01 = 1% signature/integrity failures (default, owner to confirm). */
  maxSignatureFailureRate: number
  /** Default: 0.90 = 90% minimum activation success (default, owner to confirm). */
  minActivationSuccessRate: number
}

export const DEFAULT_ROLLOUT_THRESHOLDS: RolloutHealthThresholds = {
  minSampleSize: 50,
  maxStartupFailureRate: 0.05,
  maxRollbackRate: 0.03,
  maxSignatureFailureRate: 0.01,
  minActivationSuccessRate: 0.9,
}

/**
 * Deterministic 32-bit FNV-1a bucket in [0, 9999] (basis points, 0.01% precision).
 * Monotonic: if percentage grows from P1 to P2 (P2 >= P1), every device in P1 stays in P2.
 */
export function assignCohortBucket(deviceId: string, releaseId: string): number {
  const key = `${deviceId}::${releaseId}`
  let hash = 0x811c9dc5
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  // Avalanche mix
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  return (hash >>> 0) % 10_000
}

export function isDeviceInCohort(input: {
  deviceId: string
  releaseId: string
  rolloutPercent: number
}): boolean {
  if (input.rolloutPercent <= 0) return false
  if (input.rolloutPercent >= 100) return true
  const bucket = assignCohortBucket(input.deviceId, input.releaseId)
  return bucket < Math.round(input.rolloutPercent * 100)
}

export interface RingHealthMetrics {
  sampleSize: number
  activationSuccessCount: number
  startupFailureCount: number
  rollbackCount: number
  signatureFailureCount: number
}

export type RolloutHealthDecision =
  | { action: 'INSUFFICIENT_SAMPLE'; sampleSize: number; minSampleSize: number }
  | { action: 'HEALTHY' }
  | { action: 'HALT_AND_ROLLBACK'; reasons: readonly string[] }

export function evaluateRolloutHealth(
  metrics: RingHealthMetrics,
  thresholds: RolloutHealthThresholds = DEFAULT_ROLLOUT_THRESHOLDS,
): RolloutHealthDecision {
  if (metrics.sampleSize < thresholds.minSampleSize || metrics.sampleSize <= 0) {
    return {
      action: 'INSUFFICIENT_SAMPLE',
      sampleSize: metrics.sampleSize,
      minSampleSize: thresholds.minSampleSize,
    }
  }

  const reasons: string[] = []
  const startupFailureRate = metrics.startupFailureCount / metrics.sampleSize
  const rollbackRate = metrics.rollbackCount / metrics.sampleSize
  const signatureFailureRate = metrics.signatureFailureCount / metrics.sampleSize
  const activationSuccessRate = metrics.activationSuccessCount / metrics.sampleSize

  if (startupFailureRate > thresholds.maxStartupFailureRate) {
    reasons.push(`STARTUP_FAILURE_RATE:${startupFailureRate.toFixed(4)}`)
  }
  if (rollbackRate > thresholds.maxRollbackRate) {
    reasons.push(`ROLLBACK_RATE:${rollbackRate.toFixed(4)}`)
  }
  if (signatureFailureRate > thresholds.maxSignatureFailureRate) {
    reasons.push(`SIGNATURE_FAILURE_RATE:${signatureFailureRate.toFixed(4)}`)
  }
  if (activationSuccessRate < thresholds.minActivationSuccessRate) {
    reasons.push(`ACTIVATION_SUCCESS_RATE:${activationSuccessRate.toFixed(4)}`)
  }

  return reasons.length > 0 ? { action: 'HALT_AND_ROLLBACK', reasons } : { action: 'HEALTHY' }
}
