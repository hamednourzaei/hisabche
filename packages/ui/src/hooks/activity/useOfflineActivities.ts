// packages/ui/src/hooks/activity/useOfflineActivities.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useActivities,
  useUnreadActivityCount,
  useMarkActivityAsRead,
  useMarkAllActivitiesAsRead,
  activityKeys,
  type ActivityGroupDto,
  type ActivityItemDto,
  type ActivityFilter,
} from "@hisabche/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OfflineActivity {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  description?: string;
  createdAt: string;
  isRead: boolean;
}

interface SyncStatus {
  isSyncing: boolean;
  lastSynced: Date | null;
  pendingCount: number;
}

// ─── Local Activity Service ──────────────────────────────────────────────

class OfflineActivityService {
  private static instance: OfflineActivityService;
  private storage: Map<string, OfflineActivity> = new Map();

  static getInstance(): OfflineActivityService {
    if (!this.instance) {
      this.instance = new OfflineActivityService();
    }
    return this.instance;
  }

  async getLocalActivities(): Promise<OfflineActivity[]> {
    return Array.from(this.storage.values());
  }

  async saveActivities(activities: OfflineActivity[]): Promise<void> {
    for (const activity of activities) {
      this.storage.set(activity.id, activity);
    }
  }

  async markAsRead(ids: string[]): Promise<void> {
    for (const id of ids) {
      const activity = this.storage.get(id);
      if (activity) {
        this.storage.set(id, { ...activity, isRead: true });
      }
    }
  }

  async markAllAsRead(): Promise<void> {
    for (const [id, activity] of this.storage) {
      this.storage.set(id, { ...activity, isRead: true });
    }
  }

  async syncFromRemote(remoteActivities: ActivityGroupDto[]): Promise<void> {
    const flatActivities: OfflineActivity[] = [];
    for (const group of remoteActivities) {
      for (const activity of group.activities) {
        flatActivities.push({
          id: activity.id,
          entityType: group.entityType,
          entityId: group.entityId,
          title: activity.title,
          ...(activity.description && { description: activity.description }),
          createdAt: activity.timestamp || new Date().toISOString(),
          isRead: activity.isRead ?? false,
        });
      }
    }
    await this.saveActivities(flatActivities);
  }

  async getUnreadCount(): Promise<number> {
    let count = 0;
    for (const activity of this.storage.values()) {
      if (!activity.isRead) count++;
    }
    return count;
  }

  async clearAll(): Promise<void> {
    this.storage.clear();
  }
}

// ─── Convert OfflineActivity to ActivityGroupDto ───────────────────────────

