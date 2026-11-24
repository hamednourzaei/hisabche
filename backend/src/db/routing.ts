// ============================================
// backend/src/db/routing.ts
//
// Authoritative Read/Write Database Router & Fencing Dispatcher
// Enforces single-writer invariant, signed writer epoch verification,
// target switching on standby promotion, and fail-closed replica routing.
// ============================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { getRegisteredWriterClient, primaryDb } from './primary'
import { getReplicaClientOrPrimary } from './replica'
import { replicaCircuitBreaker } from './circuit-breaker'
import { globalFencingEngine } from './fencing'
import type { FencingToken, WriterLease, WriterLeaseStore } from './runtime-types'

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

/**
 * Selects read database client with FAIL-CLOSED replica health & lag policy:
 * unknown (`null` / `undefined` / negative / NaN) replication lag falls back to
 * primary unless the replica circuit is explicitly healthy with a measured lag <= maxLagMs.
 */
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

  // 3. Fail-closed on unknown/missing replication lag
  const maxLag = params.maxLagMs ?? DEFAULT_MAX_REPLICA_LAG_MS
  if (
    params.replicaLagMs === null ||
    params.replicaLagMs === undefined ||
    !Number.isFinite(params.replicaLagMs) ||
    params.replicaLagMs < 0
  ) {
    return { client: primaryDb, target: 'primary', reason: 'replica_lag_unknown' }
  }

  if (params.replicaLagMs > maxLag) {
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
