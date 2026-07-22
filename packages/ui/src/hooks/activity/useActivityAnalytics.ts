// packages/ui/src/hooks/activity/useActivityAnalytics.ts
"use client";

import { useCallback } from "react";

type AnalyticsProvider = "ga4" | "posthog" | "mixpanel" | "custom";

export function useActivityAnalytics(provider: AnalyticsProvider = "ga4") {
  // ─── Track ──────────────────────────────────────────────────────────────
  const track = useCallback((name: string, properties?: Record<string, unknown>) => {
    // ✅ فقط در Development لاگ کن
    if (process.env.NODE_ENV === "development") {
      console.log(`📊 [Analytics] ${name}`, properties);
    }

    // ✅ GA4 در Production (اگر موجود باشد)
    if (process.env.NODE_ENV === "production" && typeof window !== "undefined") {
      try {
        // @ts-ignore
        window.gtag?.("event", name, {
          ...properties,
          send_to: "G-T5XG907W4R",
        });
      } catch {
        // Ignore GA4 errors
      }
    }
  }, []);

  // ─── Flush ──────────────────────────────────────────────────────────────
  const flush = useCallback(async () => {
    // ✅ هیچ کاری نکن (Analytics غیرفعال)
  }, []);

  // ─── Track Activity Event ──────────────────────────────────────────────
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