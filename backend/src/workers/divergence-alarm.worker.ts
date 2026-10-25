// ============================================
// backend/src/workers/divergence-alarm.worker.ts
//
// The alarm that did not exist: divergence data was being written and read by
// nobody, so «zero divergence» meant «nobody looked».
//
// ⚠️ IT USES THE ONE JOB RUNTIME. `runScheduledOnce` claims this hour's slot in
// Postgres, so with N instances the pass runs once — the same authority the
// trial-expiration, depreciation and automation passes use. No new scheduler, no
// new queue (`job-authority-guard.test.ts` would reject one).
//
// ⚠️ IT NOTIFIES; IT NEVER REVERTS ANYTHING. The kill switch stays a human
// decision (`CoreDivergenceService.setKillSwitch`). An alarm that flipped
// authority by itself would be a second authority over money, which is the
// thing shadow mode exists to keep a human in charge of.
//
// ⚠️ A FAILED NOTIFICATION CANNOT UNDO A READ OR A PAYMENT. There is no write to
// undo here — the worker only reads counts — and the notification failure is
// logged, never thrown out of the worker (CLAUDE.md: notifications cannot revert
// a completed write; `event-log` and `InvoiceService` do the same).
// ============================================

import {
  DEFAULT_DIVERGENCE_THRESHOLD,
  evaluateDivergenceWindow,
  summarizeDivergenceAlarms,
  type DivergenceThreshold,
  type DivergenceVerdict,
} from '@hisabche/validation'

import { supabase } from '../db'
import { selectAllPages } from '../utils/fetch-all-pages'
import { NotificationService } from '../services/notification.service'
import { countComparisons, readDivergenceWindows } from '../services/core-divergence-alarm.service'

const notifications = new NotificationService()

/** The window each pass judges: the last hour. */
export const ALARM_WINDOW_SECONDS = 60 * 60

export interface DivergenceAlarmResult {
  /** Capabilities that crossed their limit in at least one workspace. */
  firing: string[]
  /** One line for the log. */
  message: string
  /**
   * Every window looked at, with its verdict — the honest detail.
   *
   * ⚠️ One entry PER WORKSPACE PER CAPABILITY, because the threshold is a
   * per-tenant setting: the same rate can fire in one shop and not another.
   */
  judged: (DivergenceVerdict & { capability: string; workspaceId: string })[]
  /** Reads or counts that failed, reported rather than swallowed. */
  errors: { stage: string; reason: string }[]
  /** Workspaces notified. */
  notified: number
}

function isoAt(epochMs: number): string {
  return new Date(epochMs).toISOString()
}

/**
 * Which workspaces own the diverged rows — read once, from the same window the
 * rate is judged over.
 *
 * ⚠️ The alarm is per tenant because the NOTIFICATION is per tenant: a manager
 * of shop A must not be told shop B's core is misbehaving, and the threshold
 * that decides is shop A's own.
 */
async function rowsInWindow(
  since: string,
  until: string,
): Promise<{ workspace_id: string; capability: string }[]> {
  // ⚠️ PAGED, NOT `.limit()`ed. PostgREST truncates at `max-rows` (1000) with no
  // error, so a `.limit(2000)` would silently drop rows and under-report which
  // workspaces have diverging data — the «silent row cap» bug.
  const page = (from: number, to: number) =>
    supabase
      .from('core_divergence')
      .select('workspace_id, capability')
      .gte('detected_at', since)
      .lt('detected_at', until)
      .order('detected_at', { ascending: true })
      .range(from, to)

  const { data, error } = await selectAllPages<
    { workspace_id: string; capability: string },
    { message: string }
  >(page)

  if (error) throw new Error(`Failed to read diverging workspaces: ${error.message}`)
  return data ?? []
}

/** The settings a tenant's alarm is judged against. */
async function thresholdFor(workspaceId: string): Promise<DivergenceThreshold> {
  // A stored value is the durable answer once a migration carries one; until
  // then the shipped default applies, and that default is OFF.
  const { data, error } = await supabase
    .from('workspaces')
    .select('divergence_alarm_percent')
    .eq('id', workspaceId)
    .maybeSingle()

  // ⚠️ AN ABSENT COLUMN MEANS «NOT CONFIGURED», NOT «OFF AT ZERO».
  // PostgREST answers 42703 / PGRST204 when the additive migration has not run;
  // that is «this deployment has no stored threshold», and the shipped default
  // (which is null = off) is the correct read.
  if (error) {
    const code = (error as { code?: string }).code
    if (code === '42703' || code === 'PGRST204') return DEFAULT_DIVERGENCE_THRESHOLD
    throw new Error(`Failed to read the divergence threshold: ${error.message}`)
  }

  const stored = (data as { divergence_alarm_percent?: number | null } | null)
    ?.divergence_alarm_percent
  return {
    percent: typeof stored === 'number' ? stored : DEFAULT_DIVERGENCE_THRESHOLD.percent,
    minOpportunities: DEFAULT_DIVERGENCE_THRESHOLD.minOpportunities,
  }
}

/**
 * One pass of the divergence alarm.
 *
 * Exported for the test, and for a rollout where an operator wants to run it by
 * hand before trusting the schedule.
 */
