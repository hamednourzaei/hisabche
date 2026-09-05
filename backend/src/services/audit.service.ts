// ============================================
// backend/src/services/audit.service.ts — Optimized v2.1
// FIXED: Added cache, count: estimated, projection
// ============================================

import { supabase } from '../db'
import { CreateAuditLog, AuditFilters } from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'
import type { TenancyContext } from './tenancy.service'
import { memoryCache } from '../utils/pagination'

// ✅ Column Selection Constants (بهینه‌شده)
const AUDIT_LOG_COLUMNS =
  'id, user_id, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent, created_at'
const AUDIT_LIST_COLUMNS = 'id, user_id, action, entity_type, entity_id, ip_address, created_at'
const AUDIT_STATS_COLUMNS = 'action, entity_type, user_id'

// ✅ Minimal columns for listing (فقط ستون‌های ضروری)
const AUDIT_MINIMAL_COLUMNS = 'id, action, entity_type, entity_id, created_at'

export class AuditService {
  // ─── Cache Keys ───────────────────────────────────────────
  private getStatsCacheKey(startDate: string, endDate: string) {
    return `audit_stats:${startDate}:${endDate}`
  }

  private getEntityHistoryCacheKey(entityType: string, entityId: string) {
    return `audit_history:${entityType}:${entityId}`
  }

  private getUserActivityCacheKey(userId: string, limit: number) {
    return `audit_user:${userId}:${limit}`
  }

  // ─── Write Audit Log ──────────────────────────────────────
  async log(data: CreateAuditLog) {
    const row: Record<string, unknown> = {
      user_id: data.userId,
      action: data.action,
      entity_type: data.entityType,
      entity_id: data.entityId || null,
      old_data: data.oldData || null,
      new_data: data.newData || null,
      ip_address: data.ipAddress || null,
      user_agent: data.userAgent || null,

      // ⚠️ G4 — the workspace, which this method never wrote.
      //
      // `audit_logs.workspace_id` has existed since
      // live-reconciliation-migration.sql, and every row inserted since then
      // has it NULL because it was not in this object. That is the whole
      // reason the table is treated as a platform-support surface: it cannot
      // be filtered by workspace when the column is empty.
      //
      // Written now, so the member-facing read has something to scope to.
      // Historical rows stay NULL — see the migration for why they are not
      // guessed.
      workspace_id: data.workspaceId ?? null,
      branch_id: data.branchId ?? null,
    }

    let { error } = await supabase.from('audit_logs').insert(row)

    // Before phase-g-03 there is no branch_id column. An audit row is worth
    // writing without it — losing the evidence entirely because one attribute
    // is not migrated yet is the worse failure.
    if (error && isMissingBranchColumn(error)) {
      delete row.branch_id
      ;({ error } = await supabase.from('audit_logs').insert(row))
    }

    if (error) throw new DatabaseError('Failed to write audit log', error)

    // ✅ Invalidate cache after new log
    await memoryCache.invalidate(`audit_stats:*`)
    await memoryCache.invalidate(`audit_user:${data.userId}:*`)
    if (data.entityId) {
      await memoryCache.invalidate(`audit_history:${data.entityType}:${data.entityId}`)
    }
  }

  // ─── Read Audit Logs ──────────────────────────────────────
  async list(filters: AuditFilters) {
    // ✅ ایجاد کلید کش بر اساس فیلترها
    const cacheKey = `audit_list:${JSON.stringify(filters)}`

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    let query = supabase
      .from('audit_logs')
      // ✅ فقط ستون‌های مورد نیاز
      .select(AUDIT_MINIMAL_COLUMNS, { count: 'estimated' }) // ✅ count: 'estimated'

    if (filters.userId) query = query.eq('user_id', filters.userId)
    if (filters.action) query = query.eq('action', filters.action)
    if (filters.entityType) query = query.eq('entity_type', filters.entityType)
    if (filters.entityId) query = query.eq('entity_id', filters.entityId)
    if (filters.startDate) query = query.gte('created_at', filters.startDate)
    if (filters.endDate) query = query.lte('created_at', filters.endDate)

    const from = (filters.page - 1) * filters.limit
    const to = from + filters.limit - 1

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw new DatabaseError('Failed to fetch audit logs', error)

    const result = {
      data: data || [],
      total: count || 0,
      page: filters.page,
      limit: filters.limit,
      totalPages: count ? Math.ceil(count / filters.limit) : 0,
    }

    // ✅ ذخیره در کش با TTL 30 ثانیه (چون داده‌های لحظه‌ای است)
    await memoryCache.set(cacheKey, result, 30)
    return result
  }

