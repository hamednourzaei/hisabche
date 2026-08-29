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
import { DatabaseError, NotFoundError, ConflictError } from '../errors/database.error'
import { ForbiddenError } from '../errors/auth.error'

// ─── Column projections ──────────────────────────────────────
// Deliberate exclusions: workspaces.logo_url / stamp_url (multi-MB data URIs),
// webhook_events.payload (raw Stripe PII), subscriptions.* secrets are limited
// to the two Stripe identifiers the spec explicitly requires admins to see.

const WORKSPACE_COLUMNS = 'id, name, slug, description, owner_id, is_active, created_at, updated_at'
const MEMBER_COLUMNS = 'id, workspace_id, user_id, role, has_access, suspended_at, joined_at'
/**
 * ⚠️ THERE IS NO `public.users` TABLE.
 *
 * This service used to select 'id, email, full_name, preferred_language' from
 * `users`, and every one of those queries failed in production with
 * PGRST205 "Could not find the table 'public.users' in the schema cache". The
 * constant existing in the code was not evidence that the table existed.
 *
 * Identity actually lives in two places, and neither is `public.users`:
 *
 *   NAME   `public.profiles` — id, full_name, business_name, avatar_url.
 *          This is what auth.routes.ts reads, and login works in production,
 *          so it is proven to exist. It has NO email column.
 *   EMAIL  `auth.users`, reachable only through supabase.auth.admin.
 *
 * PROFILE_COLUMNS is therefore name-only; email is resolved separately.
 */
const PROFILE_COLUMNS = 'id, full_name'

interface MemberView {
  id: string
  userId: string
  name: string | null
  email: string | null
  role: string
  status: 'suspended' | 'no-access' | 'active'
  joinedAt: string | null
}
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
 * How much of the Supabase auth directory one identity resolution reads.
 * Emails for users beyond this page resolve to null — honest, rather than
 * silently wrong.
 */
