// ============================================
// Capability #69 — the month-end package, runnable.
//
// ⚠️ THIS ORCHESTRATES. IT IMPLEMENTS NOTHING.
//
// Every step below delegates to an engine that already exists and is already
// tested. This file decides which of them run, in what order, and — the one
// thing that matters — whether the period gets locked at all. The arithmetic, the
// accounts, the amounts, the period-lock precedence: all of that stays where it
// is. `month-end.domain.ts` holds the rules and is pure.
//
// ⚠️ WHY A PACKAGE AT ALL, GIVEN EVERY STEP CAN BE RUN BY HAND.
//
// Because the ORDER is the content, and nobody holds an order in their head. The
// individual buttons already existed — `POST /api/finance/assets/depreciation/run`,
// the year-end close, the period lock — and a shopkeeper who closes a month by
// clicking them in the wrong order produces correct books with a depreciation
// entry measured against a balance a revaluation has already moved. Nothing
// errors. The figure is just wrong, which is the one failure a ledger cannot
// detect by itself.
//
// ⚠️ THE LOCK IS THE POINT.
//
// A lock says «nothing more will be written here». Setting one while a step has
// failed produces a period that is sealed AND known-wrong, and the only way out
// is a person discovering it by hand. So the run stops at the first failure, and
// says which step and why.
//
// ⚠️ ROLE, STATED PLAINLY RATHER THAN WORKED AROUND.
//
// `CurrencyService.revalue` and `AccountingService.setPeriodLock` both refuse
// unless the context's role is owner or manager. A scheduled run has no user, so
// it is given `owner` — and that is a real authorization decision, not a
// technicality, which is why it is named here and in the worker's own comment
// rather than buried. A person pressing the button passes the same check with a
// real role and a real audit trail; a scheduled run passes it as the system. If
// the product later wants scheduled closing to be a separate capability, that is
// a settings question — `SETUP`/`Teardown`/an audit entry — not a change here.
// ============================================

import { DatabaseError } from '../../errors/database.error'
import { TenancyContext } from '../tenancy.service'
import { AssetsService } from '../assets/assets.service'
import { CurrencyService } from '../currency/currency.service'
import { repostCosts } from '../inventory-costing/repost.service'
import {
  decideMonthEnd,
  monthEndsFiscalYear,
  summariseMonthEnd,
  type MonthEndPlan,
  type StepOutcome,
} from './month-end.domain'

const assetsService = new AssetsService()
const currencyService = new CurrencyService()

/** The actor recorded on entries nobody pressed a button for. See the worker. */
const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000000'

export interface MonthEndInput {
  fromDate: string
  toDate: string
  /**
   * `MM-DD` of the workspace's own year end.
   *
   * ⚠️ REQUIRED, with no default. There is no fiscal-year setting anywhere in
   * the product yet, and assuming December would close a year on the wrong day
   * for every shop whose books end in March. Until that setting exists, the
   * caller supplies it — so the decision stays visible at the call site rather
   * than being buried in a default.
   */
  fiscalYearEnd: string
  /**
   * Set false to run the steps without sealing the period. The default is NOT —
   * a month-end that does not lock is a rehearsal, so it has to be asked for.
   *
   * ⚠️ `| undefined` is required by `exactOptionalPropertyTypes`, which is on
   * across this monorepo: `lock?: boolean` rejects an explicit `undefined`.
   */
  lock?: boolean | undefined
  /**
   * Whether this period closes the fiscal year, when the caller already
   * knows. The scheduled close passes it: `monthEndsFiscalYear` compares
   * GREGORIAN months, and a shop that keeps solar Hijri months ends its year
   * with Esfand — a month that starts in February and ends in March, on a
   * day that moves. Absent, the `fiscalYearEnd` rule decides as before.
   */
  closesYear?: boolean | undefined
}

/**
 * Run the month-end package for one period.
 *
 * @param accounting the accounting service, injected so this file does not
 *   import the whole accounting core for two methods.
 */
