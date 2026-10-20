// ============================================
// backend/src/services/entitlement.service.ts
//
// Plan Entitlement Core.
// Answers through the shared pure resolver:
//   packages/validation/src/schemas/entitlement-resolver.ts
//
// Principles:
//   - Export of own data (canExportData, canExportPDF) is ALWAYS allowed in every state.
//   - Free plan has a lifetime cap of 50 invoices.
//   - ONLINE_* plans have daily ceilings.
// ============================================

import { supabase } from '../db'
import type { TenancyContext } from './tenancy.service'
import {
  type FeatureKey,
  type FeaturePlan,
  type PlanEdition,
  type EntitlementVerdict,
  type WorkspaceEntitlementState,
  resolveEntitlement,
} from '@hisabche/validation'
import { BillingService } from './billing.service'
import { memoryCache } from '../utils/pagination'
import { DatabaseError } from '../errors/database.error'
import { countBusinesses } from './workspace-counts'
import { effectiveLimits } from './plan-limits.service'
import { startOfLocalDayISO } from '../utils/local-day'

// ✅ Types
export interface Entitlements {
  canUseAI: boolean
  canExportPDF: boolean
  canCreateTeam: boolean
  canUseSSO: boolean
  canManageUsers: boolean
  canViewReports: boolean
  canExportData: boolean
  maxUsers: number | null
  maxWorkspaces: number | null
  maxInvoices: number | null
}

export interface FeatureFlags {
  AI: boolean
  EXPORT_PDF: boolean
  TEAM: boolean
  SSO: boolean
  MANAGE_USERS: boolean
  REPORTS: boolean
  EXPORT_DATA: boolean
}

export interface Limits {
  users: number | null
  workspaces: number | null
  invoices: number | null
}

export interface ActionResult {
  allowed: boolean
  reason?: string | null
  limit?: number | null
}

export class EntitlementError extends Error {
  constructor(
    message: string,
    public entitlement: string,
  ) {
    super(message)
    this.name = 'EntitlementError'
  }
}

export class EntitlementService {
  private billingService: BillingService

  constructor() {
    this.billingService = new BillingService()
  }

  // ─── Cache Keys ──────────────────────────────────────────────
  private getEntitlementsCacheKey(userId: string) {
    return `entitlements:${userId}`
  }

  private getFeatureFlagsCacheKey(userId: string) {
    return `feature_flags:${userId}`
  }

  private getLimitsCacheKey(userId: string) {
    return `limits:${userId}`
  }

