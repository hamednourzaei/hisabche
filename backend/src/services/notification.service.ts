// backend/src/services/notification.service.ts
// ============================================
// Notification Service — با لاگ کامل
// ============================================

import { supabase } from '../db'
import type { CreateNotificationInput, NotificationFilters } from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'

const NOTIFICATION_MINIMAL = 'id, title, body, type, is_read, created_at'

/** Who is reading: one person, inside one workspace. */
export type NotificationScope = { userId: string; workspaceId: string }

/** PostgREST `or` filter: this workspace, or no workspace (account-level). */
function inWorkspace(scope: NotificationScope): string {
  return `workspace_id.eq.${scope.workspaceId},workspace_id.is.null`
}

export class NotificationService {
  private getUnreadCountCacheKey(scope: NotificationScope) {
    return `notifications:unread:${scope.userId}:${scope.workspaceId}`
  }

  private getListCacheKey(scope: NotificationScope, filters: NotificationFilters) {
    return `notifications:list:${scope.userId}:${scope.workspaceId}:${JSON.stringify(filters)}`
  }

  async create(workspaceId: string, input: CreateNotificationInput) {
    console.log('📝 [NotificationService] Creating notification:', {
      workspaceId,
      userId: input.user_id,
      title: input.title,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
    })

    if (!workspaceId) {
      console.error('❌ [NotificationService] workspaceId is required')
      return null
    }

    if (!input.user_id) {
      console.error('❌ [NotificationService] user_id is required')
      return null
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        workspace_id: workspaceId,
        user_id: input.user_id,
        title: input.title,
        body: input.body ?? null,
        type: input.type ?? 'info',
        action_url: input.action_url ?? null,
        entity_type: input.entity_type ?? null,
        entity_id: input.entity_id ?? null,
        metadata: input.metadata ?? {},
      })
      .select(NOTIFICATION_MINIMAL)
      .single()

    if (error) {
      console.error('❌ [NotificationService] Supabase error:', error)
      throw new DatabaseError('Failed to create notification', error)
    }

    console.log('✅ [NotificationService] Notification created:', data)
    await this.invalidateCache(input.user_id)
    return data
  }

  // ⚠️ THE READER IS A PERSON IN ONE WORKSPACE, NOT A PERSON (audit F-04,
  // 8 Nov 2026). These reads used to filter by `user_id` alone, so a member
  // removed or suspended from a business kept reading — and marking — that
  // business's notifications from any other workspace. Every read and write
  // below is scoped to the requester's ACTIVE workspace (resolved by
  // requireWorkspaceContext, which refuses a suspended or removed member),
  // plus the account-level rows that belong to no workspace (`workspace_id IS
  // NULL`, e.g. the trial-expiry notice). Each statement names BOTH filters:
  //   .eq('user_id', scope.userId).or(inWorkspace(scope))
  async list(scope: NotificationScope, filters: NotificationFilters) {
    const cacheKey = this.getListCacheKey(scope, filters)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    let query = supabase
      .from('notifications')
      .select(NOTIFICATION_MINIMAL, { count: 'exact' })
      .eq('user_id', scope.userId)
      .or(inWorkspace(scope))
      .order('created_at', { ascending: false })

    if (filters.is_read !== undefined) query = query.eq('is_read', filters.is_read)
    if (filters.type) query = query.eq('type', filters.type)

    const from = (filters.page - 1) * filters.limit
    const to = from + filters.limit - 1

    const { data, error, count } = await query.range(from, to)

    if (error) {
      console.error('❌ [NotificationService.list] Supabase error:', error)
      throw new DatabaseError('Failed to fetch notifications', error)
    }

    const result = { data: data || [], total: count || 0 }
    await memoryCache.set(cacheKey, result, 30)
    return result
  }

  async markAsRead(scope: NotificationScope, ids: string[]) {
    if (!ids || ids.length === 0) return []

    const { data: updated, error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', ids)
      .eq('user_id', scope.userId)
      .or(inWorkspace(scope))
      .select()

    if (error) throw new DatabaseError('Failed to mark notifications as read', error)

    await this.invalidateCache(scope.userId)
    return updated ?? []
  }

  async markAllAsRead(scope: NotificationScope) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('is_read', false)
      .eq('user_id', scope.userId)
      .or(inWorkspace(scope))

    if (error) throw new DatabaseError('Failed to mark all notifications as read', error)

    await this.invalidateCache(scope.userId)
  }

  /** Exact: the badge is a number someone acts on (CLAUDE.md §7.4). */
  async getUnreadCount(scope: NotificationScope): Promise<number> {
    const cacheKey = this.getUnreadCountCacheKey(scope)

    const cached = await memoryCache.get(cacheKey)
    if (cached !== null) return cached as number

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)
      .eq('user_id', scope.userId)
      .or(inWorkspace(scope))

    if (error) {
      console.error('❌ [NotificationService.getUnreadCount] Supabase error:', error)
      throw new DatabaseError('Failed to count notifications', error)
    }

    const result = count || 0
    await memoryCache.set(cacheKey, result, 10)
    return result
  }

  /** Every workspace view of this person: a new notification may belong to any of them. */
  private async invalidateCache(userId: string) {
    await memoryCache.invalidate(`notifications:unread:${userId}:*`)
    await memoryCache.invalidate(`notifications:list:${userId}:*`)
  }
}

export default NotificationService
