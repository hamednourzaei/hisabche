// backend/src/services/notification.service.ts
// ============================================
// Notification Service — با لاگ کامل
// ============================================

import { supabase } from "../db";
import type { CreateNotificationInput, NotificationFilters } from "@hisabche/validation";
import { DatabaseError } from "../errors/database.error";
import { memoryCache } from '../utils/pagination';

const NOTIFICATION_COLUMNS = 'id, user_id, workspace_id, title, body, type, action_url, entity_type, entity_id, metadata, is_read, read_at, created_at, updated_at'
const NOTIFICATION_MINIMAL = 'id, title, body, type, is_read, created_at'

export class NotificationService {

  private getUnreadCountCacheKey(userId: string) {
    return `notifications:unread:${userId}`
  }

  private getListCacheKey(userId: string, filters: NotificationFilters) {
    return `notifications:list:${userId}:${JSON.stringify(filters)}`
  }

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
    await this.invalidateCache(input.user_id);
    return data;
  }

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

    if (error) {
      console.error('❌ [NotificationService.list] Supabase error:', error);
      throw new DatabaseError("Failed to fetch notifications", error);
    }

    const result = { data: data || [], total: count || 0 };
    await memoryCache.set(cacheKey, result, 30);
    return result;
  }

  async markAsRead(ids: string[]) {
    console.log('📝 [NotificationService.markAsRead] Called with ids:', ids);
    
    if (!ids || ids.length === 0) {
      console.log('⚠️ [NotificationService.markAsRead] ids is empty, returning');
      return;
    }

    try {
      const { data: notifications, error: fetchError } = await supabase
        .from("notifications")
        .select("user_id")
        .in("id", ids);

      if (fetchError) {
        console.error('❌ [NotificationService.markAsRead] Fetch error:', fetchError);
        throw new DatabaseError("Failed to fetch notifications", fetchError);
      }

      console.log('✅ [NotificationService.markAsRead] Found notifications:', 
        notifications?.map(n => ({ id: n.id, user_id: n.user_id }))
      );

      const { data: updated, error: updateError } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in("id", ids)
        .select();

      if (updateError) {
        console.error('❌ [NotificationService.markAsRead] Update error:', updateError);
        throw new DatabaseError("Failed to mark notifications as read", updateError);
      }

      console.log('✅ [NotificationService.markAsRead] Updated records:', updated?.length || 0);

      if (notifications && notifications.length > 0) {
        const userId = notifications[0]?.user_id;
        if (userId) {
          await this.invalidateCache(userId);
          console.log('✅ [NotificationService.markAsRead] Cache invalidated for user:', userId);
        }
      }
    } catch (err) {
      console.error('❌ [NotificationService.markAsRead] Unexpected error:', err);
      throw err;
    }
  }

  async markAllAsRead(userId: string) {
    console.log('📝 [NotificationService.markAllAsRead] Called for user:', userId);

    try {
      const { data, error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("is_read", false)
        .select();

      if (error) {
        console.error('❌ [NotificationService.markAllAsRead] Supabase error:', error);
        throw new DatabaseError("Failed to mark all notifications as read", error);
      }

      console.log('✅ [NotificationService.markAllAsRead] Updated records:', data?.length || 0);
      await this.invalidateCache(userId);
    } catch (err) {
      console.error('❌ [NotificationService.markAllAsRead] Unexpected error:', err);
      throw err;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = this.getUnreadCountCacheKey(userId)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached !== null) return cached as number

    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "estimated", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      console.error('❌ [NotificationService.getUnreadCount] Supabase error:', error);
      throw new DatabaseError("Failed to count notifications", error);
    }

    const result = count || 0;
    await memoryCache.set(cacheKey, result, 10);
    return result;
  }

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

    if (error) {
      console.error('❌ [NotificationService.getById] Supabase error:', error);
      throw new DatabaseError("Failed to fetch notification", error);
    }

    await memoryCache.set(cacheKey, data, 300)
    return data;
  }

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

    if (error) {
      console.error('❌ [NotificationService.delete] Supabase error:', error);
      throw new DatabaseError("Failed to delete notification", error);
    }

    if (notification) {
      await this.invalidateCache(notification.user_id);
    }
  }

  async deleteAllRead(userId: string) {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", userId)
      .eq("is_read", true);

    if (error) {
      console.error('❌ [NotificationService.deleteAllRead] Supabase error:', error);
      throw new DatabaseError("Failed to delete read notifications", error);
    }

    await this.invalidateCache(userId);
  }

  private async invalidateCache(userId: string) {
    await memoryCache.invalidate(this.getUnreadCountCacheKey(userId))
    await memoryCache.invalidate(`notifications:list:${userId}:*`)
    await memoryCache.invalidate(`notification:${userId}:*`)
  }
}

export default NotificationService