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

export type ReplicationLagSource = 'wal_replay' | 'rtt_fallback' | 'unavailable'

export interface ReplicationLagMeasurement {
  readonly lagMs: number | null
  readonly rttMs: number | null
  readonly source: ReplicationLagSource
  readonly measuredAt: string
}

export interface ReplicaObservabilityMetrics {
  readonly currentLagMs: number | null
  readonly lastRttMs: number | null
  readonly lastMeasuredAt: string | null
  readonly measurementAgeMs: number | null
  readonly source: ReplicationLagSource
  readonly fallbackCount: number
  readonly consecutiveFailures: number
  readonly circuitBreakerState: string
}

export type ReplicationLagProbe = (client: SupabaseClient) => Promise<{
  lagMs: number | null
  rttMs?: number | null | undefined
  source: ReplicationLagSource
}>

let customLagProbe: ReplicationLagProbe | null = null
let lastLagMs: number | null = null
let lastRttMs: number | null = null
let lastMeasuredAtMs: number | null = null
let lastLagSource: ReplicationLagSource = 'unavailable'
let fallbackCount = 0

export function recordReplicaFallback(): void {
  fallbackCount += 1
}

export function getReplicaObservabilityMetrics(
  nowMs: number = Date.now(),
): ReplicaObservabilityMetrics {
  return {
    currentLagMs: lastLagMs,
    lastRttMs,
    lastMeasuredAt: lastMeasuredAtMs !== null ? new Date(lastMeasuredAtMs).toISOString() : null,
    measurementAgeMs: lastMeasuredAtMs !== null ? Math.max(0, nowMs - lastMeasuredAtMs) : null,
    source: lastLagSource,
    fallbackCount,
    consecutiveFailures: replicaCircuitBreaker.getFailureCount(),
    circuitBreakerState: replicaCircuitBreaker.getState(),
  }
}

export function resetReplicaMetricsForTest(): void {
  lastLagMs = null
  lastRttMs = null
  lastMeasuredAtMs = null
  lastLagSource = 'unavailable'
  fallbackCount = 0
}

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

