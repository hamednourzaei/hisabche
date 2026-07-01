// ============================================
// backend/src/services/audit.service.ts
// ============================================

import { supabase } from '../db'
import {
  CreateAuditLog,
  AuditFilters,
} from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'

export class AuditService {
  // ─── Write Audit Log ──────────────────────────────────────
  async log(data: CreateAuditLog) {
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: data.userId,
        action: data.action,
        entity_type: data.entityType,
        entity_id: data.entityId || null,
        old_data: data.oldData || null,
        new_data: data.newData || null,
        ip_address: data.ipAddress || null,
        user_agent: data.userAgent || null,
      })

    if (error) throw new DatabaseError('Failed to write audit log', error)
  }

  // ─── Read Audit Logs ──────────────────────────────────────
  async list(filters: AuditFilters) {
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })

    if (filters.userId) {
      query = query.eq('user_id', filters.userId)
    }

    if (filters.action) {
      query = query.eq('action', filters.action)
    }

    if (filters.entityType) {
      query = query.eq('entity_type', filters.entityType)
    }

    if (filters.entityId) {
      query = query.eq('entity_id', filters.entityId)
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }

    const from = (filters.page - 1) * filters.limit
    const to = from + filters.limit - 1

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw new DatabaseError('Failed to fetch audit logs', error)

    return {
      data: data || [],
      total: count || 0,
      page: filters.page,
      limit: filters.limit,
      totalPages: count ? Math.ceil(count / filters.limit) : 0,
    }
  }

  // ─── Get Entity History ───────────────────────────────────
  async getEntityHistory(entityType: string, entityId: string) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })

    if (error) throw new DatabaseError('Failed to fetch entity history', error)
    return data || []
  }

  // ─── Get User Activity ────────────────────────────────────
  async getUserActivity(userId: string, limit = 50) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new DatabaseError('Failed to fetch user activity', error)
    return data || []
  }

  // ─── Get Stats ────────────────────────────────────────────
  async getStats(startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('action, entity_type, user_id')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (error) throw new DatabaseError('Failed to fetch audit stats', error)

    if (!data || data.length === 0) {
      return {
        totalActions: 0,
        byAction: {},
        byEntity: {},
        byUser: {},
        period: { start: startDate, end: endDate },
      }
    }

    const byAction: Record<string, number> = {}
    const byEntity: Record<string, number> = {}
    const byUser: Record<string, number> = {}

    for (const log of data) {
      byAction[log.action] = (byAction[log.action] || 0) + 1
      byEntity[log.entity_type] = (byEntity[log.entity_type] || 0) + 1
      byUser[log.user_id] = (byUser[log.user_id] || 0) + 1
    }

    return {
      totalActions: data.length,
      byAction,
      byEntity,
      byUser,
      period: { start: startDate, end: endDate },
    }
  }

  // ─── Cleanup Old Logs ─────────────────────────────────────
  async cleanup(daysToKeep: number) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const { error } = await supabase
      .from('audit_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString())

    if (error) throw new DatabaseError('Failed to cleanup audit logs', error)
    return { success: true, deletedBefore: cutoffDate.toISOString() }
  }

  // ─── Export Logs ──────────────────────────────────────────
  async exportLogs(filters: AuditFilters) {
    let query = supabase
      .from('audit_logs')
      .select('*')

    if (filters.userId) query = query.eq('user_id', filters.userId)
    if (filters.action) query = query.eq('action', filters.action)
    if (filters.entityType) query = query.eq('entity_type', filters.entityType)
    if (filters.startDate) query = query.gte('created_at', filters.startDate)
    if (filters.endDate) query = query.lte('created_at', filters.endDate)

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(10000)

    if (error) throw new DatabaseError('Failed to export audit logs', error)
    return data || []
  }
}