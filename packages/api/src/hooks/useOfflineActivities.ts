// packages/ui/src/hooks/activity/useOfflineActivities.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
// ❌ حذف import از @hisabche/db
// import { database } from "@hisabche/db";
import { useActivities, activityKeys } from "@hisabche/api";
import type { ActivityGroupDto } from "@hisabche/api";

// ─── Local Activity Service (بدون WatermelonDB) ──────────────────────────

class OfflineActivityService {
  private static instance: OfflineActivityService;
  private storage: Map<string, any> = new Map();

  static getInstance() {
    if (!this.instance) {
      this.instance = new OfflineActivityService();
    }
    return this.instance;
  }

  async getLocalActivities(filters?: { type?: string; unread?: boolean }): Promise<any[]> {
    // TODO: با IndexedDB جایگزین کنید
    return [];
  }

  async markAsRead(ids: string[]): Promise<void> {
    // TODO: با IndexedDB جایگزین کنید
  }

  async markAllAsRead(userId: string): Promise<void> {
    // TODO: با IndexedDB جایگزین کنید
  }

  async syncActivities(userId: string): Promise<void> {
    // TODO: با IndexedDB جایگزین کنید
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

  useEffect(() => {
    if (!isOffline) {
      sync();
    }
  }, [isOffline, sync]);

  useEffect(() => {
    if (isOffline) return;
    const interval = setInterval(sync, 30000);
    return () => clearInterval(interval);
  }, [isOffline, sync]);

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