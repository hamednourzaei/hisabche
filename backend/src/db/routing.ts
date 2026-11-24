// ============================================
// backend/src/db/routing.ts
//
// Authoritative Read/Write Database Router & Fencing Dispatcher
// Enforces single-writer invariant, writer epoch verification,
// and replica circuit-breaker routing.
// ============================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { primaryDb } from './primary'
import { getReplicaClientOrPrimary } from './replica'
import { replicaCircuitBreaker } from './circuit-breaker'
import { globalFencingEngine } from './fencing'
import type { FencingToken, WriterLease } from './runtime-types'

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

export function selectReadClient(params: {
  callerPath: string
  replicaLagMs?: number | null | undefined
  maxLagMs?: number | undefined
}): { client: SupabaseClient; target: 'primary' | 'replica'; reason: string } {
  // 1. Check if caller path is in the read-replica allowlist
  if (!isReplicaAllowedCaller(params.callerPath)) {
    return { client: primaryDb, target: 'primary', reason: 'caller_not_allowlisted' }
  }

  // 2. Check circuit breaker status
  if (!replicaCircuitBreaker.isAvailable()) {
    return { client: primaryDb, target: 'primary', reason: 'circuit_breaker_open' }
  }

  // 3. Check replication lag threshold
  const maxLag = params.maxLagMs ?? DEFAULT_MAX_REPLICA_LAG_MS
  if (
    params.replicaLagMs !== null &&
    params.replicaLagMs !== undefined &&
    params.replicaLagMs > maxLag
  ) {
    replicaCircuitBreaker.recordFailure()
    return { client: primaryDb, target: 'primary', reason: 'replica_lag_exceeded' }
  }

  // 4. Retrieve candidate client
  const { client, isReplica } = getReplicaClientOrPrimary()
  return {
    client,
    target: isReplica ? 'replica' : 'primary',
    reason: isReplica ? 'replica_healthy' : 'replica_unset_fallback',
  }
}

/**
 * Selects the authorized active writer client.
 * Strictly verifies the fencing token and epoch against the active writer lease.
 * Throws FencingTokenRejectedError if split-brain or stale epoch is detected.
 */
export function selectWriteClient(params?: { fencingToken?: FencingToken | null | undefined }): {
  client: SupabaseClient
  target: 'primary'
  epoch: number
  writerId: string
} {
  globalFencingEngine.assertValidWriter(params?.fencingToken)

  return {
    client: primaryDb,
    target: 'primary',
    epoch: globalFencingEngine.getCurrentEpoch(),
    writerId: globalFencingEngine.getCurrentWriterId(),
  }
}

export function getDatabaseRoutingOverview(): {
  activeEpoch: number
  activeWriterId: string
  lease: WriterLease
  circuitBreakerState: string
  allowlistedPaths: readonly string[]
} {
  return {
    activeEpoch: globalFencingEngine.getCurrentEpoch(),
    activeWriterId: globalFencingEngine.getCurrentWriterId(),
    lease: globalFencingEngine.getActiveLease(),
    circuitBreakerState: replicaCircuitBreaker.getState(),
    allowlistedPaths: REPLICA_READ_ALLOWLIST,
  }
}
