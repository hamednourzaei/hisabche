// ============================================
// Capability #70 — automatic depreciation posting.
//
// ⚠️ WHAT THIS ADDS, AND WHAT IT DELIBERATELY DOES NOT.
//
// `AssetsService.postDue` already existed: it finds every schedule row whose
// `on_date` has passed, posts Dr expense / Cr accumulated depreciation through
// the ledger, and marks the row `posted_at`. It is idempotent twice over —
// `posted_at IS NULL` in the query, and the ledger's `already_posted` outcome
// for a row that was claimed by an earlier run. The endpoint exists too
// (`POST /api/finance/assets/depreciation/run`).
//
// So capability #70 is NOT "build depreciation". It is: **nobody was calling it
// on a schedule**. A shop that did not open the finance page and press the
// button every month simply accumulated a growing `posted_at IS NULL` backlog,
// and every month of depreciation eventually posted at once — which is exactly
// the failure the precomputed schedule exists to prevent (lesson 34: "a month
// in which the job did not run is a month in which nothing happened, and nothing
// says so").
//
// This closes that gap using the existing runtime: `runScheduledOnce`, the same
// claim-the-slot-once mechanism the trial-expiration and event-recovery passes
// use. No new scheduler, no new queue (Phase 0 removed two).
//
// ⚠️ TENANCY: this worker has no logged-in user, so it cannot borrow a
// `TenancyContext` from anywhere. It enumerates the workspaces that actually own
// depreciable assets and builds a context per workspace, with a null actor.
//
// A null `userId` is correct here and is NOT the fail-open pattern that was
// removed three times (lesson: `workspaceId ?? userId`). The direction is
// inverted: the workspace comes from the asset's own row, and the user is
// written on the schedule update as "nobody did this by hand". The engine's own
// decision — accounts, amounts, dates, whether to post at all — is untouched.
// ============================================

import { supabase } from '../db'
import { TenancyContext } from '../services/tenancy.service'
import { AssetsService } from '../services/assets/assets.service'

const assetsService = new AssetsService()

/**
 * The actor recorded on a depreciation entry nobody pressed a button for.
 *
 * ⚠️ A real, greppable string rather than `null`, because `audit_logs.user_id`
 * is a uuid column: a null would be indistinguishable from "the row lost its
 * author", and an audit trail that cannot say a system posted something is an
 * audit trail that gets ignored.
 */
const SCHEDULED_ACTOR = '00000000-0000-0000-0000-000000000000'

export interface DepreciationPostingResult {
  workspaces: number
  posted: number
  skipped: number
  /** Per-workspace failures, reported rather than swallowed. */
  errors: { workspaceId: string; reason: string }[]
}

/**
 * Run depreciation for every workspace that owes some.
 *
 * ⚠️ `asOf` is the date the schedule is measured against, and the ledger date
 * for each entry is the row's OWN `on_date` — not today. A run six weeks late
 * posts six entries at six accounting dates, which is what makes the books
 * correct rather than merely complete.
 */
export async function runDepreciationPosting(asOf?: string): Promise<DepreciationPostingResult> {
  const result: DepreciationPostingResult = { workspaces: 0, posted: 0, skipped: 0, errors: [] }
  const dueDate = asOf ?? new Date().toISOString().slice(0, 10)

  // The workspaces that actually owe depreciation. Derived from the schedule
  // itself rather than from `workspaces`, so a business with no assets costs
  // one cheap indexed read instead of one post per workspace.
  const { data: owed, error } = await supabase
    .from('asset_depreciation_schedule')
    .select('workspace_id')
    .eq('cancelled_at', null)
    .is('posted_at', null)
    .lte('on_date', dueDate)
    .limit(1000)

  if (error) throw new Error(`Failed to list workspaces owing depreciation: ${error.message}`)

  const workspaceIds = [...new Set((owed ?? []).map((row) => row.workspace_id as string))]
  result.workspaces = workspaceIds.length

  for (const workspaceId of workspaceIds) {
    // No logged-in actor: this is a scheduled posting.
    //
    // ⚠️ `role: 'owner'` is stated openly rather than hidden behind a cast. It
    // reads as authority being granted, so: the ENGINE makes no authorization
    // decision here. `postDue` resolves accounts, computes amounts and decides
    // what to post; it never asks what the actor may do. The role exists on the
    // context because the interface requires one, and 'owner' is the only value
    // that will not make some future guard inside the engine silently narrow
    // the run. If a guard is ever added that reads this role, THAT is the moment
    // to decide how a scheduled posting is authorized — not to guess now.
    const ctx = {
      workspaceId,
      userId: SCHEDULED_ACTOR,
      role: 'owner',
    } as unknown as TenancyContext

    try {
      const outcome = await assetsService.postDue(ctx, dueDate)
      result.posted += outcome.posted.length
      result.skipped += outcome.skipped.length

      for (const skip of outcome.skipped) {
        // An asset with no accounts configured never depreciates, and without
        // this line nobody would ever be told which asset to fix.
        console.warn(
          `[depreciation] ${workspaceId}: asset ${skip.assetId} period ${skip.period} skipped (${skip.reason})`,
        )
      }
    } catch (err) {
      // One workspace failing must not stop the others. The failure is REPORTED
      // with its workspace, not logged and forgotten — the next run retries it
      // anyway, because the row is still `posted_at IS NULL`.
      const reason = err instanceof Error ? err.message : String(err)
      result.errors.push({ workspaceId, reason })
      console.error(`[depreciation] ${workspaceId} failed:`, err)
    }
  }

  return result
}
