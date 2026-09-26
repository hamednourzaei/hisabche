// ============================================
// Background work that stays correct with N backend instances.
//
// Every guarantee lives in Postgres (docs/background-jobs-claim-migration.sql):
// job claims are one statement with FOR UPDATE SKIP LOCKED, completion is
// conditional on still holding the claim, and a scheduled task runs once per
// slot across all instances. Nothing here is an in-memory or per-process lock —
// this module only calls those functions and names this process.
//
// Before the migration runs the functions do not exist. That is reported as
// `null` ("not configured") so callers keep today's single-instance behaviour
// instead of failing — which is only safe while ONE instance runs.
// ============================================

import { hostname } from 'node:os'
import { randomUUID } from 'node:crypto'

import { supabase } from '../db'

/** This process, for claim ownership. Stable for the life of the process. */
export const WORKER_ID = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`

/** How long a claim is held before another instance may recover it. */
export const JOB_LEASE_SECONDS = 15 * 60

export interface ClaimedJob {
  id: string
  job_type: string
  payload: Record<string, unknown> | null
  retry_count: number | null
  max_retries: number | null
}

function isMissingFunction(error: { code?: string } | null): boolean {
  // PostgREST: function not in the schema cache; Postgres: undefined function.
  return !!error && (error.code === 'PGRST202' || error.code === '42883')
}

/** Claim due jobs for this process. `null` = the claim function is not installed yet. */
export async function claimJobs(limit = 5): Promise<ClaimedJob[] | null> {
  const { data, error } = await supabase.rpc('claim_background_jobs', {
    p_worker: WORKER_ID,
    p_limit: limit,
    p_lease_seconds: JOB_LEASE_SECONDS,
  })
  if (isMissingFunction(error)) return null
  if (error) throw error
  return (data ?? []) as ClaimedJob[]
}

/** `false` when this process no longer held the job (its lease expired and it was re-claimed). */
export async function completeJob(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('complete_background_job', {
    p_id: id,
    p_worker: WORKER_ID,
  })
  if (error) throw error
  return data === true
}

/** The job's new status ('pending' = will retry, 'failed'), or null when no longer held. */
export async function failJob(
  id: string,
  message: string,
  retryDelaySeconds = 60,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('fail_background_job', {
    p_id: id,
    p_worker: WORKER_ID,
    p_error: message,
    p_retry_delay_seconds: retryDelaySeconds,
  })
  if (error) throw error
  return typeof data === 'string' ? data : null
}

/**
 * The slot a scheduled tick belongs to: the same string on every instance for
 * the same tick, so exactly one of them gets to run it.
 */
export function slotOf(periodSeconds: number, now: Date = new Date()): string {
  return String(Math.floor(now.getTime() / 1000 / periodSeconds))
}

/**
 * Run `task` for this slot only if no other instance has, and none is still
 * running it. Returns whether this process ran it.
 *
 * Before the migration the claim function is missing and the task runs as it
 * always has — correct for one instance only.
 */
export async function runScheduledOnce(
  task: string,
  slot: string,
  run: () => Promise<void>,
  leaseSeconds = JOB_LEASE_SECONDS,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_scheduled_run', {
    p_task: task,
    p_slot: slot,
    p_holder: WORKER_ID,
    p_lease_seconds: leaseSeconds,
  })

  if (isMissingFunction(error)) {
    await run()
    return true
  }
  if (error) throw error
  if (data !== true) return false

  let failure: string | null = null
  try {
    await run()
  } catch (err) {
    failure = err instanceof Error ? err.message : String(err)
    throw err
  } finally {
    await supabase.rpc('finish_scheduled_run', {
      p_task: task,
      p_slot: slot,
      p_holder: WORKER_ID,
      p_error: failure,
    })
  }
  return true
}
