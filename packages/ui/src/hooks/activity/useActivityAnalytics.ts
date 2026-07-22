// packages/ui/src/hooks/useActivityAnalytics.ts
"use client";

import { useEffect, useRef, useCallback } from "react";
import { apiClient } from "@hisabche/api"; // ✅ استفاده از named import

interface ActivityAnalyticsEvent {
  name: string;
  properties?: Record<string, unknown> | undefined;
  timestamp?: number | undefined;
}

type AnalyticsProvider = "ga4" | "posthog" | "mixpanel" | "custom";

export function useActivityAnalytics(provider: AnalyticsProvider = "ga4") {
  const events = useRef<ActivityAnalyticsEvent[]>([]);
  const isFlushing = useRef(false);

  const track = useCallback(
    (name: string, properties?: Record<string, unknown>) => {
      const event: ActivityAnalyticsEvent = {
        name,
        properties,
        timestamp: Date.now(),
      };

      events.current.push(event);

      if (events.current.length >= 10) {
        flush();
      }
    },
    []
  );

  const flush = useCallback(async () => {
    if (isFlushing.current || events.current.length === 0) return;

    isFlushing.current = true;
    const batch = [...events.current];
    events.current = [];

    try {
      // GA4
      if (provider === "ga4" && typeof window !== "undefined" && batch[0]) {
        // @ts-ignore
        window.gtag?.("event", batch[0].name, {
          ...batch[0].properties,
          send_to: "G-T5XG907W4R",
        });
      }

      // Console log in development
      if (process.env.NODE_ENV === "development") {
        console.log("📊 [Analytics] Events:", batch);
      }

      // ✅ استفاده از apiClient با named import
      // و حذف /v1 اضافی چون baseURL قبلاً /api/v1 دارد
      if (process.env.NODE_ENV === "production") {
        await apiClient.post("/analytics/activity", { events: batch });
      }
    } catch (error) {
      console.error("Failed to send analytics:", error);
    } finally {
      isFlushing.current = false;
    }
  }, [provider]);

  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  const trackActivityEvent = useCallback(
    (action: string, group?: any) => {
      track(`activity_${action}`, {
        entity_type: group?.entityType,
        entity_id: group?.entityId,
        has_unread: group?.hasUnread,
        unread_count: group?.unreadCount,
        priority: group?.priority,
        activity_count: group?.entitySummary?.activityCount,
      });
    },
    [track]
  );

  return {
    track,
    trackActivityEvent,
    flush,
  };
}

export const activityAnalyticsEvents = {
  OPEN_FEED: "activity_open_feed",
  CLOSE_FEED: "activity_close_feed",
  EXPAND_ENTITY: "activity_expand_entity",
  COLLAPSE_ENTITY: "activity_collapse_entity",
  MARK_READ: "activity_mark_read",
  MARK_ALL_READ: "activity_mark_all_read",
  SEARCH: "activity_search",
  FILTER: "activity_filter",
  CLICK_ACTIVITY: "activity_click",
  SCROLL: "activity_scroll",
  VIEW_ALL: "activity_view_all",
  SYNC: "activity_sync",
  LOAD_MORE: "activity_load_more",
} as const;