export async function runMonthEnd(
  ctx: TenancyContext,
  input: MonthEndInput,
  accounting: {
    postYearEndClose(ctx: TenancyContext, from: string, to: string): Promise<unknown>
    setPeriodLock(ctx: TenancyContext, until: string, reason: string): Promise<unknown>
  },
): Promise<ReturnType<typeof summariseMonthEnd>> {
  const outcomes: StepOutcome[] = []

  const plan: MonthEndPlan = {
    fromDate: input.fromDate.slice(0, 10),
    toDate: input.toDate.slice(0, 10),
    closesYear:
      input.closesYear ?? monthEndsFiscalYear(input.fromDate.slice(0, 10), input.fiscalYearEnd),
  }

  // ── 1. Depreciation ───────────────────────────────────────
  // Already idempotent: `posted_at IS NULL` in the query, and the ledger's
  // `already_posted` outcome for a row claimed by an earlier run.
  outcomes.push(
    await step('depreciation', async () => {
      const result = await assetsService.postDue(ctx, plan.toDate)
      // ⚠️ A skipped row is an asset with no accounts configured. It will never
      // depreciate and nothing else will say so, so the REASON travels with the
      // count — "1 skipped" is a number, "1 skipped (ACCOUNTS_NOT_SET)" is an
      // instruction to the person who can fix it.
      const reasons = [...new Set(result.skipped.map((s) => s.reason))]
      return {
        status: result.posted.length === 0 ? ('nothing_to_do' as const) : ('ok' as const),
        detail:
          `${result.posted.length} posted, ${result.skipped.length} skipped` +
          (reasons.length > 0 ? ` (${reasons.join(', ')})` : ''),
      }
    }),
  )

  // ⚠️ CHECK AFTER EVERY STEP, NOT JUST BEFORE THE LOCK.
  //
  // The first version ran all three and then checked once. That is the same run,
  // just with the ordering wrong: depreciation posts entries, then revaluation
  // fails, then the repost rewrites the costs depreciation just measured — and
  // the person sees a run that "did two things and locked nothing" instead of a
  // run that "stopped at revaluation and said why". The second is a diagnosis;
  // the first is noise with real postings in it.
  const afterDepreciation = decideMonthEnd(plan, outcomes)
  if (afterDepreciation.violations.length > 0) {
    return summariseMonthEnd(plan, outcomes)
  }

  // ── 2. FX revaluation ──────────────────────────────────────
  // Upserts on (workspace_id, as_of), so a re-run of the same month replaces the
  // same row rather than accumulating. And it reverses the previous run, so
  // running it twice cannot double-book the difference.
  outcomes.push(
    await step('fx_revaluation', async () => {
      const result = await currencyService.revalue(ctx, { asOf: plan.toDate })
      return {
        status: result.lines.length === 0 ? ('nothing_to_do' as const) : ('ok' as const),
        detail: `${result.lines.length} balances, net ${result.netDifferenceMinor}`,
      }
    }),
  )

  const afterRevaluation = decideMonthEnd(plan, outcomes)
  if (afterRevaluation.violations.length > 0) {
    return summariseMonthEnd(plan, outcomes)
  }

  // ── 3. Cost repost ─────────────────────────────────────────
  // Re-prices the sales affected by a layer that was corrected since the period
  // opened, and posts the DIFFERENCE as its own entry. Idempotent: `planRepost`
  // emits nothing when the recomputation agrees, so re-running the same window
  // posts nothing rather than a second copy.
  outcomes.push(
    await step('cost_repost', async () => {
      const result = await repostCosts(ctx, plan.fromDate)
      return {
        status: result.examined === 0 ? ('nothing_to_do' as const) : ('ok' as const),
        detail: `${result.posted}/${result.examined} documents re-posted, net ${result.netPostedMinor}`,
      }
    }),
  )

  // ── 4. Year end ────────────────────────────────────────────
  const beforeYearEnd = decideMonthEnd(plan, outcomes)
  if (beforeYearEnd.violations.length > 0) {
    return summariseMonthEnd(plan, outcomes)
  }

  if (plan.closesYear) {
    outcomes.push(
      await step('year_end_close', async () => {
        await accounting.postYearEndClose(ctx, plan.fromDate, plan.toDate)
        return { status: 'ok' as const, detail: 'year closed' }
      }),
    )
  } else {
    outcomes.push({ step: 'year_end_close', status: 'nothing_to_do' })
  }

  const beforeLock = decideMonthEnd(plan, outcomes)
  if (beforeLock.violations.length > 0) {
    return summariseMonthEnd(plan, outcomes)
  }

  if (input.lock === false) {
    outcomes.push({ step: 'period_lock', status: 'nothing_to_do' })
    return summariseMonthEnd(plan, outcomes)
  }

  outcomes.push(
    await step('period_lock', async () => {
      await accounting.setPeriodLock(ctx, plan.toDate, `month-end ${plan.fromDate}…${plan.toDate}`)
      return { status: 'ok' as const, detail: `locked to ${plan.toDate}` }
    }),
  )

  return summariseMonthEnd(plan, outcomes)
}

/**
 * Run one step and turn a throw into a reported failure.
 *
 * ⚠️ A step that throws must NOT stop the loop by escaping — the whole point is
 * that the run continues to the next step and the person sees everything that
 * happened, not just the first thing that went wrong. `decideMonthEnd` then
 * refuses to let anything after a failure reach the lock.
 */
async function step(
  name: StepOutcome['step'],
  run: () => Promise<{ status: 'ok' | 'nothing_to_do'; detail?: string }>,
): Promise<StepOutcome> {
  try {
    return { step: name, ...(await run()) }
  } catch (err) {
    if (err instanceof DatabaseError) {
      return { step: name, status: 'failed', reason: err.message }
    }
    return {
      step: name,
      status: 'failed',
      reason: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * The context a scheduled month-end runs under.
 *
 * ⚠️ Exported so the caller states the role ONCE, visibly, rather than each
 * call site inventing it. See the note about `owner` in the file header.
 */
export function monthEndContext(workspaceId: string): TenancyContext {
  return { workspaceId, userId: SYSTEM_ACTOR, role: 'owner' } as unknown as TenancyContext
}
