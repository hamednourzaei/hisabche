// ============================================
// backend/src/services/monitoring/core-gauges.ts
//
// Core-level gauges the request boundary cannot see: the background job
// queue and database vitals. Sampled ONCE per closed minute by the one
// collector flush (route-metrics.ts) — never per request, never per viewer.
//
// HONESTY RULES
//   - counts are `count: 'exact', head: true` (a number someone decides on
//     is never an estimate — AGENTS §3);
//   - a missing table or a failed RPC is NULL (UNKNOWN in the UI), never 0;
//   - no ids, no payloads, no error text leaves this module — counts only.
// ============================================

import { supabase } from '../../db'
import { JOB_LEASE_SECONDS } from '../distributed-work'
import type { CoreGaugeSample } from './route-metrics'

interface CountResult {
  count: number | null
  error: { code?: string } | null
}

/** A failed or missing-schema count is UNKNOWN (null), never zero. */
function countOf(result: CountResult): number | null {
  if (result.error) return null
  return result.count ?? null
}

/** The job queue is global (Postgres-backed): it covers every claiming instance. */
async function jobQueueGauge(now: Date): Promise<CoreGaugeSample['cores'][number]> {
  const stuckBefore = new Date(now.getTime() - JOB_LEASE_SECONDS * 1000).toISOString()
  const [pendingRes, processingRes, stuckRes] = await Promise.all([
    supabase
      .from('background_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('background_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'processing'),
    supabase
      .from('background_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'processing')
      .lt('started_at', stuckBefore),
  ])
  const pending = countOf(pendingRes)
  const processing = countOf(processingRes)
  const stuck = countOf(stuckRes)

  // Retries already spent by jobs that are still queued or running. A sum of
  // a stored counter — measured, not inferred. Null when the read fails.
  let retryCount: number | null = null
  if (pending !== null || processing !== null) {
    const { data, error } = await supabase
      .from('background_jobs')
      .select('retry_count')
      .in('status', ['pending', 'processing'])
    if (!error && Array.isArray(data)) {
      retryCount = data.reduce((sum, row) => {
        const value = (row as { retry_count?: unknown }).retry_count
        return sum + (typeof value === 'number' && Number.isFinite(value) ? value : 0)
      }, 0)
    }
  }

  return {
    coreId: 'jobs',
    queueDepth: pending,
    processingCount: processing,
    stuckCount: stuck,
    retryCount,
    // Wait time per job is not recorded; the queue depth trend is the signal.
    queueWaitTotalMs: null,
  }
}

async function dbGauge(): Promise<CoreGaugeSample['db']> {
  const { data, error } = await supabase.rpc('admin_db_vitals')
  if (error || data === null || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  const connections = (row.connections ?? {}) as Record<string, unknown>
  const locks = (row.locks ?? {}) as Record<string, unknown>
  const cache = (row.cache ?? {}) as Record<string, unknown>
  const database = (row.database ?? {}) as Record<string, unknown>
  const num = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null
  return {
    connections_active: num(connections.active),
    connections_idle: num(connections.idle),
    connections_total: num(connections.total),
    connections_max: num(connections.max),
    waiting_locks: num(locks.waiting),
    cache_hit_ratio: num(cache.hitRatio),
    longest_transaction_seconds: num(locks.longestTransactionSeconds),
    database_size_bytes: num(database.sizeBytes),
  }
}

/** One sample for the collector flush. Partial failure degrades to null, never throws. */
export async function sampleCoreGauges(now: Date = new Date()): Promise<CoreGaugeSample> {
  const [jobs, db] = await Promise.all([
    jobQueueGauge(now).catch(() => ({
      coreId: 'jobs',
      queueDepth: null,
      processingCount: null,
      stuckCount: null,
      retryCount: null,
      queueWaitTotalMs: null,
    })),
    dbGauge().catch(() => null),
  ])
  // A gauge that measured nothing is not written as a row of zeros.
  const cores =
    jobs.queueDepth === null && jobs.processingCount === null && jobs.stuckCount === null
      ? []
      : [jobs]
  return { cores, db }
}
