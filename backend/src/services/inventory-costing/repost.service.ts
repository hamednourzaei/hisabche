// ============================================
// Capability #69, step 3 — cost repost.
//
// ⚠️ WHAT THIS DOES, AND WHY IT IS NOT A SECOND COSTING ENGINE.
//
// A backdated receipt, a landed cost, or a re-pricing makes a cost layer wrong
// AFTER it was already consumed. FIFO consumes in date order, so the sales that
// followed already drew from the wrong layers: their cost of goods sold is wrong,
// and so are the journal entries behind them.
//
// `repost.domain.ts#planRepost` already computes the answer — replay the
// consumption from the disturbance and emit the DIFFERENCE per affected
// document. This file is the missing half: it reads the cost trail, hands it to
// that function, and posts each difference as its own ledger entry.
//
// ⚠️ THE PRODUCT DECISION THE PROMPT FLAGGED, AND THE ANSWER.
//
// "When is a cost considered re-priced?" Three options were on the table:
// every month for everything, only when a user asks, or when a landed cost is
// recorded. The answer implemented here is the second and third TOGETHER, and
// the reasoning is worth stating because it is what makes this safe to run from
// the month-end package at all:
//
//   * The window is `fromDate`, supplied by the caller. The month-end package
//     passes the period start, so it re-posts what changed IN that period.
//   * A run is idempotent by construction: `planRepost` emits an adjustment only
//     when `differenceMinor !== 0`, so replaying the same window a second time
//     produces nothing — not a second entry, and not a zero entry.
//
// That last point is the whole reason the option list was a real question. A
// naive implementation that posted "whatever the recomputation says" would
// rewrite the ledger every run, because the recomputation always produces a
// number.
//
// ⚠️ A CORRECTION IS A NEW ENTRY, NEVER A REWRITE.
//
// `ledger.port`'s own comment says it: "Never rewrite a posted journal entry —
// the correction is its own entry, with its own date, pointing at what it
// corrects." `sourceType: 'cost_repost'` already exists in that union for this.
// A shop that has had its cost corrected can then see both the original and the
// correction, which is the only thing an audit can work with.
//
// ⚠️ DIRECTION IS THE TRICKY PART, AND IT IS THE THING MOST LIKELY TO BE WRONG.
//
// A cost that came out HIGHER than recorded reduces the period's profit. That is
// Cr inventory / Dr COGS. A cost that came out LOWER is Dr inventory / Cr COGS.
// Writing both as Dr expense / Cr inventory — the obvious shape — would book a
// credit note as a cost increase and quietly inflate every gross margin in the
// shop. The sign of the difference therefore decides the entry, and it is
// asserted in the tests rather than left to be read.
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import { TenancyContext } from '../tenancy.service'
import { AccountingService } from '../accounting/accounting.service'
import { planRepost, type CostedIssue, type RepostAdjustment } from './repost.domain'
import type { CostLayer } from './costing.domain'

const accounting = new AccountingService()

/** The ledger source type reserved for this. Already in `ledger.port`. */
const SOURCE_TYPE = 'cost_repost'

export interface RepostResult {
  fromDate: string
  /** Documents whose consumption was replayed, whether or not it moved. */
  examined: number
  adjustments: RepostAdjustment[]
  /** Adjustments that were actually posted. */
  posted: number
  /** The sum of what was posted, in minor units. Signed. */
  netPostedMinor: number
}

/**
 * Re-post the cost of sales affected by a re-priced layer, from `fromDate`.
 *
 * ⚠️ `fromDate` IS THE WINDOW, and the caller owns it. The month-end package
 * passes the period start. Passing a very early date is not an error — it is
 * the expensive way of saying "recompute everything", and it is bounded by the
 * cost trail's own size rather than by a limit here.
 */
export async function repostCosts(ctx: TenancyContext, fromDate: string): Promise<RepostResult> {
  const from = fromDate.slice(0, 10)

  const issues = await readCostTrail(ctx, from)
  if (issues.length === 0) {
    return { fromDate: from, examined: 0, adjustments: [], posted: 0, netPostedMinor: 0 }
  }

  const productIds = [...new Set(issues.map((issue) => issue.productId))]
  const layers: CostLayer[] = []
  for (const productId of productIds) {
    layers.push(...(await readLayers(ctx.workspaceId, productId)))
  }

  const plan = planRepost(layers, issues, from)

  const posted: RepostAdjustment[] = []
  let netPostedMinor = 0

  for (const adjustment of plan.adjustments) {
    const outcome = await postAdjustment(ctx, adjustment, from)
    // `already_posted` counts as done. The key is (sourceType, sourceId) and the
    // id here is stable per adjustment, so a re-run finds the entry it made the
    // first time rather than making a second one.
    if (outcome.status === 'posted' || outcome.status === 'already_posted') {
      posted.push(adjustment)
      netPostedMinor += adjustment.differenceMinor
    }
  }

  return {
    fromDate: from,
    examined: plan.examined,
    adjustments: plan.adjustments,
    posted: posted.length,
    netPostedMinor,
  }
}