function offlineToGroupDto(offlineActivities: OfflineActivity[]): ActivityGroupDto[] {
  const groupMap = new Map<string, ActivityGroupDto>();

  for (const activity of offlineActivities) {
    const key = `${activity.entityType}:${activity.entityId}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        entityType: activity.entityType,
        entityId: activity.entityId,
        entitySummary: {
          label: activity.title,
          subtitle: activity.description || "",
          activityCount: 0,
          lastActivity: activity.createdAt,
        },
        activities: [],
        unreadCount: 0,
        priority: "medium",
        latestAt: activity.createdAt,
        hasUnread: false,
      });
    }

    const group = groupMap.get(key)!;
    const activityItem: ActivityItemDto = {
      id: activity.id,
      action: "created",
      title: activity.title,
      actor: "System",
      timestamp: activity.createdAt,
      isRead: activity.isRead,
      importance: 1,
      ...(activity.description && { description: activity.description }),
    };
    group.activities.push(activityItem);

    if (!activity.isRead) {
      group.unreadCount++;
      group.hasUnread = true;
    }

    group.entitySummary.activityCount = group.activities.length;
  }

  return Array.from(groupMap.values());
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseOfflineActivitiesOptions {
  filters?: ActivityFilter;
  enableAutoSync?: boolean;
  syncInterval?: number;
}

interface UseOfflineActivitiesResult {
  activities: ActivityGroupDto[];
  isLoading: boolean;
  isOffline: boolean;
  syncStatus: SyncStatus;
  sync: () => Promise<void>;
  markAsRead: (ids: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  unreadCount: number;
  clearLocalCache: () => Promise<void>;
}

export function useOfflineActivities(
  options: UseOfflineActivitiesOptions = {}
): UseOfflineActivitiesResult {
  const { filters, enableAutoSync = true, syncInterval = 30000 } = options;

  const queryClient = useQueryClient();

  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSynced: null,
    pendingCount: 0,
  });

  const [localActivities, setLocalActivities] = useState<OfflineActivity[]>([]);
  const [localLoading, setLocalLoading] = useState(true);

  const {
    data: remoteActivities = [],
    isLoading: remoteLoading,
    refetch,
  } = useActivities(filters);

  const { data: remoteUnreadCount = 0 } = useUnreadActivityCount();

  const { mutateAsync: markAsReadApi } = useMarkActivityAsRead();
  const { mutateAsync: markAllAsReadApi } = useMarkAllActivitiesAsRead();

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const loadLocalActivities = useCallback(async () => {
    try {
      const service = OfflineActivityService.getInstance();
      const activities = await service.getLocalActivities();
      setLocalActivities(activities);

      const unreadCount = await service.getUnreadCount();
      setSyncStatus((prev) => ({ ...prev, pendingCount: unreadCount }));
    } catch (error) {
      console.error("Failed to load local activities:", error);
    } finally {
      setLocalLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLocalActivities();
  }, [loadLocalActivities]);

  const sync = useCallback(async (): Promise<void> => {
    if (isOffline) {
      console.log("📡 [Offline] Skipping sync - offline mode");
      return;
    }

    if (syncStatus.isSyncing) {
      console.log("📡 [Offline] Sync already in progress");
      return;
    }

    setSyncStatus((prev) => ({ ...prev, isSyncing: true }));

    try {
      const result = await refetch();
      const activities = result.data || [];

      const service = OfflineActivityService.getInstance();
      await service.syncFromRemote(activities);

      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        lastSynced: new Date(),
      }));

      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.unread() });

      await loadLocalActivities();

      console.log("✅ [Offline] Sync completed successfully");
    } catch (error) {
      console.error("❌ [Offline] Sync failed:", error);
      setSyncStatus((prev) => ({ ...prev, isSyncing: false }));
    }
  }, [isOffline, syncStatus.isSyncing, refetch, queryClient, loadLocalActivities]);

  const clearLocalCache = useCallback(async (): Promise<void> => {
    try {
      const service = OfflineActivityService.getInstance();
      await service.clearAll();
      await loadLocalActivities();
      console.log("🗑️ [Offline] Local cache cleared");
    } catch (error) {
      console.error("Failed to clear local cache:", error);
    }
  }, [loadLocalActivities]);

  const markAsRead = useCallback(
    async (ids: string[]): Promise<void> => {
      if (!ids || ids.length === 0) return;

      try {
        const service = OfflineActivityService.getInstance();
        await service.markAsRead(ids);
        await loadLocalActivities();

        if (!isOffline) {
          await markAsReadApi(ids);
          queryClient.invalidateQueries({ queryKey: activityKeys.all });
          queryClient.invalidateQueries({ queryKey: activityKeys.unread() });
        }
      } catch (error) {
        console.error("Failed to mark as read:", error);
        await loadLocalActivities();
      }
    },
    [isOffline, loadLocalActivities, queryClient, markAsReadApi]
  );

  const markAllAsRead = useCallback(async (): Promise<void> => {
    try {
      const service = OfflineActivityService.getInstance();
      await service.markAllAsRead();
      await loadLocalActivities();

      if (!isOffline) {
        await markAllAsReadApi();
        queryClient.invalidateQueries({ queryKey: activityKeys.all });
        queryClient.invalidateQueries({ queryKey: activityKeys.unread() });
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      await loadLocalActivities();
    }
  }, [isOffline, loadLocalActivities, queryClient, markAllAsReadApi]);

  useEffect(() => {
    if (enableAutoSync && !isOffline) {
      sync();
    }
  }, [isOffline, sync, enableAutoSync]);

  useEffect(() => {
    if (!enableAutoSync || isOffline) return;

    const interval = setInterval(sync, syncInterval);
    return () => clearInterval(interval);
  }, [isOffline, sync, syncInterval, enableAutoSync]);

  const activities = useMemo((): ActivityGroupDto[] => {
    if (isOffline || remoteActivities.length === 0) {
      return offlineToGroupDto(localActivities);
    }

    const remoteIds = new Set(
      remoteActivities.flatMap((g) => g.activities.map((a) => a.id))
    );

    const uniqueLocal = localActivities.filter((local) => !remoteIds.has(local.id));
    const localGroups = offlineToGroupDto(uniqueLocal);

    return [...remoteActivities, ...localGroups];
  }, [remoteActivities, localActivities, isOffline]);

  const unreadCount = useMemo(() => {
    if (isOffline) {
      return syncStatus.pendingCount;
    }
    return remoteUnreadCount;
  }, [isOffline, syncStatus.pendingCount, remoteUnreadCount]);

  return {
    activities,
    isLoading: remoteLoading || localLoading,
    isOffline,
    syncStatus,
    sync,
    markAsRead,
    markAllAsRead,
    unreadCount,
    clearLocalCache,
  };
}