  // ─── Get all entitlements (with cache) ──────────────────────
  async getEntitlements(userId: string): Promise<Entitlements> {
    const cacheKey = this.getEntitlementsCacheKey(userId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as Entitlements

    const subscription = await this.billingService.getCurrentSubscription(userId)
    const plan = subscription.plan as string

    let entitlements: Entitlements
    if (subscription.isTrial && plan !== 'free' && plan !== 'FREE') {
      entitlements = this.getFullEntitlements()
    } else {
      entitlements = this.getEntitlementsForPlan(plan)
    }

    await memoryCache.set(cacheKey, entitlements, 300) // 5 minutes
    return entitlements
  }

  // ─── Check a single entitlement ─────────────────────────────
  async hasEntitlement(userId: string, key: keyof Entitlements): Promise<boolean> {
    const entitlements = await this.getEntitlements(userId)
    const value = entitlements[key]

    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value === null || value > 0
    return false
  }

  // ─── Get entitlements for a specific plan ───────────────────
  private getEntitlementsForPlan(plan: string): Entitlements {
    switch (plan) {
      case 'FREE':
      case 'free':
        return {
          canUseAI: true, // Trial gets AI inside aiMonthly: 20 quota (Q4, 20 Oct 2026)
          canExportPDF: true, // Export ALWAYS allowed
          canCreateTeam: false,
          canUseSSO: false,
          canManageUsers: false,
          canViewReports: true,
          canExportData: true, // Export ALWAYS allowed (principle 6)
          maxUsers: 1,
          maxWorkspaces: 1,
          maxInvoices: 50, // 50 invoices lifetime
        }
      case 'OFFLINE':
        return {
          canUseAI: false,
          canExportPDF: true,
          canCreateTeam: false,
          canUseSSO: false,
          canManageUsers: false,
          canViewReports: true,
          canExportData: true,
          maxUsers: 1,
          maxWorkspaces: 1,
          maxInvoices: null,
        }
      case 'ONLINE_500':
      case 'ONLINE_1000':
      case 'ONLINE_1500':
      case 'pro':
        return {
          canUseAI: true,
          canExportPDF: true,
          canCreateTeam: true,
          canUseSSO: false,
          canManageUsers: true,
          canViewReports: true,
          canExportData: true,
          maxUsers: 10,
          maxWorkspaces: 5,
          maxInvoices: null,
        }
      case 'enterprise':
        return this.getFullEntitlements()
      default:
        return this.getEntitlementsForPlan('FREE')
    }
  }

  // ─── Full entitlements (Enterprise) ─────────────────────────
  private getFullEntitlements(): Entitlements {
    return {
      canUseAI: true,
      canExportPDF: true,
      canCreateTeam: true,
      canUseSSO: true,
      canManageUsers: true,
      canViewReports: true,
      canExportData: true,
      maxUsers: null,
      maxWorkspaces: null,
      maxInvoices: null,
    }
  }

  // ─── Middleware: Check entitlement ──────────────────────────
  async requireEntitlement(userId: string, key: keyof Entitlements): Promise<boolean> {
    const has = await this.hasEntitlement(userId, key)
    if (!has) {
      throw new EntitlementError(
        `Missing entitlement: ${key}. Please upgrade your plan to access this feature.`,
        key,
      )
    }
    return true
  }

  // ─── Resolver for a Workspace Feature Entitlement ──────────
  /**
   * Resolves whether a workspace is entitled to a feature, answering through
   * the pure resolver (resolveEntitlement from @hisabche/validation).
   */
  async resolveWorkspaceEntitlement(
    workspaceId: string,
    feature: FeatureKey,
    options?: { edition?: PlanEdition },
  ): Promise<EntitlementVerdict> {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status, period_end, is_trial')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const rawPlan = (sub as { plan?: string } | null)?.plan
    const rawStatus = (sub as { status?: string } | null)?.status ?? 'active'
    const periodEnd = (sub as { period_end?: string | null } | null)?.period_end

    // Normalize plan name
    let plan: FeaturePlan = 'FREE'
    if (rawPlan) {
      const up = rawPlan.toUpperCase()
      if (up === 'OFFLINE') plan = 'OFFLINE'
      else if (up === 'ONLINE_500' || up === 'PRO') plan = 'ONLINE_500'
      else if (up === 'ONLINE_1000') plan = 'ONLINE_1000'
      else if (up === 'ONLINE_1500' || up === 'ENTERPRISE') plan = 'ONLINE_1500'
      else plan = 'FREE'
    }

    const now = new Date()
    const isPeriodExpired = Boolean(periodEnd && new Date(periodEnd).getTime() < now.getTime())
    const isPastDue = rawStatus === 'past_due'
    const isStatusExpired = rawStatus === 'expired' || rawStatus === 'cancelled'

    let state: WorkspaceEntitlementState
    let usageExhausted = false

    if (plan === 'FREE') {
      // Check lifetime invoice limit (50)
      const limits = await effectiveLimits(workspaceId, 'FREE')
      const lifetimeCap = limits.invoices ?? 50
      const { count } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .neq('status', 'draft')

      const used = count ?? 0
      if (used >= lifetimeCap) {
        state = 'FREE_EXHAUSTED'
        usageExhausted = true
      } else {
        state = 'FREE'
      }
    } else if (plan === 'OFFLINE') {
      if (isPeriodExpired || isStatusExpired) {
        state = 'OFFLINE_EXPIRED'
      } else {
        state = 'OFFLINE_ACTIVE'
      }
    } else {
      // ONLINE_* plans
      if (isPastDue) {
        state = 'ONLINE_PAST_DUE'
      } else if (isPeriodExpired || isStatusExpired) {
        state = 'ONLINE_EXPIRED'
      } else {
        state = 'ONLINE_ACTIVE'
      }

      // Check daily ceiling
      const limits = await effectiveLimits(workspaceId, plan)
      if (limits.invoicesDaily !== null) {
        const { data: ws } = await supabase
          .from('workspaces')
          .select('time_zone')
          .eq('id', workspaceId)
          .maybeSingle()
        const storedTz = (ws as { time_zone?: string | null } | null)?.time_zone
        const tz = storedTz && storedTz.trim() !== '' ? storedTz.trim() : 'UTC'
        const startOfDay = startOfLocalDayISO(tz, now)

        const { count } = await supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .neq('status', 'draft')
          .gte('created_at', startOfDay)

        if ((count ?? 0) >= limits.invoicesDaily) {
          usageExhausted = true
        }
      }
    }

    const edition = options?.edition ?? (plan === 'OFFLINE' ? 'local' : 'cloud')
    return resolveEntitlement({ state, plan, edition, usageExhausted }, feature)
  }

  // ─── Get feature flags for frontend (with cache) ────────────
  async getFeatureFlags(userId: string): Promise<FeatureFlags> {
    const cacheKey = this.getFeatureFlagsCacheKey(userId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as FeatureFlags

    const entitlements = await this.getEntitlements(userId)

    const flags: FeatureFlags = {
      AI: entitlements.canUseAI,
      EXPORT_PDF: entitlements.canExportPDF,
      TEAM: entitlements.canCreateTeam,
      SSO: entitlements.canUseSSO,
      MANAGE_USERS: entitlements.canManageUsers,
      REPORTS: entitlements.canViewReports,
      EXPORT_DATA: entitlements.canExportData,
    }

    await memoryCache.set(cacheKey, flags, 300)
    return flags
  }

  // ─── Get limits for frontend (with cache) ──────────────────
  async getLimits(userId: string): Promise<Limits> {
    const cacheKey = this.getLimitsCacheKey(userId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as Limits

    const entitlements = await this.getEntitlements(userId)

    const limits: Limits = {
      users: entitlements.maxUsers,
      workspaces: entitlements.maxWorkspaces,
      invoices: entitlements.maxInvoices,
    }

    await memoryCache.set(cacheKey, limits, 300)
    return limits
  }

  // ─── Check if user can perform an action ────────────────────
  async canPerformAction(
    ctx: TenancyContext,
    action: 'create_invoice' | 'create_user' | 'create_workspace' | 'use_ai' | 'export_data',
  ): Promise<ActionResult> {
    const { workspaceId, userId } = ctx
    const entitlements = await this.getEntitlements(userId)

    switch (action) {
      case 'create_invoice': {
        const limit = entitlements.maxInvoices
        if (limit === null) return { allowed: true, reason: null }

        const { count, error } = await supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .neq('status', 'draft')

        if (error) {
          throw new DatabaseError(`Failed to count invoices for usage limit`, error)
        }

        const current = count ?? 0
        if (current >= limit) {
          return {
            allowed: false,
            reason: `You have reached the limit of ${limit} invoices. Please upgrade your plan.`,
            limit,
          }
        }
        return { allowed: true, reason: null, limit }
      }

      case 'create_user': {
        const limit = entitlements.maxUsers
        if (limit === null) return { allowed: true, reason: null }

        const { count, error } = await supabase
          .from('workspace_members')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)

        if (error) {
          throw new DatabaseError(`Failed to count workspace members for usage limit`, error)
        }

        const current = count ?? 0
        if (current >= limit) {
          return {
            allowed: false,
            reason: `You have reached the limit of ${limit} users. Please upgrade your plan.`,
            limit,
          }
        }
        return { allowed: true, reason: null, limit }
      }

      case 'create_workspace': {
        const limit = entitlements.maxWorkspaces
        if (limit === null) return { allowed: true, reason: null }

        const { count, error } = await countBusinesses((query) => query.eq('owner_id', userId))

        if (error) {
          throw new DatabaseError(`Failed to count owned workspaces for usage limit`, error)
        }

        const current = count
        if (current >= limit) {
          return {
            allowed: false,
            reason: `You have reached the limit of ${limit} workspaces. Please upgrade your plan.`,
            limit,
          }
        }
        return { allowed: true, reason: null, limit }
      }

      case 'use_ai':
        return {
          allowed: entitlements.canUseAI,
          reason: entitlements.canUseAI
            ? null
            : 'AI features are not available on your current plan.',
        }

      case 'export_data':
        return {
          allowed: true, // Export is ALWAYS allowed (principle 6)
          reason: null,
        }

      default:
        return {
          allowed: false,
          reason: `Unknown action: ${action}`,
        }
    }
  }

  // ─── Check multiple actions at once ────────────────────────
  async checkPermissions(
    ctx: TenancyContext,
    actions: Array<
      'create_invoice' | 'create_user' | 'create_workspace' | 'use_ai' | 'export_data'
    >,
  ): Promise<Record<string, ActionResult>> {
    const results: Record<string, ActionResult> = {}

    for (const action of actions) {
      results[action] = await this.canPerformAction(ctx, action)
    }

    return results
  }

  // ─── Invalidate cache ──────────────────────────────────────
  async invalidateCache(userId: string): Promise<void> {
    await memoryCache.invalidate(this.getEntitlementsCacheKey(userId))
    await memoryCache.invalidate(this.getFeatureFlagsCacheKey(userId))
    await memoryCache.invalidate(this.getLimitsCacheKey(userId))
  }
}

export default EntitlementService