/**
 * The lines a repost needs, read from the cost trail in the window.
 *
 * ⚠️ PAGED TO THE END, never `.limit()`-ed.
 *
 * The first version read `limit(10_000)` and `no-silent-row-cap.test.ts` caught
 * it on the first full run — PostgREST caps every response at `max-rows = 1000`
 * and truncates silently, so a shop with 2,000 sales in the window would have had
 * half of them re-priced and no error anywhere (§7٫4). A repost that examines a
 * page is worse than none: it posts corrections for some documents and quietly
 * leaves the rest wrong.
 *
 * The order is by `entry_date` because `planRepost` replays consumption in date
 * order, and a partially-read trail would replay a prefix — which is a coherent
 * but WRONG answer rather than a wrong-looking one.
 */
async function readCostTrail(ctx: TenancyContext, fromDate: string): Promise<CostedIssue[]> {
  const { data, error } = await selectAllPages((lo, hi) =>
    supabase
      .from('cost_consumptions')
      .select(
        'consumer_type, consumer_id, consumer_line, product_id, quantity, amount, entry_date, is_estimated',
      )
      .eq('workspace_id', ctx.workspaceId)
      .gte('entry_date', fromDate)
      // A sale with no source document cannot be attributed, and an adjustment with
      // nothing to point at is an adjustment nobody can audit.
      .not('consumer_id', 'is', null)
      .order('entry_date', { ascending: true })
      .order('id', { ascending: true })
      .range(lo, hi),
  )

  // ⚠️ A partial trail is NEVER handed back as data. Replaying a prefix of the
  // consumption order produces a coherent but wrong answer — every document after
  // the gap is costed against layers the missing ones never consumed.
  if (error) throw new DatabaseError('Failed to read the cost trail', error)

  return (data ?? []).map((row) => ({
    consumerType: row.consumer_type as string,
    consumerId: row.consumer_id as string,
    consumerLine: row.consumer_line ?? '',
    productId: row.product_id as string,
    quantity: Number(row.quantity) || 0,
    // ⚠️ The trail stores MAJOR units; `planRepost` compares in minor.
    recordedCostMinor: Math.round((Number(row.amount) || 0) * 100),
    entryDate: String(row.entry_date ?? '').slice(0, 10),
  }))
}

async function readLayers(workspaceId: string, productId: string): Promise<CostLayer[]> {
  // ⚠️ Paged, for the same reason the cost trail is. A product with more than
  // 1000 layers is unusual but not impossible, and a truncated layer list makes
  // the replay consume the WRONG layers — which costs real money rather than
  // merely omitting a row.
  const { data, error } = await selectAllPages((lo, hi) =>
    supabase
      .from('cost_layers')
      .select('id, product_id, warehouse_id, remaining_qty, unit_cost, entry_date, created_at')
      .eq('workspace_id', workspaceId)
      .eq('product_id', productId)
      .order('entry_date', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(lo, hi),
  )

  if (error) throw new DatabaseError('Failed to read cost layers', error)

  return (data ?? []).map((row) => ({
    id: row.id as string,
    productId: row.product_id as string,
    warehouseId: (row.warehouse_id as string | null) ?? null,
    remainingQty: Number(row.remaining_qty) || 0,
    unitCost: Number(row.unit_cost) || 0,
    entryDate: String(row.entry_date ?? '').slice(0, 10),
    createdAt: String(row.created_at ?? ''),
  }))
}

/**
 * Post one adjustment, with the direction the sign of the difference demands.
 *
 * ⚠️ The direction is the whole function. Higher actual cost ⇒ the inventory
 * asset was understated ⇒ Cr inventory, Dr COGS. Lower actual cost is the
 * mirror. A repost that always wrote Dr COGS / Cr inventory would book a
 * saving as a cost and inflate every margin in the shop.
 */
async function postAdjustment(ctx: TenancyContext, adjustment: RepostAdjustment, asOf: string) {
  const amount = Math.abs(adjustment.differenceMinor) / 100
  if (amount === 0) {
    throw new ValidationError('REPOST_ADJUSTMENT_ZERO')
  }

  const accounts = await accounting.resolveAccountsByRole(ctx, ['inventory', 'cogs'])
  const inventory = accounts.accounts.inventory
  const cogs = accounts.accounts.cogs
  if (!inventory || !cogs) {
    // Reported, not thrown away: the arithmetic is done and the answer is real,
    // it just cannot be posted by a chart of accounts that is not set up yet.
    return { status: 'skipped' as const, missing: ['inventory', 'cogs'] as const }
  }

  const costRose = adjustment.differenceMinor > 0
  return accounting.postDocument(ctx, {
    sourceType: SOURCE_TYPE,
    // ⚠️ Stable per adjustment, so a re-run replays the same idempotency key.
    sourceId: `${adjustment.consumerType}:${adjustment.consumerId}:${adjustment.consumerLine}:${adjustment.productId}`,
    date: asOf,
    description: 'اصلاح بهای تمام‌شده',
    reference: adjustment.consumerId,
    lines: costRose
      ? [
          { accountId: cogs, debit: amount, credit: 0 },
          { accountId: inventory, debit: 0, credit: amount },
        ]
      : [
          { accountId: inventory, debit: amount, credit: 0 },
          { accountId: cogs, debit: 0, credit: amount },
        ],
  })
}
