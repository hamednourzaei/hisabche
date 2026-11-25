// ============================================
// backend/src/db/routing.ts
//
// Authoritative Read/Write Database Router & Fencing Dispatcher
// Enforces single-writer invariant, signed writer epoch verification,
// target switching on standby promotion, and fail-closed replica routing.
// ============================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { getRegisteredWriterClient, primaryDb } from './primary'
import {
  getReplicaClientOrPrimary,
  recordReplicaFallback,
  type ReplicationLagSource,
} from './replica'
import { replicaCircuitBreaker } from './circuit-breaker'
import { globalFencingEngine } from './fencing'
import type { FencingToken, WriterLease, WriterLeaseStore } from './runtime-types'

export type ReadConsistencyPolicy = 'strong' | 'bounded_staleness' | 'eventual'

export const REPLICA_READ_ALLOWLIST = [
  'services/reporting/',
  'services/analytics',
  'services/analysis',
  'services/intelligence',
  'routes/analytics.routes.ts',
  'routes/analysis.routes.ts',
  'routes/custom-reports.routes.ts',
  'routes/dashboard-kpis.routes.ts',
  'routes/inventory-insights.routes.ts',
] as const

export function isReplicaAllowedCaller(relativePath: string): boolean {
  const norm = relativePath.replace(/\\/g, '/')
  return REPLICA_READ_ALLOWLIST.some((prefix) => norm.includes(prefix))
}

export const DEFAULT_MAX_REPLICA_LAG_MS = Number(process.env.MAX_REPLICA_LAG_MS ?? 5000)

export const DEFAULT_MAX_MEASUREMENT_AGE_MS = Number(
  process.env.MAX_REPLICA_MEASUREMENT_AGE_MS ?? 30_000,
)

/**
 * Selects read database client with FAIL-CLOSED replica health, consistency policy,
 * lag verification, and measurement-freshness policy:
 * - `strong` consistency always routes to primary.
 * - `rtt_fallback` or `unavailable` sources fail closed to primary (RTT != WAL lag).
 * - Unknown (`null`/`undefined`/negative/`NaN`) or stale lag measurements fail closed to primary.
 */
export function selectReadClient(params: {
  callerPath: string
  replicaLagMs?: number | null | undefined
  maxLagMs?: number | undefined
  consistency?: ReadConsistencyPolicy | undefined
  measurementSource?: ReplicationLagSource | undefined
  measurementAgeMs?: number | null | undefined
  maxMeasurementAgeMs?: number | undefined
}): { client: SupabaseClient; target: 'primary' | 'replica'; reason: string } {
  // 0. Strong consistency always requires Primary
  if (params.consistency === 'strong') {
    return { client: primaryDb, target: 'primary', reason: 'strong_consistency_required' }
  }

  // 1. Check if caller path is in the read-replica allowlist
  if (!isReplicaAllowedCaller(params.callerPath)) {
    return { client: primaryDb, target: 'primary', reason: 'caller_not_allowlisted' }
  }

  // 2. Check circuit breaker status
  if (!replicaCircuitBreaker.isAvailable()) {
    recordReplicaFallback()
    return { client: primaryDb, target: 'primary', reason: 'circuit_breaker_open' }
  }

  // 3. Reject RTT fallback explicitly (RTT is never a valid replication lag signal)
  if (params.measurementSource === 'rtt_fallback') {
    recordReplicaFallback()
    return { client: primaryDb, target: 'primary', reason: 'replica_lag_unverified' }
  }

  // 4. Reject stale lag measurements
  const maxAge = params.maxMeasurementAgeMs ?? DEFAULT_MAX_MEASUREMENT_AGE_MS
  if (
    params.measurementAgeMs !== undefined &&
    params.measurementAgeMs !== null &&
    (!Number.isFinite(params.measurementAgeMs) ||
      params.measurementAgeMs < 0 ||
      params.measurementAgeMs > maxAge)
  ) {
    recordReplicaFallback()
    return { client: primaryDb, target: 'primary', reason: 'replica_measurement_stale' }
  }

  // 5. Fail-closed on unknown/missing replication lag
  const maxLag = params.maxLagMs ?? DEFAULT_MAX_REPLICA_LAG_MS
  if (
    params.measurementSource === 'unavailable' ||
    params.replicaLagMs === null ||
    params.replicaLagMs === undefined ||
    !Number.isFinite(params.replicaLagMs) ||
    params.replicaLagMs < 0
  ) {
    recordReplicaFallback()
    return { client: primaryDb, target: 'primary', reason: 'replica_lag_unknown' }
  }

  if (params.replicaLagMs > maxLag) {
    replicaCircuitBreaker.recordFailure()
    recordReplicaFallback()
    return { client: primaryDb, target: 'primary', reason: 'replica_lag_exceeded' }
  }

  // 6. Retrieve candidate client
  const { client, isReplica } = getReplicaClientOrPrimary()
  if (!isReplica) {
    recordReplicaFallback()
  }
  return {
    client,
    target: isReplica ? 'replica' : 'primary',
    reason: isReplica ? 'replica_healthy' : 'replica_unset_fallback',
  }
}