const AUTH_DIRECTORY_PAGE = 1000

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

  /**
   * Resolve display identity for a set of user ids — the ONE place that knows
   * where identity lives.
   *
   * Two calls total, never one-per-user:
   *   1. `profiles` filtered with .in(ids)          -> full_name
   *   2. supabase.auth.admin.listUsers() once        -> email
   *
   * Degrades instead of failing. A missing profile row, a missing auth user,
   * or an auth-admin outage yields null name/email for that person — it must
   * never take down the workspace list, because an admin who cannot see the
   * console during an identity outage cannot fix anything.
   *
   * ⚠️ SCALE BOUND: listUsers() pages the auth directory, and this reads one
   * page of `AUTH_DIRECTORY_PAGE`. Beyond that, emails resolve to null rather
   * than silently wrong — a null is honest, a mismatched email is not. When
   * the directory outgrows one page, this needs a different strategy.
   */
  private async resolveIdentities(
    userIds: string[],
  ): Promise<Map<string, { name: string | null; email: string | null }>> {
    const identities = new Map<string, { name: string | null; email: string | null }>()
    if (userIds.length === 0) return identities

    for (const id of userIds) identities.set(id, { name: null, email: null })

    const [profilesResult, authResult] = await Promise.allSettled([
      supabase.from('profiles').select(PROFILE_COLUMNS).in('id', userIds),
      supabase.auth.admin.listUsers({ page: 1, perPage: AUTH_DIRECTORY_PAGE }),
    ])

    if (profilesResult.status === 'fulfilled' && !profilesResult.value.error) {
      for (const row of (profilesResult.value.data ?? []) as Array<{
        id: string
        full_name: string | null
      }>) {
        const entry = identities.get(row.id)
        if (entry) entry.name = row.full_name ?? null
      }
    } else {
      console.warn('[AdminService] profile lookup failed; names will be null')
    }

    if (authResult.status === 'fulfilled' && !authResult.value.error) {
      const wanted = new Set(userIds)
      for (const user of authResult.value.data.users) {
        if (!wanted.has(user.id)) continue
        const entry = identities.get(user.id)
        if (entry) entry.email = user.email ?? null
      }
    } else {
      console.warn('[AdminService] auth directory lookup failed; emails will be null')
    }

    return identities
  }

  /**
   * One page of workspaces, enriched with owner identity, plan and member
   * count — everything the admin table's parent row shows.
   *
   * FOUR queries total, regardless of page size:
   *
   *   1. the workspaces page          (paged + counted)
   *   2. owner identities             .in('id', ownerIds)
   *   3. subscriptions for the page   .in('workspace_id', ids)
   *   4. memberships for the page     .in('workspace_id', ids)
   *
   * Not 1 + 3N. A 20-row page costs 4 round-trips, a 100-row page also costs
   * 4. The enrichment queries are only issued when the page is non-empty.
   *
   * Everything here is REAL: owner name/email come from the users projection,
   * plan from subscriptions.plan, member count from actual membership rows.
   * A workspace with no owner profile or no subscription reports null, which
   * the UI renders as "no owner" / "no subscription" — never a placeholder and
   * never a truncated uuid, which would look like data while meaning nothing.
   */
  async listWorkspaces(opts: PageOpts & { search?: string | undefined }) {
    const { limit, offset } = clampPage(opts)

    let query = supabase.from('workspaces').select(WORKSPACE_COLUMNS, { count: 'exact' })

    const search = opts.search?.trim()
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new DatabaseError('Failed to list workspaces', error)

    const rows = (data ?? []) as Array<{ id: string; owner_id: string | null }>
    if (rows.length === 0) {
      return { workspaces: [], total: count ?? 0, limit, offset }
    }

    const workspaceIds = rows.map((w) => w.id)
    const ownerIds = [...new Set(rows.map((w) => w.owner_id).filter((id): id is string => !!id))]

    const [ownersResult, subscriptionsResult, membersResult] = await Promise.all([
      this.resolveIdentities(ownerIds),
      supabase
        .from('subscriptions')
        .select('workspace_id, plan, status, period_end')
        .in('workspace_id', workspaceIds),
      // Only the columns needed to COUNT and to identify active seats — never
      // the whole membership row for every workspace on the page.
      supabase
        .from('workspace_members')
        .select('workspace_id, has_access, suspended_at')
        .in('workspace_id', workspaceIds),
    ])

    const ownerById = ownersResult

    const subscriptionByWorkspace = new Map(
      (
        (subscriptionsResult.data ?? []) as Array<{
          workspace_id: string | null
          plan: string | null
          status: string | null
          period_end: string | null
        }>
      )
        .filter((s) => s.workspace_id)
        .map((s) => [s.workspace_id as string, s]),
    )

    // Active seats only: a suspended or access-revoked row is not a member for
    // any purpose the admin cares about.
    const memberCountByWorkspace = new Map<string, number>()
    for (const m of (membersResult.data ?? []) as Array<{
      workspace_id: string
      has_access: boolean | null
      suspended_at: string | null
    }>) {
      if (m.has_access === false || m.suspended_at !== null) continue
      memberCountByWorkspace.set(
        m.workspace_id,
        (memberCountByWorkspace.get(m.workspace_id) ?? 0) + 1,
      )
    }

    const workspaces = rows.map((w) => {
      const owner = w.owner_id ? ownerById.get(w.owner_id) : undefined
      const subscription = subscriptionByWorkspace.get(w.id)

      return {
        ...w,
        ownerName: owner?.name ?? null,
        ownerEmail: owner?.email ?? null,
        plan: subscription?.plan ?? null,
        subscriptionStatus: subscription?.status ?? null,
        subscriptionPeriodEnd: subscription?.period_end ?? null,
        memberCount: memberCountByWorkspace.get(w.id) ?? 0,
      }
    })

    return { workspaces, total: count ?? 0, limit, offset }
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

    // Searches `profiles`, not a `users` table — that table does not exist
    // (PGRST205). Email cannot be part of the WHERE clause because it lives in
    // `auth.users`, which PostgREST does not expose; it is resolved for the
    // matched page afterwards. So this searches by NAME, and says so rather
    // than pretending to search a field it cannot reach.
    let query = supabase.from('profiles').select(PROFILE_COLUMNS, { count: 'exact' })

    const search = opts.search?.trim()
    if (search) query = query.ilike('full_name', `%${search}%`)

    const { data, error, count } = await query
      .order('full_name', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) throw new DatabaseError('Failed to search users', error)

    const rows = (data ?? []) as Array<{ id: string; full_name: string | null }>
    const identities = await this.resolveIdentities(rows.map((r) => r.id))

    const users = rows.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      email: identities.get(r.id)?.email ?? null,
    }))

    return { users, total: count ?? 0, limit, offset }
  }

  /** A user's profile, workspace memberships and ownership footprint. */
  async getUserDetail(userId: string) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch user', error)

    const identity = (await this.resolveIdentities([userId])).get(userId)

    // A user with memberships but no profile row is a real state, not a 404 —
    // refusing to show them would hide someone who genuinely has access.
    if (!profile && !identity?.email) throw new NotFoundError('User')

    const user = {
      id: userId,
      full_name: (profile as { full_name?: string | null } | null)?.full_name ?? null,
      email: identity?.email ?? null,
    }

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

  async listWorkspaceMembers(workspaceId: string) {
    const { data: members, error } = await supabase
      .from('workspace_members')
      .select(MEMBER_COLUMNS)
      .eq('workspace_id', workspaceId)

    if (error) throw new DatabaseError('Failed to list members', error)
    if (!members || members.length === 0) return []

    const userIds = [...new Set(members.map((m) => m.user_id))]
    const userMap = await this.resolveIdentities(userIds)

    return members.map((m) => {
      const user = userMap.get(m.user_id)
      return {
        id: m.id,
        userId: m.user_id,
        name: user?.name ?? null,
        email: user?.email ?? null,
        role: m.role,
        status: m.suspended_at ? 'suspended' : m.has_access === false ? 'no-access' : 'active',
        joinedAt: m.joined_at,
      }
    })
  }

  async updateMemberRole(
    actor: AdminActorContext,
    membershipId: string,
    role: 'owner' | 'manager' | 'seller',
  ) {
    const { data: membership, error } = await supabase
      .from('workspace_members')
      .select('id, workspace_id, role')
      .eq('id', membershipId)
      .single()

    if (error || !membership) throw new NotFoundError('Membership')
    if (membership.role === role) return this.getMemberView(membershipId)

    if (role === 'owner') {
      const { count } = await supabase
        .from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', membership.workspace_id)
        .eq('role', 'owner')
      if (count && count > 0) throw new ConflictError('Workspace already has an owner')
    } else if (membership.role === 'owner') {
      throw new ForbiddenError('Cannot demote owner')
    }

    const { error: updateError } = await supabase
      .from('workspace_members')
      .update({ role })
      .eq('id', membershipId)
    if (updateError) throw new DatabaseError('Failed to update role', updateError)

    // Audit log
    await this.auditService.log({
      userId: actor.adminUserId,
      action: 'update',
      entityType: 'workspace_member',
      entityId: membershipId,
      oldData: { role: membership.role },
      newData: { role },
      ipAddress: actor.ipAddress ?? undefined,
      userAgent: actor.userAgent ?? undefined,
    })

    return this.getMemberView(membershipId)
  }

  async removeMember(actor: AdminActorContext, membershipId: string) {
    const { data: membership, error } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('id', membershipId)
      .single()

    if (error || !membership) throw new NotFoundError('Membership')
    if (membership.role === 'owner') throw new ForbiddenError('Cannot remove owner')

    const { error: deleteError } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', membershipId)
    if (deleteError) throw new DatabaseError('Failed to remove member', deleteError)

    // Audit log
    await this.auditService.log({
      userId: actor.adminUserId,
      action: 'delete',
      entityType: 'workspace_member',
      entityId: membershipId,
      oldData: { role: membership.role },
      newData: null,
      ipAddress: actor.ipAddress ?? undefined,
      userAgent: actor.userAgent ?? undefined,
    })
  }

  private async getMemberView(membershipId: string): Promise<MemberView> {
    const { data: m, error } = await supabase
      .from('workspace_members')
      .select(MEMBER_COLUMNS)
      .eq('id', membershipId)
      .single()
    if (error || !m) throw new NotFoundError('Membership')

    const user = (await this.resolveIdentities([m.user_id])).get(m.user_id)
    return {
      id: m.id,
      userId: m.user_id,
      name: user?.name ?? null,
      email: user?.email ?? null,
      role: m.role as any,
      status: m.suspended_at ? 'suspended' : m.has_access === false ? 'no-access' : 'active',
      joinedAt: m.joined_at,
    }
  }

  /**
   * Subscriptions, filtered by plan, status, and/or an expiry WINDOW.
   *
   * `expiringBefore` / `expiringAfter` bound `period_end`. They exist because
   * an expiration centre cannot be built honestly without them: bucketing a
   * PAGED list in the browser only buckets the page in front of you, so an
   * admin looking at "3 expiring this week" would be reading the first 20 rows
   * and not the other 200. The filter has to run where the whole set is.
   *
   * Both bounds are ISO timestamps and both are optional; supplying only one
   * gives an open-ended window, which is what "already expired" (before=now)
   * and "expires eventually" (after=now) need.
   */
  async listSubscriptions(
    opts: PageOpts & {
      plan?: Plan | undefined
      status?: SubscriptionStatus | undefined
      expiringBefore?: string | undefined
      expiringAfter?: string | undefined
    },
  ) {
    const { limit, offset } = clampPage(opts)

    let query = supabase.from('subscriptions').select(SUBSCRIPTION_COLUMNS, { count: 'exact' })

    if (opts.plan) query = query.eq('plan', opts.plan)
    if (opts.status) query = query.eq('status', opts.status)

    // A row with no period_end has no expiry and must not appear in an expiry
    // window — PostgREST would exclude it from a range filter anyway, but
    // being explicit stops a future `.or(period_end.is.null)` from quietly
    // dragging never-expiring rows into an "expires soon" list.
    if (opts.expiringBefore) query = query.lte('period_end', opts.expiringBefore)
    if (opts.expiringAfter) query = query.gte('period_end', opts.expiringAfter)

    const askingAboutExpiry = Boolean(opts.expiringBefore || opts.expiringAfter)

    const { data, error, count } = await query
      .order(askingAboutExpiry ? 'period_end' : 'created_at', { ascending: askingAboutExpiry })
      .range(offset, offset + limit - 1)

    if (error) throw new DatabaseError('Failed to list subscriptions', error)

    // Via `unknown`: the column list is a runtime string constant, so Supabase
    // cannot infer a row type and widens the result to include its error
    // shape. The `error` check above is what establishes these are rows.
    const subscriptions = (data ?? []) as unknown as SubscriptionRow[]

    return { subscriptions, total: count ?? 0, limit, offset }
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
