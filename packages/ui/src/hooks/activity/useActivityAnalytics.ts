// packages/ui/src/hooks/useActivityAnalytics.ts
"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface ActivityAnalyticsEvent {
  name: string;
  properties?: Record<string, unknown> | undefined;
  timestamp?: number | undefined;
}

type AnalyticsProvider = "ga4" | "posthog" | "mixpanel" | "custom";

export function useActivityAnalytics(provider: AnalyticsProvider = "ga4") {
  const events = useRef<ActivityAnalyticsEvent[]>([]);
  const isFlushing = useRef(false);

  // ─── Track event ─────────────────────────────────────────────────────────
  const track = useCallback(
    (name: string, properties?: Record<string, unknown>) => {
      const event: ActivityAnalyticsEvent = {
        name,
        properties,
        timestamp: Date.now(),
      };

      events.current.push(event);

      // ─── Flush if more than 10 events ──────────────────────────────────
      if (events.current.length >= 10) {
        flush();
      }
    },
    []
  );

  // ─── Flush events ────────────────────────────────────────────────────────
  const flush = useCallback(async () => {
    if (isFlushing.current || events.current.length === 0) return;

    isFlushing.current = true;
    const batch = [...events.current];
    events.current = [];

    try {
      // ─── Send to analytics provider ────────────────────────────────────
      if (provider === "ga4" && typeof window !== "undefined" && batch[0]) {
        // @ts-ignore
        window.gtag?.("event", batch[0].name, {
          ...batch[0].properties,
          send_to: "G-T5XG907W4R",
        });
      }

      // ─── Log to console in development ─────────────────────────────────
      if (process.env.NODE_ENV === "development") {
        console.log("📊 [Analytics] Events:", batch);
      }

      // ─── Send to API ──────────────────────────────────────────────────
      await fetch("/api/analytics/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: batch }),
      });
    } catch (error) {
      console.error("Failed to send analytics:", error);
    } finally {
      isFlushing.current = false;
    }
  }, [provider]);

  // ─── Auto flush on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  // ─── Track activity events ──────────────────────────────────────────────
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

// ─── باگ‌های Analytics ─────────────────────────────────────────────────────

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