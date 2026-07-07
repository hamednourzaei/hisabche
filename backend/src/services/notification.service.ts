import { supabase } from "../db";
import type { CreateNotificationInput, NotificationFilters } from "@hisabche/validation";
import { DatabaseError } from "../errors/database.error";

export class NotificationService {
  async create(workspaceId: string, input: CreateNotificationInput) {
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
      .select()
      .single();

    if (error) throw new DatabaseError("Failed to create notification", error);
    return data;
  }

  async list(userId: string, filters: NotificationFilters) {
      console.log('[DEBUG] list() called with userId:', userId);

    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (filters.is_read !== undefined) query = query.eq("is_read", filters.is_read);
    if (filters.type) query = query.eq("type", filters.type);

    const from = (filters.page - 1) * filters.limit;
    const to = from + filters.limit - 1;

    const { data, error, count } = await query.range(from, to);
      console.log('[DEBUG] list() result:', data?.length, 'count:', count, 'error:', error);

    if (error) throw new DatabaseError("Failed to fetch notifications", error);

    return { data: data || [], total: count || 0 };
  }

  async markAsRead(ids: string[]) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", ids);

    if (error) throw new DatabaseError("Failed to mark notifications as read", error);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) throw new DatabaseError("Failed to count notifications", error);
    return count || 0;
  }
}