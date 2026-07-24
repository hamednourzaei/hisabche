// packages/ui/src/components/ui/activity/VirtualizedActivityList.tsx
"use client";

import { useRef, useEffect, useCallback, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useInView } from "react-intersection-observer";
import { EntityActivityCard } from "./EntityActivityCard";
import { ActivitySkeleton } from "./ActivitySkeleton";
import { ActivityMotion } from "./ActivityMotion";
import { useMotionDuration } from "../../../lib/activity/motion";
import type { ActivityGroupDto } from "@hisabche/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VirtualizedActivityListProps {
  groups: ActivityGroupDto[];
  isLoading: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
  onActivityClick: (activity: any, group: ActivityGroupDto) => void;
  estimateSize?: number;
  onLoadMore?: (() => void) | undefined;
}

// ─── Components ──────────────────────────────────────────────────────────────

const LoaderRow = memo(function LoaderRow({
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
}: {
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onLoadMore?: (() => void) | undefined;
}) {
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && onLoadMore) {
      onLoadMore();
    }
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  return (
    <div className="flex items-center justify-center py-4">
      {isFetchingNextPage ? (
        <div className="flex items-center gap-2 text-[hsl(var(--fg-tertiary))]">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--color-primary))] border-t-transparent" />
          <span className="text-xs">بارگذاری بیشتر...</span>
        </div>
      ) : hasNextPage ? (
        <span className="text-xs text-[hsl(var(--fg-tertiary))]">
          برای بارگذاری بیشتر اسکرول کنید
        </span>
      ) : null}
    </div>
  );
});
LoaderRow.displayName = "LoaderRow";

// ─── Main Component ─────────────────────────────────────────────────────────

export const VirtualizedActivityList = memo(function VirtualizedActivityList({
  groups,
  isLoading,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
  onActivityClick,
  estimateSize = 180,
  onLoadMore,
}: VirtualizedActivityListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ref: lastItemRef, inView } = useInView({
    rootMargin: "200px",
    threshold: 0.1,
  });

  const motionDuration = useMotionDuration("fast");

  // ─── Virtualizer ──────────────────────────────────────────────────────────
  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? groups.length + 1 : groups.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => estimateSize,
    overscan: 5,
  });

  // ─── Auto-fetch next page ──────────────────────────────────────────────
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
      onLoadMore?.();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage, onLoadMore]);

  const keyboardIndexRef = useRef(0);

  // ─── Keyboard navigation ────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = keyboardIndexRef.current;
      let newIndex = currentIndex;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        newIndex = Math.min(currentIndex + 1, groups.length - 1);
        rowVirtualizer.scrollToIndex(newIndex, { align: "center" });
      }

      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        newIndex = Math.max(currentIndex - 1, 0);
        rowVirtualizer.scrollToIndex(newIndex, { align: "center" });
      }

      if (e.key === "Home") {
        e.preventDefault();
        newIndex = 0;
        rowVirtualizer.scrollToIndex(0, { align: "start" });
      }

      if (e.key === "End") {
        e.preventDefault();
        newIndex = groups.length - 1;
        rowVirtualizer.scrollToIndex(groups.length - 1, { align: "end" });
      }

      keyboardIndexRef.current = newIndex;
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [rowVirtualizer, groups.length]);

  // ─── Announce count to screen readers ────────────────────────────────────
  useEffect(() => {
    const announcer = document.getElementById("activity-announcer");
    if (announcer && groups.length > 0) {
      announcer.textContent = `${groups.length} فعالیت نمایش داده شده است`;
    }
  }, [groups.length]);

  // ─── Render ──────────────────────────────────────────────────────────────
  if (isLoading && groups.length === 0) {
    return (
      <div className="space-y-2 p-2" role="status" aria-label="در حال بارگذاری فعالیت‌ها">
        {[1, 2, 3].map((i) => (
          <ActivitySkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* ─── Screen Reader Announcer ──────────────────────────────────────── */}
      <div
        id="activity-announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      <div
        ref={containerRef}
        className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-[hsl(var(--surface-muted))] scrollbar-track-transparent"
        style={{ contain: "strict" }}
        role="feed"
        aria-label="فید فعالیت‌ها"
        aria-busy={isLoading}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const isLoaderRow = virtualRow.index > groups.length - 1;
            const group = groups[virtualRow.index];

            if (isLoaderRow) {
              return (
                <div
                  key={virtualRow.index}
                  ref={lastItemRef}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <LoaderRow
                    isFetchingNextPage={isFetchingNextPage}
                    hasNextPage={hasNextPage}
                    onLoadMore={onLoadMore}
                  />
                </div>
              );
            }

            if (!group) return null;

            const isLastItem = virtualRow.index === groups.length - 1;

            return (
              <ActivityMotion
                key={group.entityId}
                type="slide"
                delay={Math.min(virtualRow.index * 20, 200)}
                className="px-0.5 py-1"
                onAnimationComplete={() => {
                  if (isLastItem && !hasNextPage) {
                    // Announce end of list
                    const announcer = document.getElementById("activity-announcer");
                    if (announcer) {
                      announcer.textContent = "به انتهای لیست فعالیت‌ها رسیدید";
                    }
                  }
                }}
              >
                <div
                  ref={isLastItem ? lastItemRef : undefined}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="px-0.5 py-1"
                  data-activity-item
                  tabIndex={0}
                  role="article"
                  aria-label={`فعالیت ${group.entitySummary.label}`}
                  aria-describedby={`activity-desc-${group.entityId}`}
                >
                  {/* ✅ FIX: pass entitySummary and activities straight from
                      the group — this data already came from the
                      /v1/activities response and is complete. Previously
                      EntityActivityCard fetched these itself via
                      useEntitySummary/useEntityActivities against a
                      separate endpoint that failed, causing it to render
                      null while this reserved slot stayed empty. */}
                  <EntityActivityCard
                    entityType={group.entityType}
                    entityId={group.entityId}
                    entitySummary={group.entitySummary}
                    activities={group.activities}
                    hasUnread={group.hasUnread}
                    onActivityClick={(activity) => onActivityClick(activity, group)}
                    compact={true}
                  />
                </div>
              </ActivityMotion>
            );
          })}
        </div>
      </div>
    </>
  );
});

VirtualizedActivityList.displayName = "VirtualizedActivityList";