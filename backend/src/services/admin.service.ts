// ============================================
// backend/src/services/admin.service.ts — v2.0 (Admin Panel phase)
//
// Platform-admin operational data access. Every method here sits BEHIND
// [authenticate, platformAdminGuard] in admin.routes.ts — the guard is the
// authorization boundary; this file assumes an authenticated allowlisted
// caller and never re-checks it (the two-domain split with workspace tenancy
// is deliberate and pinned by platform-admin-isolation.test.ts).
//
// Scoping rules (Phase-4 architecture, DECISION A):
//   - Workspace-owned data (members, subscription, invoices, transactions,
//     usage) is keyed by WORKSPACE_ID.
//   - User data (search, detail, memberships) is keyed by USER_ID as
//     RELATIONSHIP data only — user_id is never a billing tenancy boundary.
//   - Mutations land ONLY on subscriptions, addressed by PRIMARY KEY, with
//     enum-validated inputs, and always write an audit_logs record carrying
//     actor, target, before/after snapshots and timestamp. Invoices,
//     transactions and webhook payloads are READ-ONLY here — there is no
//     approved immutable/audit pattern for editing financial records.
//
// Reads are projected, never SELECT *: workspaces carry inline image data
// URIs in logo/stamp columns (up to 10MB) and webhook_events.payload holds
// raw Stripe objects — neither belongs in a listing response.
// ============================================

import { supabase } from '../db'
import { AuditService } from './audit.service'
import { BillingService, PLANS } from './billing.service'
import { Plan, SubscriptionStatus, planEnum, subscriptionStatusEnum } from '@hisabche/validation'
import { DatabaseError, NotFoundError } from '../errors/database.error'

// ─── Column projections ──────────────────────────────────────
// Deliberate exclusions: workspaces.logo_url / stamp_url (multi-MB data URIs),
// webhook_events.payload (raw Stripe PII), subscriptions.* secrets are limited
// to the two Stripe identifiers the spec explicitly requires admins to see.

const WORKSPACE_COLUMNS = 'id, name, slug, description, owner_id, is_active, created_at, updated_at'
const MEMBER_COLUMNS = 'workspace_id, user_id, role, has_access, suspended_at, joined_at'
const USER_COLUMNS = 'id, email, full_name, preferred_language'
const SUBSCRIPTION_COLUMNS =
  'id, user_id, workspace_id, plan, status, is_trial, trial_used, ' +
  'trial_started_at, trial_ends_at, period_start, period_end, ' +
  'cancel_at_period_end, stripe_customer_id, stripe_subscription_id, ' +
  'created_at, updated_at'
const INVOICE_COLUMNS =
  'id, workspace_id, user_id, invoice_number, type, total, currency, status, created_at'
const TRANSACTION_COLUMNS = 'id, workspace_id, user_id, amount, type, created_at'
const WEBHOOK_EVENT_COLUMNS = 'id, type, processed_at'

/** Hard ceiling shared by every listing route. */
export const ADMIN_MAX_PAGE_SIZE = 100

/**
 * `| undefined` is explicit because this repo runs with
 * `exactOptionalPropertyTypes: true`, where `limit?: number` means "may be
 * absent, but never the value undefined". Zod's `.optional()` produces exactly
 * that value, so the route could not pass its own parsed query through.
 *
 * Widening here rather than loosening tsconfig: `clampPage` below already
 * handles undefined with `?? 50`, so this makes the type honest about the
 * values the function has always accepted.
 */
interface PageOpts {
  limit?: number | undefined
  offset?: number | undefined
}

function clampPage(opts: PageOpts): { limit: number; offset: number } {
  const limit = Math.min(Math.max(Math.floor(opts.limit ?? 50), 1), ADMIN_MAX_PAGE_SIZE)
  const offset = Math.max(Math.floor(opts.offset ?? 0), 0)
  return { limit, offset }
}

/** What an admin mutation must record about its actor and context. */
export interface AdminActorContext {
  /** The authenticated platform admin (audit `user_id`). */
  adminUserId: string
  ipAddress?: string | null
  userAgent?: string | null
  /** Business justification — stored inside the audit record's new_data. */
  reason?: string | undefined
}

