// ============================================
// backend/src/services/ai/ai-quota.service.ts
//
// T13 — how many questions an account may ask this month.
//
// ---------------------------------------------------------------------------
// ⚠️ USAGE IS COUNTED, NOT STORED
//
// The obvious design is a `used_this_month` column incremented per question.
// It is the wrong one, and this release has spent a lot of effort removing
// exactly that shape: a derived number with its own writer drifts from the
// rows it claims to summarise, and then nobody can say which is right.
// `invoices.paid_amount` was the last one — it reported eighteen million paid
// with not one payment behind it (T9).
//
// So the allowance is stored and the usage is COUNTED from `ai_query_log`,
// which already records every question with a `created_at` and is indexed on
// `(workspace_id, created_at DESC)`. A count of the rows that exist cannot
// disagree with the rows that exist.
//
// The cost is one `count` query per question. That is the right trade for a
// number that decides whether someone is cut off.
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import type { TenancyContext } from '../tenancy.service'

/** Allowance per plan when a workspace has no explicit override. */
const PLAN_ALLOWANCE: Record<string, number> = {
  free: 20,
  pro: 500,
  enterprise: 5000,
}

const DEFAULT_PLAN = 'free'

const SCHEMA_ABSENT = new Set(['42P01', 'PGRST205', '42703', 'PGRST204'])

export interface QuotaStatus {
  /** Questions allowed this calendar month. */
  limit: number
  /** Questions already asked this calendar month. */
  used: number
  remaining: number
  /** Where `limit` came from — shown to the admin, and useful in support. */
  source: 'override' | 'plan'
  /** The plan the allowance was derived from when `source` is 'plan'. */
  plan: string
}

/** First instant of the current calendar month, as an ISO timestamp. */
function monthStart(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

export class AiQuotaService {
  /**
   * Resolve the allowance and what is left of it.
   *
   * ⚠️ An explicit `monthly_limit` of 0 must win over the plan. It is a real
   * value meaning «none», and `?? PLAN` would treat it as «not set» — so an
   * admin who deliberately cut an account off would silently restore its plan
   * allowance instead.
   */
  async status(ctx: TenancyContext): Promise<QuotaStatus> {
    const [override, plan, used] = await Promise.all([
      this.overrideFor(ctx.workspaceId),
      this.planFor(ctx.workspaceId),
      this.usedThisMonth(ctx.workspaceId),
    ])

    const planLimit = PLAN_ALLOWANCE[plan] ?? PLAN_ALLOWANCE[DEFAULT_PLAN]!
    const limit = override === null ? planLimit : override

    return {
      limit,
      used,
      remaining: Math.max(0, limit - used),
      source: override === null ? 'plan' : 'override',
      plan,
    }
  }

  /** Null when the workspace has no override — NOT when the override is 0. */
  private async overrideFor(workspaceId: string): Promise<number | null> {
    const { data, error } = await supabase
      .from('ai_workspace_quota')
      .select('monthly_limit')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) return null
      throw new DatabaseError('Failed to read the AI quota', error)
    }

    const value = (data as { monthly_limit: number | null } | null)?.monthly_limit
    return value === null || value === undefined ? null : Number(value)
  }

  private async planFor(workspaceId: string): Promise<string> {
    // Mirrors `BillingService.findSubscriptionRow`: order and limit rather
    // than `maybeSingle`, because a workspace can legitimately have more than
    // one row and `maybeSingle` ERRORS on that rather than picking one — which
    // would deny the feature to exactly the longest-standing customers.
    const { data, error } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    // A workspace with no subscription row is on the free plan — the same
    // reading the billing service takes. Not an error.
    //
    // The `workspace_id` column is also absent on older databases; billing
    // tolerates that explicitly, so this does too rather than 500.
    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) return DEFAULT_PLAN
      if (/column .*workspace_id.* does not exist/i.test(error.message ?? '')) return DEFAULT_PLAN
      throw new DatabaseError('Failed to read the subscription', error)
    }
    return (data as { plan: string } | null)?.plan ?? DEFAULT_PLAN
  }

  /**
   * Questions asked this calendar month.
   *
   * Exact count, one `id` column, one row — the total comes from the
   * Content-Range header, so no question text crosses the wire.
   *
   * ⚠️ NOT `head: true`. A HEAD response has no body, so postgrest-js returns a
   * failed HEAD as `{ message: '' }` with NO `code`. `SCHEMA_ABSENT` below could
   * never match it, and GET /api/ai/quota answered 500 with an empty message
   * that said nothing about why. A GET carries PostgREST's error body, so the
   * code is real and a genuine failure is logged with its cause.
   */
  private async usedThisMonth(workspaceId: string): Promise<number> {
    const { count, error } = await supabase
      .from('ai_query_log')
      .select('id', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .gte('created_at', monthStart())
      .limit(1)

    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) return 0
      throw new DatabaseError('Failed to count AI usage', error)
    }
    return count ?? 0
  }

  /** Admin: set or clear a workspace's override. */
  async setOverride(
    actorId: string,
    workspaceId: string,
    monthlyLimit: number | null,
    note: string,
  ): Promise<void> {
    const { error } = await supabase.from('ai_workspace_quota').upsert(
      {
        workspace_id: workspaceId,
        monthly_limit: monthlyLimit,
        note,
        updated_at: new Date().toISOString(),
        updated_by: actorId,
      },
      { onConflict: 'workspace_id' },
    )

    if (error) throw new DatabaseError('Failed to save the AI quota', error)
  }
}
