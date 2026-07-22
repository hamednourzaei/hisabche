// packages/db-server/src/repositories/ActivityRepository.ts
// ============================================
// Activity Repository — Data Access Layer
// ============================================

import { supabase } from '../client';
import { DatabaseError } from '../errors';

export interface ActivityRecord {
  id: string;
  actor_id: string;
  actor_name: string;
  entity_type: string;
  entity_id: string;
  action: string;
  title: string;
  description?: string;
  metadata: Record<string, unknown>;
  importance: number;
  is_read: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at?: string;
  workspace_id?: string;
}

export interface CreateActivityInput {
  actor_id: string;
  actor_name: string;
  entity_type: string;
  entity_id: string;
  action: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  importance?: number;
  workspace_id?: string;
}

export interface UpdateActivityInput {
  is_read?: boolean;
  is_pinned?: boolean;
  is_archived?: boolean;
}

export interface ActivityFilters {
  type?: string;
  unread?: boolean;
  search?: string;
  limit?: number;
  cursor?: string;
  workspace_id?: string;
}

export class ActivityRepository {
  private table = 'activities';

  async create(input: CreateActivityInput): Promise<ActivityRecord> {
    const { data, error } = await supabase
      .from(this.table)
      .insert({
        actor_id: input.actor_id,
        actor_name: input.actor_name,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        action: input.action,
        title: input.title,
        description: input.description || '',
        metadata: input.metadata || {},
        importance: input.importance || 0,
        is_read: false,
        is_pinned: false,
        is_archived: false,
        workspace_id: input.workspace_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [ActivityRepository] Create error:', error);
      throw new DatabaseError('Failed to create activity', error);
    }

    return data;
  }

  async findById(id: string, userId: string): Promise<ActivityRecord | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select()
      .eq('id', id)
      .eq('actor_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('❌ [ActivityRepository] FindById error:', error);
      throw new DatabaseError('Failed to find activity', error);
    }

    return data;
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    userId: string
  ): Promise<ActivityRecord[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select()
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('actor_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [ActivityRepository] FindByEntity error:', error);
      throw new DatabaseError('Failed to find activities by entity', error);
    }

    return data || [];
  }

  async findAll(
    userId: string,
    filters: ActivityFilters = {}
  ): Promise<{ data: ActivityRecord[]; count: number; nextCursor: string | null }> {
    const limit = Math.min(filters.limit || 20, 100);

    let query = supabase
      .from(this.table)
      .select('*', { count: 'exact' })
      .eq('actor_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (filters.cursor) {
      query = query.lt('created_at', filters.cursor);
    }

    if (filters.type) {
      query = query.eq('entity_type', filters.type);
    }

    if (filters.unread) {
      query = query.eq('is_read', false);
    }

    if (filters.search) {
      query = query.ilike('title', `%${filters.search}%`);
    }

    if (filters.workspace_id) {
      query = query.eq('workspace_id', filters.workspace_id);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ [ActivityRepository] FindAll error:', error);
      throw new DatabaseError('Failed to fetch activities', error);
    }

    const hasMore = (data?.length || 0) > limit;
    const items = hasMore ? data.slice(0, limit) : data;
    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1]?.created_at
      : null;

    return {
      data: items || [],
      count: count || 0,
      nextCursor,
    };
  }

  async update(id: string, userId: string, input: UpdateActivityInput): Promise<ActivityRecord> {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.is_read !== undefined) updates.is_read = input.is_read;
    if (input.is_pinned !== undefined) updates.is_pinned = input.is_pinned;
    if (input.is_archived !== undefined) updates.is_archived = input.is_archived;

    const { data, error } = await supabase
      .from(this.table)
      .update(updates)
      .eq('id', id)
      .eq('actor_id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ [ActivityRepository] Update error:', error);
      throw new DatabaseError('Failed to update activity', error);
    }

    return data;
  }

  async updateReadStatus(ids: string[], userId: string): Promise<void> {
    if (!ids || ids.length === 0) return;

    const { error } = await supabase
      .from(this.table)
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .in('id', ids)
      .eq('actor_id', userId);

    if (error) {
      console.error('❌ [ActivityRepository] UpdateReadStatus error:', error);
      throw new DatabaseError('Failed to update read status', error);
    }
  }

  async updateAllReadStatus(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from(this.table)
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq('actor_id', userId)
      .eq('is_read', false)
      .select();

    if (error) {
      console.error('❌ [ActivityRepository] UpdateAllReadStatus error:', error);
      throw new DatabaseError('Failed to update all read status', error);
    }

    return data?.length || 0;
  }

  async getUnreadCount(userId: string, workspaceId?: string): Promise<number> {
    let query = supabase
      .from(this.table)
      .select('id', { count: 'exact', head: true })
      .eq('actor_id', userId)
      .eq('is_read', false);

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    const { count, error } = await query;

    if (error) {
      console.error('❌ [ActivityRepository] GetUnreadCount error:', error);
      throw new DatabaseError('Failed to get unread count', error);
    }

    return count || 0;
  }

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from(this.table)
      .delete()
      .eq('id', id)
      .eq('actor_id', userId);

    if (error) {
      console.error('❌ [ActivityRepository] Delete error:', error);
      throw new DatabaseError('Failed to delete activity', error);
    }
  }

  async deleteAllRead(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from(this.table)
      .delete()
      .eq('actor_id', userId)
      .eq('is_read', true)
      .select();

    if (error) {
      console.error('❌ [ActivityRepository] DeleteAllRead error:', error);
      throw new DatabaseError('Failed to delete read activities', error);
    }

    return data?.length || 0;
  }

  async bulkCreate(inputs: CreateActivityInput[]): Promise<ActivityRecord[]> {
    if (!inputs || inputs.length === 0) return [];

    const records = inputs.map((input) => ({
      actor_id: input.actor_id,
      actor_name: input.actor_name,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      action: input.action,
      title: input.title,
      description: input.description || '',
      metadata: input.metadata || {},
      importance: input.importance || 0,
      is_read: false,
      is_pinned: false,
      is_archived: false,
      workspace_id: input.workspace_id || null,
    }));

    const { data, error } = await supabase
      .from(this.table)
      .insert(records)
      .select();

    if (error) {
      console.error('❌ [ActivityRepository] BulkCreate error:', error);
      throw new DatabaseError('Failed to bulk create activities', error);
    }

    return data || [];
  }

  async archiveOld(days: number, userId: string): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { data, error } = await supabase
      .from(this.table)
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('actor_id', userId)
      .eq('is_archived', false)
      .lt('created_at', cutoff.toISOString())
      .select();

    if (error) {
      console.error('❌ [ActivityRepository] ArchiveOld error:', error);
      throw new DatabaseError('Failed to archive old activities', error);
    }

    return data?.length || 0;
  }
}