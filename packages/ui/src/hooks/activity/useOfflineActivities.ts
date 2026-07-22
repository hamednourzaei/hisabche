// packages/ui/src/hooks/activity/useOfflineActivities.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { database } from "@hisabche/db";
import { useActivities, activityKeys } from "@hisabche/api";
import type { ActivityGroupDto } from "@hisabche/api";

// ─── Local Activity Service ──────────────────────────────────────────────────

class OfflineActivityService {
  private static instance: OfflineActivityService;

  static getInstance() {
    if (!this.instance) {
      this.instance = new OfflineActivityService();
    }
    return this.instance;
  }

  async getLocalActivities(filters?: { type?: string; unread?: boolean }): Promise<any[]> {
    const collection = database.collections.get('activities');
    
    // ─── استفاده از any برای bypass کردن TypeScript ──────────────────────
    let query: any = collection.query();
    
    // ─── فیلتر بر اساس is_read ──────────────────────────────────────────
    if (filters?.unread !== undefined) {
      query = query.extend('is_read', filters.unread ? false : true);
    }
    
    // ─── فیلتر بر اساس entity_type ──────────────────────────────────────
    if (filters?.type) {
      query = query.extend('entity_type', filters.type);
    }
    
    // ─── مرتب‌سازی ──────────────────────────────────────────────────────
    const activities = await query
      .sortBy('created_at', 'desc')
      .fetch();
    
    return activities;
  }

  async markAsRead(ids: string[]): Promise<void> {
    await database.write(async () => {
      const collection = database.collections.get('activities');
      for (const id of ids) {
        const record = await collection.find(id);
        await record.update((item: any) => {
          item.isRead = true;
        });
      }
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await database.write(async () => {
      const collection = database.collections.get('activities');
      
      // ✅ استفاده از any برای bypass کردن TypeScript
      const activities = await (collection
        .query() as any)
        .extend('is_read', false)
        .fetch();

      for (const activity of activities) {
        await activity.update((item: any) => {
          item.isRead = true;
        });
      }
    });
  }

  async syncActivities(userId: string): Promise<void> {
    try {
      const response = await fetch(`/api/v1/activities?userId=${userId}`);
      const remoteActivities = await response.json();

      await database.write(async () => {
        const collection = database.collections.get('activities');
        const existing = await collection.query().fetch();
        const existingIds = new Set(existing.map((a: any) => a.id));

        for (const activity of remoteActivities) {
          if (!existingIds.has(activity.id)) {
            await collection.create((item: any) => {
              Object.assign(item, {
                id: activity.id,
                entityType: activity.entityType,
                entityId: activity.entityId,
                action: activity.action,
                title: activity.title,
                description: activity.description || '',
                actorId: activity.actorId,
                actorName: activity.actorName,
                metadata: activity.metadata || {},
                importance: activity.importance || 0,
                isRead: activity.isRead || false,
                isPinned: activity.isPinned || false,
                isArchived: activity.isArchived || false,
                createdAt: new Date(activity.createdAt),
                syncedAt: new Date(),
              });
            });
          }
        }
      });
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useOfflineActivities(filters?: { type?: string; unread?: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [syncStatus, setSyncStatus] = useState<{
    isSyncing: boolean;
    lastSynced: Date | null;
    pendingCount: number;
  }>({
    isSyncing: false,
    lastSynced: null,
    pendingCount: 0,
  });

  // ─── Online/Offline detection ──────────────────────────────────────────────
  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ─── Data ──────────────────────────────────────────────────────────────────
  const { data: remoteActivities = [], isLoading: remoteLoading } = useActivities(filters);

  const [localActivities, setLocalActivities] = useState<any[]>([]);
  const [localLoading, setLocalLoading] = useState(true);

  const loadLocalActivities = useCallback(async () => {
    try {
      const service = OfflineActivityService.getInstance();
      const activities = await service.getLocalActivities(filters);
      setLocalActivities(activities);
    } catch (error) {
      console.error('Failed to load local activities:', error);
    } finally {
      setLocalLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadLocalActivities();
  }, [loadLocalActivities]);

  // ─── Sync ──────────────────────────────────────────────────────────────────
  const sync = useCallback(async () => {
    if (isOffline) return;

    setSyncStatus((prev) => ({ ...prev, isSyncing: true }));

    try {
      const service = OfflineActivityService.getInstance();
      await service.syncActivities('current-user-id');

      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        lastSynced: new Date(),
      }));

      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      await loadLocalActivities();
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncStatus((prev) => ({ ...prev, isSyncing: false }));
    }
  }, [isOffline, queryClient, loadLocalActivities]);

  // ─── Auto sync ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOffline) {
      sync();
    }
  }, [isOffline, sync]);

  // ─── Periodic sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOffline) return;
    const interval = setInterval(sync, 30000);
    return () => clearInterval(interval);
  }, [isOffline, sync]);

  // ─── Merge ─────────────────────────────────────────────────────────────────
  const activities = useMemo(() => {
    if (isOffline || !remoteActivities.length) {
      return localActivities;
    }

    const merged = [...remoteActivities];
    const remoteIds = new Set(remoteActivities.map((a: any) => a.id));

    for (const local of localActivities) {
      if (!remoteIds.has(local.id)) {
        merged.push(local);
      }
    }

    return merged.sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [remoteActivities, localActivities, isOffline]);

  // ─── Mark as Read ──────────────────────────────────────────────────────────
  const markAsRead = useCallback(async (ids: string[]) => {
    try {
      const service = OfflineActivityService.getInstance();
      await service.markAsRead(ids);
      await loadLocalActivities();

      if (!isOffline) {
        await fetch('/api/v1/activities/mark-read', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, [isOffline, loadLocalActivities]);

  // ─── Mark All as Read ──────────────────────────────────────────────────────
  const markAllAsRead = useCallback(async () => {
    try {
      const service = OfflineActivityService.getInstance();
      await service.markAllAsRead('current-user-id');
      await loadLocalActivities();

      if (!isOffline) {
        await fetch('/api/v1/activities/mark-all-read', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, [isOffline, loadLocalActivities]);

  return {
    activities,
    isLoading: remoteLoading || localLoading,
    isOffline,
    syncStatus,
    sync,
    markAsRead,
    markAllAsRead,
  };
}