  // ─── Get Entity History ──────────────────────────────────
  async getEntityHistory(entityType: string, entityId: string) {
    const cacheKey = this.getEntityHistoryCacheKey(entityType, entityId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    // ✅ فقط ستون‌های ضروری
    const { data, error } = await supabase
      .from('audit_logs')
      .select(AUDIT_MINIMAL_COLUMNS)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw new DatabaseError('Failed to fetch entity history', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 300) // 5 دقیقه
    return result
  }

  /**
   * Every workspace's record of what one person did — for PLATFORM SUPPORT.
   *
   * Deliberately a separate method with a name that says what it does. The
   * danger this codebase guards against is an IMPLICIT cross-tenant read that
   * looks like an ordinary one; an explicit, admin-guarded, differently-named
   * call is a decision somebody made and can be found in review.
   *
   * Callers must be behind `platformAdminGuard`. It returns metadata about
   * actions — never the financial rows those actions touched.
   */
  async getUserActivityAcrossWorkspaces(userId: string, limit = 50) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select(AUDIT_MINIMAL_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new DatabaseError('Failed to fetch cross-workspace activity', error)
    return data ?? []
  }

  // ─── Get User Activity ──────────────────────────────────
  /**
   * What this person has done IN THIS WORKSPACE.
   *
   * The workspace is the boundary and the user is a filter inside it. Scoped
   * by `user_id` alone, this answered "everything this person has ever done"
   * across every book they have touched — so a bookkeeper who helps in two
   * shops saw one shop's activity while looking at the other.
   */
  async getUserActivity(ctx: TenancyContext, limit = 50) {
    const { workspaceId, userId } = ctx
    const cacheKey = this.getUserActivityCacheKey(`${workspaceId}:${userId}`, limit)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    // ✅ فقط ستون‌های ضروری
    // Scoped to the workspace AND the actor. `user_id` alone answered "what
    // has this person done" across every book they have ever touched — so a
    // bookkeeper who helps in two shops saw one shop's activity while looking
    // at the other. The workspace is the boundary; the user is a filter
    // INSIDE it.
    const { data, error } = await supabase
      .from('audit_logs')
      .select(AUDIT_MINIMAL_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new DatabaseError('Failed to fetch user activity', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 120) // 2 دقیقه
    return result
  }

  // ─── Get Stats ──────────────────────────────────────────
  async getStats(startDate: string, endDate: string) {
    const cacheKey = this.getStatsCacheKey(startDate, endDate)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    // ✅ فقط ستون‌های ضروری
    const { data, error } = await supabase
      .from('audit_logs')
      .select(AUDIT_STATS_COLUMNS)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (error) throw new DatabaseError('Failed to fetch audit stats', error)

    if (!data || data.length === 0) {
      const emptyResult = {
        totalActions: 0,
        byAction: {},
        byEntity: {},
        byUser: {},
        period: { start: startDate, end: endDate },
      }
      await memoryCache.set(cacheKey, emptyResult, 60)
      return emptyResult
    }

    const byAction: Record<string, number> = {}
    const byEntity: Record<string, number> = {}
    const byUser: Record<string, number> = {}

    for (const log of data) {
      byAction[log.action] = (byAction[log.action] || 0) + 1
      byEntity[log.entity_type] = (byEntity[log.entity_type] || 0) + 1
      byUser[log.user_id] = (byUser[log.user_id] || 0) + 1
    }

    const result = {
      totalActions: data.length,
      byAction,
      byEntity,
      byUser,
      period: { start: startDate, end: endDate },
    }

    await memoryCache.set(cacheKey, result, 300) // 5 دقیقه
    return result
  }

  // ─── Cleanup Old Logs ──────────────────────────────────
  /**
   * Retention deletion of audit rows older than `daysToKeep`.
   *
   * ⚠️ This is the most destructive operation in the codebase: it removes the
   * record of what everyone did. Two things make it survivable.
   *
   * 1. **It is gated.** The route requires `platformAdminGuard`. Before that
   *    guard existed, ANY authenticated user could call it and erase the
   *    platform's audit trail — including the evidence of their own actions.
   *
   * 2. **The deletion is itself audited, BEFORE it runs.** The marker row is
   *    written first and carries a `created_at` of now, which is by definition
   *    newer than the cutoff, so it survives its own cleanup. Writing it
   *    afterwards would risk losing the record of the deletion if the process
   *    died in between — rows gone, nothing saying why.
   *
   * Constitution §12.18: every state transition must be auditable. A cleanup
   * that leaves no trace is indistinguishable from someone covering their
   * tracks.
   */
  async cleanup(daysToKeep: number, actorUserId?: string) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    // Written FIRST, deliberately — see above.
    await this.log({
      userId: actorUserId ?? 'system',
      // `action` is a closed vocabulary; this operation genuinely is a delete,
      // and `entityType: 'audit_logs'` makes it unambiguous. Widening the enum
      // for one call site would change the domain vocabulary for a logging
      // convenience.
      action: 'delete',
      entityType: 'audit_logs',
      newData: {
        daysToKeep,
        deletedBefore: cutoffDate.toISOString(),
        requestedAt: new Date().toISOString(),
      },
    }).catch((err: unknown) => {
      // If the marker cannot be written, do NOT proceed. Deleting the trail
      // without recording that it happened is the exact outcome this guards
      // against.
      throw new DatabaseError('Refusing to clean up audit logs: could not record the cleanup', err)
    })

    const { error } = await supabase
      .from('audit_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString())

    if (error) throw new DatabaseError('Failed to cleanup audit logs', error)

    // ✅ Clear all cache after cleanup
    await memoryCache.invalidate('audit_list:*')
    await memoryCache.invalidate('audit_stats:*')
    await memoryCache.invalidate('audit_history:*')
    await memoryCache.invalidate('audit_user:*')

    return { success: true, deletedBefore: cutoffDate.toISOString() }
  }

  // ─── Export Logs ────────────────────────────────────────
  async exportLogs(filters: AuditFilters) {
    // ✅ بدون کش برای Export (چون داده‌های کامل نیاز است)
    let query = supabase.from('audit_logs').select(AUDIT_LIST_COLUMNS) // ✅ فقط ستون‌های ضروری

    if (filters.userId) query = query.eq('user_id', filters.userId)
    if (filters.action) query = query.eq('action', filters.action)
    if (filters.entityType) query = query.eq('entity_type', filters.entityType)
    if (filters.startDate) query = query.gte('created_at', filters.startDate)
    if (filters.endDate) query = query.lte('created_at', filters.endDate)

    const { data, error } = await query.order('created_at', { ascending: false }).limit(10000)

    if (error) throw new DatabaseError('Failed to export audit logs', error)
    return data || []
  }

  // ─── Invalidate Cache ────────────────────────────────────
  async invalidateCache(userId?: string) {
    await memoryCache.invalidate('audit_list:*')
    await memoryCache.invalidate('audit_stats:*')
    await memoryCache.invalidate('audit_history:*')
    if (userId) {
      await memoryCache.invalidate(`audit_user:${userId}:*`)
    } else {
      await memoryCache.invalidate('audit_user:*')
    }
  }
}

export default AuditService
