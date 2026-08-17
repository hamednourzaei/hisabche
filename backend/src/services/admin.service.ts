// ============================================
// backend/src/services/admin.service.ts
// Platform admin service — full operational data access.
// ============================================

import { supabase } from '../db'
import { AuditService } from './audit.service'

export class AdminService {
  private auditService = new AuditService()

  async getStatus() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '3.0',
    }
  }

  async getMetrics() {
    // Count workspaces (businesses)
    const { count: businessesCount } = await supabase
      .from('workspaces')
      .select('*', { count: 'exact', head: true })

    // Count products as a proxy for inventory size
    const { count: productsCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })

    // Count subscriptions if table exists
    let subscriptionsCount = 0
    try {
      const { count } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
      subscriptionsCount = count ?? 0
    } catch {
      subscriptionsCount = 0
    }

    return {
      totalBusinesses: businessesCount ?? 0,
      totalProducts: productsCount ?? 0,
      totalSubscriptions: subscriptionsCount,
      activeUsers: 1, // Minimum current platform admin session
    }
  }

  async getUsers(limit = 50, offset = 0) {
    // Use Supabase auth admin listUsers if available via supabase.auth.admin
    try {
      const { data, error } = await supabase.auth.admin.listUsers({
        page: Math.floor(offset / limit) + 1,
        perPage: limit,
      })
      if (error) throw error
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
    } catch {
      return { users: [], total: 0 }
    }
  }

  async getBusinesses(limit = 50, offset = 0) {
    const { data, error, count } = await supabase
      .from('workspaces')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    return {
      businesses: data || [],
      total: count || 0,
    }
  }

  async getAuditLogs(limit = 50, offset = 0) {
    const { data, error, count } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      // Return empty if audit logs table is missing or unmigrated
      return { logs: [], total: 0 }
    }

    return {
      logs: data || [],
      total: count || 0,
    }
  }
}
