import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { primaryDb } from './primary'
import { replicaCircuitBreaker } from './circuit-breaker'
import type { DatabaseHealth } from './runtime-types'

const replicaUrl = process.env.SUPABASE_REPLICA_URL
const serviceKey = process.env.SUPABASE_SERVICE_KEY

let replicaClient: SupabaseClient | null = null
if (replicaUrl && serviceKey) {
  replicaClient = createClient(replicaUrl, serviceKey, {
    auth: { persistSession: false },
  })
}

export function setReplicaClientForTest(client: SupabaseClient | null): void {
  replicaClient = client
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

export async function measureReplicaLagMs(): Promise<number | null> {
  if (!replicaClient) return null
  const start = Date.now()
  try {
    const { error } = await replicaClient.from('products').select('id').limit(1)
    if (error) {
      replicaCircuitBreaker.recordFailure()
      return null
    }
    const latency = Date.now() - start
    replicaCircuitBreaker.recordSuccess()
    return latency
  } catch {
    replicaCircuitBreaker.recordFailure()
    return null
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
