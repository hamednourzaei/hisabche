// ============================================
// backend/src/services/entitlement.service.ts
// Entitlement Service — Feature Flags & Access Control
// ============================================

import { supabase } from '../db'
import { Plan } from '@hisabche/validation'
import { BillingService } from './billing.service'

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

export class EntitlementService {
  private billingService: BillingService

  constructor() {
    this.billingService = new BillingService()
  }

  // ─── Get all entitlements for a user ───────────────────────────
  async getEntitlements(userId: string): Promise<Entitlements> {
    const subscription = await this.billingService.getCurrentSubscription(userId)
    const plan = subscription.plan as Plan

    // Trial = همه چیز
    if (subscription.isTrial) {
      return this.getFullEntitlements()
    }

    return this.getEntitlementsForPlan(plan)
  }

  // ─── Check a single entitlement ──────────────────────────────────
  async hasEntitlement(userId: string, key: keyof Entitlements): Promise<boolean> {
    const entitlements = await this.getEntitlements(userId)
    const value = entitlements[key]
    
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value > 0
    return false
  }

  // ─── Get entitlements for a specific plan ────────────────────────
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

  // ─── Full entitlements (Trial / Enterprise) ──────────────────────
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

  // ─── Middleware: Check entitlement in route ──────────────────────
  async requireEntitlement(userId: string, key: keyof Entitlements): Promise<boolean> {
    const has = await this.hasEntitlement(userId, key)
    if (!has) {
      throw new Error(`Missing entitlement: ${key}. Please upgrade your plan.`)
    }
    return true
  }

  // ─── Get feature flags for frontend ─────────────────────────────
  async getFeatureFlags(userId: string): Promise<Record<string, boolean>> {
    const entitlements = await this.getEntitlements(userId)
    return {
      'AI': entitlements.canUseAI,
      'EXPORT_PDF': entitlements.canExportPDF,
      'TEAM': entitlements.canCreateTeam,
      'SSO': entitlements.canUseSSO,
      'MANAGE_USERS': entitlements.canManageUsers,
      'REPORTS': entitlements.canViewReports,
      'EXPORT_DATA': entitlements.canExportData,
    }
  }

  // ─── Get limits for frontend ─────────────────────────────────────
  async getLimits(userId: string): Promise<{
    users: number | null
    workspaces: number | null
    invoices: number | null
  }> {
    const entitlements = await this.getEntitlements(userId)
    return {
      users: entitlements.maxUsers,
      workspaces: entitlements.maxWorkspaces,
      invoices: entitlements.maxInvoices,
    }
  }
}