import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { primaryDb } from './primary'
import { replicaCircuitBreaker } from './circuit-breaker'
import { selectReadClient } from './routing'
import type { DatabaseHealth } from './runtime-types'

const replicaUrl = process.env.SUPABASE_REPLICA_URL
const serviceKey = process.env.SUPABASE_SERVICE_KEY

let replicaClient: SupabaseClient | null = null
if (replicaUrl && serviceKey) {
  replicaClient = createClient(replicaUrl, serviceKey, {
    auth: { persistSession: false },
  })
}

export type ReplicationLagProbe = (client: SupabaseClient) => Promise<{
  lagMs: number | null
  source: 'wal_replay' | 'rtt_fallback' | 'unavailable'
}>

let customLagProbe: ReplicationLagProbe | null = null

export function setReplicaClientForTest(client: SupabaseClient | null): void {
  replicaClient = client
}

export function setReplicationLagProbeForTest(probe: ReplicationLagProbe | null): void {
  customLagProbe = probe
}

export async function checkPrimaryPing(): Promise<{ healthy: boolean; latencyMs: number | null }> {
  const start = Date.now()
  try {
    const probePromise = primaryDb.from('products').select('id').limit(1)
    const timeoutPromise = new Promise<{ error: Error }>((resolve) =>
      setTimeout(() => resolve({ error: new Error('Health check timeout') }), 2500),
    )
    const result = (await Promise.race([probePromise, timeoutPromise])) as { error: unknown }
    const healthy = !result.error
    return { healthy, latencyMs: Date.now() - start }
  } catch {
    return { healthy: false, latencyMs: null }
  }
}

export function getReplicaClientOrPrimary(): {
  client: SupabaseClient
  isReplica: boolean
} {
  // If circuit breaker is open, divert immediately to primary
  if (!replicaCircuitBreaker.isAvailable()) {
    return { client: primaryDb, isReplica: false }
  }

  if (replicaClient) {
    return { client: replicaClient, isReplica: true }
  }
  return { client: primaryDb, isReplica: false }
}

export async function measureReplicaLagDetails(): Promise<{
  lagMs: number | null
  source: 'wal_replay' | 'rtt_fallback' | 'unavailable'
}> {
  if (!replicaClient) return { lagMs: null, source: 'unavailable' }

  if (customLagProbe) {
    try {
      const probed = await customLagProbe(replicaClient)
      if (probed.lagMs === null || !Number.isFinite(probed.lagMs) || probed.lagMs < 0) {
        replicaCircuitBreaker.recordFailure()
        return { lagMs: null, source: 'unavailable' }
      }
      replicaCircuitBreaker.recordSuccess()
      return probed
    } catch {
      replicaCircuitBreaker.recordFailure()
      return { lagMs: null, source: 'unavailable' }
    }
  }

  // 1. Prefer genuine PostgreSQL WAL replay lag RPC when installed on replica
  try {
    const rpcRes = (await replicaClient.rpc('get_replication_lag_ms')) as {
      data: unknown
      error: { code?: string; message?: string } | null
    }
    if (!rpcRes.error && rpcRes.data !== null && rpcRes.data !== undefined) {
      const numericLag = Number(
        typeof rpcRes.data === 'object' && rpcRes.data !== null && 'lag_ms' in rpcRes.data
          ? (rpcRes.data as { lag_ms: unknown }).lag_ms
          : rpcRes.data,
      )
      if (Number.isFinite(numericLag) && numericLag >= 0) {
        replicaCircuitBreaker.recordSuccess()
        return { lagMs: numericLag, source: 'wal_replay' }
      }
    }
    const missingRpc =
      rpcRes.error?.code === 'PGRST202' ||
      rpcRes.error?.code === '42883' ||
      typeof replicaClient.rpc !== 'function'
    if (rpcRes.error && !missingRpc) {
      replicaCircuitBreaker.recordFailure()
      return { lagMs: null, source: 'unavailable' }
    }
  } catch {
    // Fall through to RTT probe only if `.rpc` is unavailable in simple mocks
  }

  // 2. Connectivity + RTT fallback when WAL lag RPC is absent
  const start = Date.now()
  try {
    const { error } = await replicaClient.from('products').select('id').limit(1)
    if (error) {
      replicaCircuitBreaker.recordFailure()
      return { lagMs: null, source: 'unavailable' }
    }
    const latency = Date.now() - start
    replicaCircuitBreaker.recordSuccess()
    return { lagMs: latency, source: 'rtt_fallback' }
  } catch {
    replicaCircuitBreaker.recordFailure()
    return { lagMs: null, source: 'unavailable' }
  }
}

export async function measureReplicaLagMs(): Promise<number | null> {
  const detail = await measureReplicaLagDetails()
  return detail.lagMs
}

/**
 * End-to-end read routing that measures current replica lag (failing closed to
 * primary whenever lag is unknown or exceeds `maxLagMs`) before selecting client.
 */
export async function queryReadClient(params: {
  callerPath: string
  maxLagMs?: number | undefined
}): Promise<{
  client: SupabaseClient
  target: 'primary' | 'replica'
  reason: string
  measuredLagMs: number | null
}> {
  const lagDetail = replicaClient
    ? await measureReplicaLagDetails()
    : { lagMs: null, source: 'unavailable' as const }
  const routed = selectReadClient({
    callerPath: params.callerPath,
    replicaLagMs: lagDetail.lagMs,
    maxLagMs: params.maxLagMs,
  })
  return {
    ...routed,
    measuredLagMs: lagDetail.lagMs,
  }
}

export async function checkReplicaHealth(): Promise<DatabaseHealth> {
  const now = new Date().toISOString()
  if (!replicaClient) {
    return {
      isHealthy: false,
      provider: 'supabase',
      role: 'replica',
      replicationLagMs: null,
      activeConnections: 0,
      lastCheckedAt: now,
      error: 'Replica URL or service key not configured',
    }
  }

  const lag = await measureReplicaLagMs()
  const isHealthy = lag !== null && replicaCircuitBreaker.isAvailable()

  return {
    isHealthy,
    provider: 'supabase',
    role: 'replica',
    replicationLagMs: lag,
    activeConnections: isHealthy ? 1 : 0,
    lastCheckedAt: now,
    error: isHealthy ? undefined : 'Replica unresponsive or circuit breaker tripped',
  }
}

export const replicaDb = replicaClient ?? primaryDb