export async function measureReplicaLagDetails(): Promise<ReplicationLagMeasurement> {
  const nowMs = Date.now()
  const measuredAt = new Date(nowMs).toISOString()
  if (!replicaClient) {
    lastLagMs = null
    lastLagSource = 'unavailable'
    return { lagMs: null, rttMs: null, source: 'unavailable', measuredAt }
  }

  if (customLagProbe) {
    try {
      const probed = await customLagProbe(replicaClient)
      const rttMs =
        probed.rttMs !== undefined && probed.rttMs !== null && Number.isFinite(probed.rttMs)
          ? probed.rttMs
          : null
      if (
        probed.source !== 'wal_replay' ||
        probed.lagMs === null ||
        !Number.isFinite(probed.lagMs) ||
        probed.lagMs < 0
      ) {
        replicaCircuitBreaker.recordFailure()
        lastLagMs = null
        lastRttMs = rttMs
        lastMeasuredAtMs = nowMs
        lastLagSource = probed.source === 'rtt_fallback' ? 'rtt_fallback' : 'unavailable'
        return { lagMs: null, rttMs, source: lastLagSource, measuredAt }
      }
      replicaCircuitBreaker.recordSuccess()
      lastLagMs = probed.lagMs
      lastRttMs = rttMs
      lastMeasuredAtMs = nowMs
      lastLagSource = 'wal_replay'
      return { lagMs: probed.lagMs, rttMs, source: 'wal_replay', measuredAt }
    } catch {
      replicaCircuitBreaker.recordFailure()
      lastLagMs = null
      lastMeasuredAtMs = nowMs
      lastLagSource = 'unavailable'
      return { lagMs: null, rttMs: null, source: 'unavailable', measuredAt }
    }
  }

  // 1. Prefer genuine PostgreSQL WAL replay lag RPC when installed on replica
  try {
    const start = Date.now()
    const rpcRes = (await replicaClient.rpc('get_replication_lag_ms')) as {
      data: unknown
      error: { code?: string; message?: string } | null
    }
    const rpcRtt = Date.now() - start
    if (!rpcRes.error && rpcRes.data !== null && rpcRes.data !== undefined) {
      const numericLag = Number(
        typeof rpcRes.data === 'object' && rpcRes.data !== null && 'lag_ms' in rpcRes.data
          ? (rpcRes.data as { lag_ms: unknown }).lag_ms
          : rpcRes.data,
      )
      if (Number.isFinite(numericLag) && numericLag >= 0) {
        replicaCircuitBreaker.recordSuccess()
        lastLagMs = numericLag
        lastRttMs = rpcRtt
        lastMeasuredAtMs = nowMs
        lastLagSource = 'wal_replay'
        return { lagMs: numericLag, rttMs: rpcRtt, source: 'wal_replay', measuredAt }
      }
    }
    const missingRpc =
      rpcRes.error?.code === 'PGRST202' ||
      rpcRes.error?.code === '42883' ||
      typeof replicaClient.rpc !== 'function'
    if (rpcRes.error && !missingRpc) {
      replicaCircuitBreaker.recordFailure()
      lastLagMs = null
      lastRttMs = rpcRtt
      lastMeasuredAtMs = nowMs
      lastLagSource = 'unavailable'
      return { lagMs: null, rttMs: rpcRtt, source: 'unavailable', measuredAt }
    }
  } catch {
    // Fall through to connectivity probe ONLY to measure network RTT (never replication lag)
  }

  // 2. Connectivity probe ONLY: network RTT is NEVER substituted for WAL replication lag.
  const start = Date.now()
  try {
    const { error } = await replicaClient.from('products').select('id').limit(1)
    const latency = Date.now() - start
    if (error) {
      replicaCircuitBreaker.recordFailure()
      lastLagMs = null
      lastRttMs = latency
      lastMeasuredAtMs = nowMs
      lastLagSource = 'unavailable'
      return { lagMs: null, rttMs: latency, source: 'unavailable', measuredAt }
    }
    // Connectivity succeeded, but real replication lag remains unknown -> fail-closed
    lastLagMs = null
    lastRttMs = latency
    lastMeasuredAtMs = nowMs
    lastLagSource = 'unavailable'
    return { lagMs: null, rttMs: latency, source: 'unavailable', measuredAt }
  } catch {
    replicaCircuitBreaker.recordFailure()
    lastLagMs = null
    lastMeasuredAtMs = nowMs
    lastLagSource = 'unavailable'
    return { lagMs: null, rttMs: null, source: 'unavailable', measuredAt }
  }
}

export async function measureReplicaLagMs(): Promise<number | null> {
  const detail = await measureReplicaLagDetails()
  return detail.lagMs
}

/**
 * End-to-end read routing that measures current replica lag (failing closed to
 * primary whenever lag is unknown, unverified, or exceeds `maxLagMs`) before selecting client.
 */
export async function queryReadClient(params: {
  callerPath: string
  maxLagMs?: number | undefined
  consistency?: 'strong' | 'bounded_staleness' | 'eventual' | undefined
  maxMeasurementAgeMs?: number | undefined
}): Promise<{
  client: SupabaseClient
  target: 'primary' | 'replica'
  reason: string
  measuredLagMs: number | null
  rttMs: number | null
  measurementSource: ReplicationLagSource
}> {
  const lagDetail = replicaClient
    ? await measureReplicaLagDetails()
    : {
        lagMs: null,
        rttMs: null,
        source: 'unavailable' as const,
        measuredAt: new Date().toISOString(),
      }
  const routed = selectReadClient({
    callerPath: params.callerPath,
    replicaLagMs: lagDetail.lagMs,
    maxLagMs: params.maxLagMs,
    consistency: params.consistency,
    measurementSource: lagDetail.source,
    measurementAgeMs: 0,
    maxMeasurementAgeMs: params.maxMeasurementAgeMs,
  })
  return {
    ...routed,
    measuredLagMs: lagDetail.lagMs,
    rttMs: lagDetail.rttMs,
    measurementSource: lagDetail.source,
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