function resolveActiveWriteConnection(writerId: string): {
  client: SupabaseClient
  target: 'primary' | 'standby_promoted'
} {
  const registered = getRegisteredWriterClient(writerId)
  if (registered) {
    return { client: registered, target: 'standby_promoted' }
  }
  return { client: primaryDb, target: 'primary' }
}

/**
 * Selects the authorized active writer client.
 * Strictly verifies the cryptographic fencing token, lease validity, and epoch.
 * Routes writes to the promoted standby DB client if registered for active writer.
 */
export function selectWriteClient(params?: { fencingToken?: FencingToken | null | undefined }): {
  client: SupabaseClient
  target: 'primary' | 'standby_promoted'
  epoch: number
  writerId: string
} {
  globalFencingEngine.assertValidWriter(params?.fencingToken)

  const writerId = globalFencingEngine.getCurrentWriterId()
  const resolved = resolveActiveWriteConnection(writerId)

  return {
    client: resolved.client,
    target: resolved.target,
    epoch: globalFencingEngine.getCurrentEpoch(),
    writerId,
  }
}

/**
 * Distributed write router: enforces both local HMAC/lease verification and
 * shared Postgres `assert_writer_epoch` RPC before returning the active writer client.
 */
export async function selectWriteClientDistributed(params: {
  fencingToken: FencingToken
  leaseStore?: WriterLeaseStore | undefined
}): Promise<{
  client: SupabaseClient
  target: 'primary' | 'standby_promoted'
  epoch: number
  writerId: string
}> {
  await globalFencingEngine.assertValidWriterDistributed(params.fencingToken, params.leaseStore)

  const writerId = globalFencingEngine.getCurrentWriterId()
  const resolved = resolveActiveWriteConnection(writerId)

  return {
    client: resolved.client,
    target: resolved.target,
    epoch: globalFencingEngine.getCurrentEpoch(),
    writerId,
  }
}

export function getDatabaseRoutingOverview(): {
  activeEpoch: number
  activeWriterId: string
  lease: Omit<WriterLease, 'fenceSignature'> & { hasFenceSignature: boolean }
  circuitBreakerState: string
  allowlistedPaths: readonly string[]
} {
  const activeLease = globalFencingEngine.getActiveLease()
  const { fenceSignature, ...safeLease } = activeLease
  return {
    activeEpoch: globalFencingEngine.getCurrentEpoch(),
    activeWriterId: globalFencingEngine.getCurrentWriterId(),
    lease: {
      ...safeLease,
      hasFenceSignature: Boolean(fenceSignature),
    },
    circuitBreakerState: replicaCircuitBreaker.getState(),
    allowlistedPaths: REPLICA_READ_ALLOWLIST,
  }
}