export async function runDivergenceAlarm(now: Date = new Date()): Promise<DivergenceAlarmResult> {
  const result: DivergenceAlarmResult = {
    firing: [],
    message: '',
    judged: [],
    errors: [],
    notified: 0,
  }

  const until = isoAt(now.getTime())
  const since = isoAt(now.getTime() - ALARM_WINDOW_SECONDS * 1000)

  const read = await readDivergenceWindows(since, until)
  for (const error of read.errors) {
    result.errors.push({ stage: `read:${error.capability}`, reason: error.reason })
  }

  // Nothing to judge is a real answer, said plainly.
  if (read.windows.length === 0 && read.errors.length === 0) {
    result.message = 'No divergences recorded in the window.'
    return result
  }

  // Which tenant owns which divergence. Read once; the rate is judged per
  // tenant because the threshold is a per-tenant setting.
  let rowsByWorkspace: { workspace_id: string; capability: string }[]
  try {
    rowsByWorkspace = await rowsInWindow(since, until)
  } catch (error) {
    result.errors.push({
      stage: 'workspaces',
      reason: error instanceof Error ? error.message : String(error),
    })
    return result
  }

  for (const window of read.windows) {
    let opportunities: number | null
    try {
      opportunities = await countComparisons(window.capability, since, until)
    } catch (error) {
      result.errors.push({
        stage: `count:${window.capability}`,
        reason: error instanceof Error ? error.message : String(error),
      })
      continue
    }

    // No denominator: cannot judge a rate, and saying «fine» would be a claim
    // nobody measured.
    if (opportunities === null) continue

    // ⚠️ THE THRESHOLD IS PER TENANT, SO THE JUDGEMENT IS PER TENANT.
    //
    // Judging once globally with the shipped default (which is OFF) and then
    // re-judging per workspace made the global pass always say «nothing fired»
    // — which is what the first version of this loop did, and what its test
    // caught. Each workspace's own threshold decides.
    const owners = new Map<string, number>()
    for (const row of rowsByWorkspace) {
      if (row.capability !== window.capability) continue
      owners.set(row.workspace_id, (owners.get(row.workspace_id) ?? 0) + 1)
    }
    const comparisonsPerWorkspace = owners.size > 0 ? Math.floor(opportunities / owners.size) : 0

    for (const [workspaceId, divergences] of owners) {
      let threshold: DivergenceThreshold
      try {
        threshold = await thresholdFor(workspaceId)
      } catch (error) {
        result.errors.push({
          stage: `threshold:${workspaceId}`,
          reason: error instanceof Error ? error.message : String(error),
        })
        continue
      }

      const verdict = evaluateDivergenceWindow(
        {
          capability: window.capability,
          divergences,
          opportunities: comparisonsPerWorkspace,
        },
        threshold,
      )
      result.judged.push({ ...verdict, capability: window.capability, workspaceId })
    }
  }

  const summary = summarizeDivergenceAlarms(result.judged)
  result.firing = [...new Set(summary.firing)]
  result.message = summary.message

  if (result.firing.length === 0) return result

  // Tell the tenants whose own data diverged: one notification per workspace,
  // naming the capabilities that crossed, never a second notification system.
  const byWorkspace = new Map<string, (DivergenceVerdict & { capability: string })[]>()
  for (const verdict of result.judged) {
    if (!verdict.alarm || !verdict.workspaceId) continue
    const list = byWorkspace.get(verdict.workspaceId) ?? []
    list.push(verdict)
    byWorkspace.set(verdict.workspaceId, list)
  }

  for (const [workspaceId, verdicts] of byWorkspace) {
    try {
      const owners = await ownerIdsOf(workspaceId)
      for (const userId of owners) {
        await notifications.create(workspaceId, {
          user_id: userId,
          title: 'واگرایی هسته‌ی مشترک',
          body: verdicts.map((v) => v.message).join('\n'),
          type: 'warning',
          action_url: '/sync-center',
          entity_type: 'core_divergence',
          metadata: {
            capabilities: verdicts.map((v) => v.capability),
            since,
            until,
          },
        })
      }
      result.notified += 1
    } catch (error) {
      // ⚠️ A NOTIFICATION THAT FAILS MUST NOT STOP THE OTHERS, and must not be
      // thrown: nothing this worker did can be undone by it.
      result.errors.push({
        stage: `notify:${workspaceId}`,
        reason: error instanceof Error ? error.message : String(error),
      })
      console.error('[divergence-alarm] notification failed:', error)
    }
  }

  return result
}

/**
 * Who receives the alarm: the workspace's owners.
 *
 * A member who cannot change anything about the core cannot act on this, so
 * telling every member would train them to ignore it.
 */
async function ownerIdsOf(workspaceId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'owner')
    .eq('has_access', true)
    // .is, not .eq: `= null` is never true, so a suspended owner would be
    // notified forever (BUG-084).
    .is('suspended_at', null)
    .limit(50)

  if (error) throw new Error(`Failed to list owners of ${workspaceId}: ${error.message}`)
  return ((data ?? []) as { user_id: string }[]).map((row) => row.user_id)
}
