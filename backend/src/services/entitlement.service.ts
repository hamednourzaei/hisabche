// ============================================
// backend/src/services/entitlement.service.ts — Optimized v2.2
// FIXED: exactOptionalPropertyTypes error
// ============================================

import { supabase } from '../db'
import { Plan } from '@hisabche/validation'
import { BillingService } from './billing.service'
import { memoryCache } from '../utils/pagination'

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

// ✅ Action Result Type — با string | null
export interface ActionResult {
  allowed: boolean
  reason?: string | null  // ✅ تغییر به string | null
  limit?: number | null
}

// ✅ Errors
export class EntitlementError extends Error {
  constructor(message: string, public entitlement: string) {
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
    const plan = subscription.plan as Plan

    let entitlements: Entitlements
    if (subscription.isTrial) {
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
  private getEntitlementsForPlan(plan: Plan): Entitlements {
    switch(plan) {
      case 'free':
        return {
          canUseAI: false,
          canExportPDF: false,
          canCreateTeam: false,
          canUseSSO: false,
          canManageUsers: false,
          canViewReports: false,
          canExportData: false,
          maxUsers: 1,
          maxWorkspaces: 1,
          maxInvoices: 10,
        }
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
        return this.getEntitlementsForPlan('free')
    }
  }

  // ─── Full entitlements (Trial / Enterprise) ────────────────
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
        key
      )
    }
    return true
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
    userId: string, 
    action: 'create_invoice' | 'create_user' | 'create_workspace' | 'use_ai' | 'export_data'
  ): Promise<ActionResult> {
    const entitlements = await this.getEntitlements(userId)
    
    switch (action) {
      case 'create_invoice': {
        const limit = entitlements.maxInvoices
        if (limit === null) return { allowed: true, reason: null }
        
        const { count } = await supabase
          .from('invoices')
          .select('id', { count: 'estimated', head: true })
          .eq('user_id', userId)
        
        const current = count || 0
        if (current >= limit) {
          return { 
            allowed: false, 
            reason: `You have reached the limit of ${limit} invoices. Please upgrade your plan.`,
            limit 
          }
        }
        return { allowed: true, reason: null, limit }
      }
      
      case 'create_user': {
        const limit = entitlements.maxUsers
        if (limit === null) return { allowed: true, reason: null }
        
        const { count } = await supabase
          .from('workspace_members')
          .select('id', { count: 'estimated', head: true })
          .eq('user_id', userId)
        
        const current = count || 0
        if (current >= limit) {
          return { 
            allowed: false, 
            reason: `You have reached the limit of ${limit} users. Please upgrade your plan.`,
            limit 
          }
        }
        return { allowed: true, reason: null, limit }
      }
      
      case 'create_workspace': {
        const limit = entitlements.maxWorkspaces
        if (limit === null) return { allowed: true, reason: null }
        
        const { count } = await supabase
          .from('workspaces')
          .select('id', { count: 'estimated', head: true })
          .eq('user_id', userId)
        
        const current = count || 0
        if (current >= limit) {
          return { 
            allowed: false, 
            reason: `You have reached the limit of ${limit} workspaces. Please upgrade your plan.`,
            limit 
          }
        }
        return { allowed: true, reason: null, limit }
      }
      
      case 'use_ai':
        return { 
          allowed: entitlements.canUseAI,
          reason: entitlements.canUseAI ? null : 'AI features are not available on your current plan.',
        }
      
      case 'export_data':
        return { 
          allowed: entitlements.canExportData,
          reason: entitlements.canExportData ? null : 'Data export is not available on your current plan.',
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
    userId: string, 
    actions: Array<'create_invoice' | 'create_user' | 'create_workspace' | 'use_ai' | 'export_data'>
  ): Promise<Record<string, ActionResult>> {
    const results: Record<string, ActionResult> = {}
    
    for (const action of actions) {
      results[action] = await this.canPerformAction(userId, action)
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