interface SubscriptionRow {
  id: string
  user_id: string | null
  workspace_id: string | null
  plan: string
  status: string
  is_trial: boolean | null
  period_end: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  [key: string]: unknown
}

const AUDITED_FIELDS = [
  'plan',
  'status',
  'is_trial',
  'period_end',
  'cancel_at_period_end',
  'stripe_customer_id',
  'stripe_subscription_id',
] as const

function snapshot(row: SubscriptionRow): Record<string, unknown> {
  const snap: Record<string, unknown> = {}
  for (const field of AUDITED_FIELDS) snap[field] = row[field] ?? null
  return snap
}

export class AdminService {
  private auditService = new AuditService()
  private billingService = new BillingService()

  async getStatus() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '3.0',
    }
  }

  /**
   * Platform KPIs.
   *
   * Every field names the query that produces it. Nothing is estimated and
   * nothing is hardcoded — the previous version returned `activeUsers: 1`
   * with the comment "Minimum current platform admin session", which is not a
   * measurement of anything.
   *
   * ⚠️ DELIBERATELY ABSENT: MRR, ARR, monthly revenue, revenue charts.
   *
   * There is no authoritative pricing source in this database. `PLANS` carries
   * name/limits/featureKeys and NO price; `checkout_sessions` carries no amount
   * and no currency. Any revenue figure here would be invented — and an
   * invented revenue number on the control panel of a financial SaaS is worse
   * than an absent one. When a real billing ledger exists, add it here; never
   * infer it from plan names.
   *
   * Performance: every count is `head: true` with `count: 'exact'`, so
   * PostgREST returns a count and zero rows. Nothing is loaded into memory and
   * there is no per-workspace query — a fixed number of round-trips however
   * many workspaces exist.
   */
  async getMetrics() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

    /** Count only, never rows. Returns 0 rather than throwing on a missing table. */
    const countOf = async (table: string, build: (q: any) => any = (q) => q): Promise<number> => {
      try {
        const { count, error } = await build(
          supabase.from(table).select('id', { count: 'exact', head: true }),
        )
        return error ? 0 : (count ?? 0)
      } catch {
        return 0
      }
    }

    const [
      totalWorkspaces,
      activeWorkspaces,
      newWorkspacesToday,
      newWorkspacesThisMonth,
      totalMembers,
      subscriptionsTotal,
      activeSubscriptions,
      expiredSubscriptions,
      expiringInSevenDays,
      trialSubscriptions,
      subscriptionsWithWorkspace,
    ] = await Promise.all([
      countOf('workspaces'),
      countOf('workspaces', (q) => q.eq('is_active', true)),
      countOf('workspaces', (q) => q.gte('created_at', startOfToday)),
      countOf('workspaces', (q) => q.gte('created_at', startOfMonth)),

      // Active seats, not raw rows: a suspended or access-revoked member is not
      // a member for any purpose that matters.
      countOf('workspace_members', (q) => q.eq('has_access', true).is('suspended_at', null)),

      countOf('subscriptions'),
      countOf('subscriptions', (q) => q.eq('status', 'active')),
      countOf('subscriptions', (q) => q.lt('period_end', now.toISOString())),
      countOf('subscriptions', (q) =>
        q.gte('period_end', now.toISOString()).lte('period_end', inSevenDays),
      ),
      countOf('subscriptions', (q) => q.eq('is_trial', true)),
      countOf('subscriptions', (q) => q.not('workspace_id', 'is', null)),
    ])

    // Plan mix, read from the real `plan` column. Keys come from PLANS, so a
    // plan added there appears here without touching this file.
    const planKeys = Object.keys(PLANS)
    const planCounts = await Promise.all(
      planKeys.map((plan) => countOf('subscriptions', (q) => q.eq('plan', plan))),
    )
    const byPlan: Record<string, number> = {}
    planKeys.forEach((plan, i) => {
      byPlan[plan] = planCounts[i] ?? 0
    })

    return {
      workspaces: {
        total: totalWorkspaces,
        active: activeWorkspaces,
        newToday: newWorkspacesToday,
        newThisMonth: newWorkspacesThisMonth,
      },
      members: { total: totalMembers },
      subscriptions: {
        total: subscriptionsTotal,
        active: activeSubscriptions,
        expired: expiredSubscriptions,
        expiringInSevenDays,
        trial: trialSubscriptions,
        byPlan,
        /**
         * Migration progress: 100 once every subscription carries a
         * workspace_id. Below 100 while
         * docs/subscription-workspace-migration.sql is mid-flight, and the UI
         * must be able to say so rather than quietly showing a plan mix that
         * does not cover every business.
         */
        workspaceAttributedPercent:
          subscriptionsTotal === 0
            ? 100
            : Math.round((subscriptionsWithWorkspace / subscriptionsTotal) * 100),
      },
      generatedAt: now.toISOString(),
    }
  }

  async getUsers(limit = 50, offset = 0) {
    // Auth-admin directory listing. Unlike before, a failure is PROPAGATED:
    // swallowing it made an outage indistinguishable from "this platform has
    // no users", which on an admin console is a lie that invites wrong
    // decisions. Fail closed, loudly.
    const page = Math.max(1, Math.floor(offset / Math.max(1, limit)) + 1)
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: limit,
    })
    if (error) throw new DatabaseError('Failed to list auth users', error)

    return {
      users: data.users.map((u) => ({
        id: u.id,
        email: u.email,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
        emailConfirmed: Boolean(u.email_confirmed_at),
      })),
      total: data.users.length,
    }
  }

  // ─── Workspaces ──────────────────────────────────────────────

  async listWorkspaces(opts: PageOpts & { search?: string | undefined }) {
    const { limit, offset } = clampPage(opts)

    let query = supabase.from('workspaces').select(WORKSPACE_COLUMNS, { count: 'exact' })

    const search = opts.search?.trim()
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new DatabaseError('Failed to list workspaces', error)

    return { workspaces: data ?? [], total: count ?? 0, limit, offset }
  }

  /** Workspace-scoped detail: row, members, subscription, usage. */
  async getWorkspaceDetail(workspaceId: string) {
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .select(WORKSPACE_COLUMNS)
      .eq('id', workspaceId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch workspace', error)
    if (!workspace) throw new NotFoundError('Workspace')

    const [{ data: members }, { data: subscription }, invoicesCount, transactionsCount] =
      await Promise.all([
        supabase.from('workspace_members').select(MEMBER_COLUMNS).eq('workspace_id', workspaceId),
        supabase
          .from('subscriptions')
          .select(SUBSCRIPTION_COLUMNS)
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        this.countInWorkspace('invoices', workspaceId),
        this.countInWorkspace('transactions', workspaceId),
      ])

    // Limits are shown only for a RECOGNIZED plan — a legacy/garbage value
    // must not crash the detail view.
    //
    // The cast is needed because the column list is built from a runtime
    // string constant, so Supabase cannot infer a row type and widens the
    // result to include its error shape. `safeParse` below is the real guard:
    // whatever `plan` actually holds, an unrecognised value yields no limits
    // rather than an exception.
    const subscriptionRow = subscription as { plan?: unknown } | null
    const parsedPlan = subscriptionRow?.plan ? planEnum.safeParse(subscriptionRow.plan) : null
    const planLimits = parsedPlan?.success
      ? this.billingService.getPlanFeatures(parsedPlan.data).limits
      : null

    return {
      workspace,
      members: members ?? [],
      subscription: subscription ?? null,
      usage: {
        invoices: invoicesCount,
        transactions: transactionsCount,
        members: members?.length ?? 0,
      },
      limits: planLimits,
    }
  }

  private async countInWorkspace(table: string, workspaceId: string): Promise<number> {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'estimated', head: true })
      .eq('workspace_id', workspaceId)

    if (error) throw new DatabaseError(`Failed to count ${table}`, error)
    return count ?? 0
  }

  // ─── Users (relationship views — NOT a tenancy boundary) ────

  async searchUsers(opts: PageOpts & { search?: string | undefined }) {
    const { limit, offset } = clampPage(opts)

    let query = supabase.from('users').select(USER_COLUMNS, { count: 'exact' })

    const search = opts.search?.trim()
    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
    }

    const { data, error, count } = await query
      .order('email', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) throw new DatabaseError('Failed to search users', error)

    return { users: data ?? [], total: count ?? 0, limit, offset }
  }

  /** A user's profile, workspace memberships and ownership footprint. */
  async getUserDetail(userId: string) {
    const { data: user, error } = await supabase
      .from('users')
      .select(USER_COLUMNS)
      .eq('id', userId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch user', error)
    if (!user) throw new NotFoundError('User')

    const { data: memberships, error: memberError } = await supabase
      .from('workspace_members')
      .select(MEMBER_COLUMNS)
      .eq('user_id', userId)

    if (memberError) throw new DatabaseError('Failed to fetch memberships', memberError)

    // Workspace NAMES for the membership rows — relationship display data,
    // fetched separately so no embedded-select dependency is introduced.
    const workspaceIds = [...new Set((memberships ?? []).map((m) => m.workspace_id))]
    let workspaceNames: Record<string, string> = {}
    if (workspaceIds.length > 0) {
      const { data: wsRows, error: wsError } = await supabase
        .from('workspaces')
        .select('id, name')
        .in('id', workspaceIds)

      if (wsError) throw new DatabaseError('Failed to fetch workspace names', wsError)
      workspaceNames = Object.fromEntries((wsRows ?? []).map((w) => [w.id, w.name]))
    }

    return {
      user,
      memberships: (memberships ?? []).map((m) => ({
        ...m,
        workspaceName: workspaceNames[m.workspace_id] ?? null,
      })),
      // Ownership is counted separately from membership — being a seller in
      // someone else's shop is not running one.
      ownedWorkspaceCount: await this.countOwnedWorkspaces(userId),
    }
  }

  private async countOwnedWorkspaces(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('workspaces')
      .select('id', { count: 'estimated', head: true })
      .eq('owner_id', userId)

    if (error) throw new DatabaseError('Failed to count owned workspaces', error)
    return count ?? 0
  }

  // ─── Subscriptions ───────────────────────────────────────────

  async listSubscriptions(
    opts: PageOpts & { plan?: Plan | undefined; status?: SubscriptionStatus | undefined },
  ) {
    const { limit, offset } = clampPage(opts)

    let query = supabase.from('subscriptions').select(SUBSCRIPTION_COLUMNS, { count: 'exact' })

    if (opts.plan) query = query.eq('plan', opts.plan)
    if (opts.status) query = query.eq('status', opts.status)

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new DatabaseError('Failed to list subscriptions', error)

    return { subscriptions: data ?? [], total: count ?? 0, limit, offset }
  }

  async getSubscriptionDetail(subscriptionId: string) {
    const row = await this.fetchSubscriptionRow(subscriptionId)
    if (!row) throw new NotFoundError('Subscription')

    // History comes from the SAME audit trail our mutations write — one
    // timeline for webhook-driven and admin-driven changes alike.
    const history = await this.auditService.getEntityHistory('subscription', subscriptionId)

    return { subscription: row, history }
  }

  /** Failed-payment queue: subscriptions sitting in past_due. */
  async listPastDueSubscriptions(limit = 50) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(SUBSCRIPTION_COLUMNS)
      .eq('status', 'past_due')
      .order('updated_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), ADMIN_MAX_PAGE_SIZE))

    if (error) throw new DatabaseError('Failed to list past-due subscriptions', error)
    return { subscriptions: data ?? [] }
  }

  /**
   * MANUAL PLAN CHANGE — governed.
   *
   * Addressed by subscription PK, plan validated against the product enum,
   * before/after audited with the acting admin as `user_id`. Cache flushing
   * for BOTH key spellings (`subscription:<uid>` and `subscription:ws:<wsid>`)
   * happens inside BillingService.upgradeSubscriptionRow — the Phase-4 rule.
   */
  async updateSubscriptionPlan(
    actor: AdminActorContext,
    subscriptionId: string,
    plan: Plan,
  ): Promise<Record<string, unknown>> {
    const parsed = planEnum.safeParse(plan)
    if (!parsed.success) {
      throw new DatabaseError(`Invalid plan "${String(plan)}" — refused, nothing was changed`)
    }
    return this.auditedSubscriptionUpdate(actor, subscriptionId, (row) =>
      this.billingService.upgradeSubscriptionRow(row.id, parsed.data, 'month'),
    )
  }

  /** MANUAL STATUS CHANGE — governed the same way as the plan change. */
  async updateSubscriptionStatus(
    actor: AdminActorContext,
    subscriptionId: string,
    status: SubscriptionStatus,
  ): Promise<Record<string, unknown>> {
    const parsed = subscriptionStatusEnum.safeParse(status)
    if (!parsed.success) {
      throw new DatabaseError(`Invalid status "${String(status)}" — refused, nothing was changed`)
    }
    return this.auditedSubscriptionUpdate(actor, subscriptionId, (row) =>
      this.billingService.setSubscriptionRowStatus(row.id, parsed.data),
    )
  }

  /**
   * Shared mutation spine: read BEFORE → mutate by PK → read AFTER → audit.
   * The audit row is written even if only to record an identical-value change;
   * a manual action with no trace is treated as never having happened, which
   * is worse than a no-op entry.
   */
  private async auditedSubscriptionUpdate(
    actor: AdminActorContext,
    subscriptionId: string,
    mutate: (row: SubscriptionRow) => Promise<unknown>,
  ): Promise<Record<string, unknown>> {
    const before = await this.fetchSubscriptionRow(subscriptionId)
    if (!before) throw new NotFoundError('Subscription')

    await mutate(before)

    // Re-read so new_data reflects the ROW, not the intention.
    const after = await this.fetchSubscriptionRow(subscriptionId)
    if (!after) throw new DatabaseError('Subscription disappeared during update')

    await this.auditService.log({
      userId: actor.adminUserId,
      action: 'update',
      entityType: 'subscription',
      entityId: subscriptionId,
      oldData: snapshot(before),
      newData: {
        ...snapshot(after),
        ...(actor.reason !== undefined && { reason: actor.reason }),
      },
      // `undefined`, not `null`: CreateAuditLog marks these optional, and
      // audit.service.log() already coalesces to NULL on the way into the
      // column (`data.ipAddress || null`). Passing null here only fights the
      // schema without changing what is stored.
      ipAddress: actor.ipAddress ?? undefined,
      userAgent: actor.userAgent ?? undefined,
    })

    return { subscription: after, previous: snapshot(before) }
  }

  private async fetchSubscriptionRow(id: string): Promise<SubscriptionRow | null> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(SUBSCRIPTION_COLUMNS)
      .eq('id', id)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch subscription', error)
    // Via `unknown`: the column list is a runtime string, so Supabase widens
    // the result to include its error shape and refuses a direct cast. The
    // `error` check above is what actually establishes this is a row.
    return (data as unknown as SubscriptionRow) ?? null
  }

  // ─── Billing visibility (read-only) ──────────────────────────

  async listWorkspaceInvoices(workspaceId: string, opts: PageOpts) {
    const { limit, offset } = clampPage(opts)

    const { data, error, count } = await supabase
      .from('invoices')
      .select(INVOICE_COLUMNS, { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new DatabaseError('Failed to list workspace invoices', error)
    return { invoices: data ?? [], total: count ?? 0, limit, offset }
  }

  async listWorkspaceTransactions(workspaceId: string, opts: PageOpts) {
    const { limit, offset } = clampPage(opts)

    const { data, error, count } = await supabase
      .from('transactions')
      .select(TRANSACTION_COLUMNS, { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new DatabaseError('Failed to list workspace transactions', error)
    return { transactions: data ?? [], total: count ?? 0, limit, offset }
  }

  /** Projected — NEVER exposes webhook_events.payload (raw Stripe objects). */
  async listWebhookEvents(opts: PageOpts) {
    const { limit, offset } = clampPage(opts)

    const { data, error, count } = await supabase
      .from('webhook_events')
      .select(WEBHOOK_EVENT_COLUMNS, { count: 'exact' })
      .order('processed_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new DatabaseError('Failed to list webhook events', error)
    return { events: data ?? [], total: count ?? 0, limit, offset }
  }

  async getAuditLogs(limit = 50, offset = 0) {
    const { limit: l, offset: o } = clampPage({ limit, offset })
    const { data, error, count } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(o, o + l - 1)

    if (error) {
      // Unmigrated table — an admin console shows its own audit trail or it
      // shows nothing; silently pretending success helps nobody.
      throw new DatabaseError('Failed to list audit logs', error)
    }

    return { logs: data ?? [], total: count ?? 0 }
  }
}

export default AdminService
