// ============================================
// backend/src/services/notification.service.ts — Optimized v2.2
// FIXED: TypeScript undefined checks
// ============================================

import { supabase } from "../db";
import type { CreateNotificationInput, NotificationFilters } from "@hisabche/validation";
import { DatabaseError } from "../errors/database.error";
import { memoryCache } from '../utils/pagination';

// ✅ Column Selection Constants
const NOTIFICATION_COLUMNS = 'id, user_id, workspace_id, title, body, type, action_url, entity_type, entity_id, metadata, is_read, read_at, created_at, updated_at'
const NOTIFICATION_MINIMAL = 'id, title, body, type, is_read, created_at'

export class NotificationService {

  // ─── Cache Keys ──────────────────────────────────────────────
  private getUnreadCountCacheKey(userId: string) {
    return `notifications:unread:${userId}`
  }

  private getListCacheKey(userId: string, filters: NotificationFilters) {
    return `notifications:list:${userId}:${JSON.stringify(filters)}`
  }

  // ─── Create Notification ────────────────────────────────────
  async create(workspaceId: string, input: CreateNotificationInput) {
    console.log('📝 [NotificationService] Creating notification:', {
      workspaceId,
      userId: input.user_id,
      title: input.title,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
    });

    if (!workspaceId) {
      console.error('❌ [NotificationService] workspaceId is required');
      return null;
    }

    if (!input.user_id) {
      console.error('❌ [NotificationService] user_id is required');
      return null;
    }

    const { data, error } = await supabase
      .from("notifications")
      .insert({
        workspace_id: workspaceId,
        user_id: input.user_id,
        title: input.title,
        body: input.body ?? null,
        type: input.type ?? "info",
        action_url: input.action_url ?? null,
        entity_type: input.entity_type ?? null,
        entity_id: input.entity_id ?? null,
        metadata: input.metadata ?? {},
      })
      .select(NOTIFICATION_MINIMAL)
      .single();

    if (error) {
      console.error('❌ [NotificationService] Supabase error:', error);
      throw new DatabaseError("Failed to create notification", error);
    }

    console.log('✅ [NotificationService] Notification created:', data);

    // ✅ Invalidate cache
    await this.invalidateCache(input.user_id);

    return data;
  }

  // ─── List Notifications ─────────────────────────────────────
  async list(userId: string, filters: NotificationFilters) {
    const cacheKey = this.getListCacheKey(userId, filters)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    let query = supabase
      .from("notifications")
      .select(NOTIFICATION_MINIMAL, { count: "estimated" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (filters.is_read !== undefined) query = query.eq("is_read", filters.is_read);
    if (filters.type) query = query.eq("type", filters.type);

    const from = (filters.page - 1) * filters.limit;
    const to = from + filters.limit - 1;

    const { data, error, count } = await query.range(from, to);

    if (error) throw new DatabaseError("Failed to fetch notifications", error);

    const result = { data: data || [], total: count || 0 };

    await memoryCache.set(cacheKey, result, 30);

    return result;
  }

  // ─── Mark as Read ──────────────────────────────────────────
  async markAsRead(ids: string[]) {
    if (!ids || ids.length === 0) return;

    // ✅ گرفتن userId برای invalidate cache
    const { data: notifications } = await supabase
      .from("notifications")
      .select("user_id")
      .in("id", ids)
      .limit(1);

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in("id", ids);

    if (error) throw new DatabaseError("Failed to mark notifications as read", error);

    // ✅ FIX: چک کردن وجود notifications و notifications[0]
    if (notifications && notifications.length > 0 && notifications[0]) {
      await this.invalidateCache(notifications[0].user_id);
    }
  }

  // ─── Mark All as Read ──────────────────────────────────────
  async markAllAsRead(userId: string) {
    console.log('📝 [NotificationService] Marking all as read for user:', userId);

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      console.error('❌ [NotificationService] Supabase error:', error);
      throw new DatabaseError("Failed to mark all notifications as read", error);
    }

    console.log('✅ [NotificationService] All notifications marked as read');
    await this.invalidateCache(userId);
  }

  // ─── Get Unread Count ──────────────────────────────────────
  async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = this.getUnreadCountCacheKey(userId)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached !== null) return cached as number

    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "estimated", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) throw new DatabaseError("Failed to count notifications", error);

    const result = count || 0;

    await memoryCache.set(cacheKey, result, 10);

    return result;
  }

  // ─── Get Notification by ID ─────────────────────────────────
  async getById(id: string, userId: string) {
    const cacheKey = `notification:${userId}:${id}`
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from("notifications")
      .select(NOTIFICATION_COLUMNS)
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error) throw new DatabaseError("Failed to fetch notification", error);

    await memoryCache.set(cacheKey, data, 300)
    return data;
  }

  // ─── Delete Notification ────────────────────────────────────
  async delete(id: string, userId: string) {
    const { data: notification } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw new DatabaseError("Failed to delete notification", error);

    if (notification) {
      await this.invalidateCache(notification.user_id);
    }
  }

  // ─── Delete All Read Notifications ──────────────────────────
  async deleteAllRead(userId: string) {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", userId)
      .eq("is_read", true);

    if (error) throw new DatabaseError("Failed to delete read notifications", error);

    await this.invalidateCache(userId);
  }

  // ─── Invalidate Cache ───────────────────────────────────────
  private async invalidateCache(userId: string) {
    await memoryCache.invalidate(this.getUnreadCountCacheKey(userId))
    await memoryCache.invalidate(`notifications:list:${userId}:*`)
    await memoryCache.invalidate(`notification:${userId}:*`)
  }
}

export default NotificationService