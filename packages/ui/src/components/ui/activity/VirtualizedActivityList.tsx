// packages/ui/src/components/ui/activity/VirtualizedActivityList.tsx
"use client";

import { useRef, useEffect, useCallback, memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useInView } from "react-intersection-observer";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EntityActivityCard } from "./EntityActivityCard";
import { ActivitySkeleton } from "./ActivitySkeleton";
import { ActivityMotion } from "./ActivityMotion";
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
  className?: string;
}

// ─── Components ──────────────────────────────────────────────────────────────

const LoaderRow = memo(function LoaderRow({
  isFetchingNextPage,
  hasNextPage,
}: {
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
}) {
  const { t } = useTranslation();

  if (isFetchingNextPage) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 md:py-4" role="status" aria-live="polite">
        <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin text-[hsl(var(--color-primary))]" aria-hidden="true" />
        <span className="text-[10px] md:text-xs text-[hsl(var(--fg-tertiary))]">
          {t("activity.loadingMore", "بارگذاری بیشتر...")}
        </span>
      </div>
    );
  }

  if (hasNextPage) {
    return (
      <div className="flex items-center justify-center py-3 md:py-4">
        <span className="text-[10px] md:text-xs text-[hsl(var(--fg-tertiary))]">
          {t("activity.scrollForMore", "برای بارگذاری بیشتر اسکرول کنید")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-3 md:py-4">
      <span className="text-[10px] md:text-xs text-[hsl(var(--fg-tertiary))]">
        {t("activity.endOfList", "به انتهای لیست رسیدید")}
      </span>
    </div>
  );
});
LoaderRow.displayName = "LoaderRow";

// ── Activity Item ─────────────────────────────────────────────

const ActivityItem = memo(function ActivityItem({
  group,
  index,
  isLast,
  onActivityClick,
  virtualSize,
  virtualStart,
  lastItemRef,
  onAnimationComplete,
}: {
  group: ActivityGroupDto;
  index: number;
  isLast: boolean;
  onActivityClick: (activity: any, group: ActivityGroupDto) => void;
  virtualSize: number;
  virtualStart: number;
  lastItemRef?: (node?: Element | null | undefined) => void;
  onAnimationComplete?: () => void;
}) {
  const { t } = useTranslation();

  const handleActivityClick = useCallback(
    (activity: any) => {
      onActivityClick(activity, group);
    },
    [onActivityClick, group]
  );

  const motionProps: {
    type: "slide";
    delay: number;
    className: string;
    onAnimationComplete?: () => void;
  } = {
    type: "slide",
    delay: Math.min(index * 20, 200),
    className: "px-0.5 py-0.5 md:py-1",
  };

  if (onAnimationComplete) {
    motionProps.onAnimationComplete = onAnimationComplete;
  }

  return (
    <ActivityMotion {...motionProps}>
      <div
        ref={isLast ? lastItemRef : undefined}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: `${virtualSize}px`,
          transform: `translateY(${virtualStart}px)`,
        }}
        className="px-0.5 py-0.5 md:py-1"
        data-activity-item
        tabIndex={0}
        role="article"
        aria-label={t("activity.itemLabel", {
          label: group.entitySummary.label,
        })}
      >
        <EntityActivityCard
          entityType={group.entityType}
          entityId={group.entityId}
          entitySummary={group.entitySummary}
          activities={group.activities}
          hasUnread={group.hasUnread}
          onActivityClick={handleActivityClick}
          compact={true}
        />
      </div>
    </ActivityMotion>
  );
});
ActivityItem.displayName = "ActivityItem";

// ─── Main Component ─────────────────────────────────────────────────────────

export const VirtualizedActivityList = memo(function VirtualizedActivityList({
  groups,
  isLoading,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
  onActivityClick,
  estimateSize = 160,
  onLoadMore,
  className,
}: VirtualizedActivityListProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const keyboardIndexRef = useRef(0);
  const [isEndAnnounced, setIsEndAnnounced] = useState(false);

  const { ref: loadMoreTriggerRef, inView } = useInView({
    rootMargin: "200px",
    threshold: 0.1,
  });

  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? groups.length + 1 : groups.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => estimateSize,
    overscan: 3,
  });

  useEffect(() => {
    keyboardIndexRef.current = 0;
  }, [groups.length]);

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
      if (onLoadMore) {
        onLoadMore();
      }
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage, onLoadMore]);

  useEffect(() => {
    if (!hasNextPage && groups.length > 0 && !isEndAnnounced) {
      const announcer = document.getElementById("activity-announcer");
      if (announcer) {
        announcer.textContent = t("activity.endOfList", "به انتهای لیست فعالیت‌ها رسیدید");
        setIsEndAnnounced(true);
      }
    }
  }, [hasNextPage, groups.length, isEndAnnounced, t]);

  useEffect(() => {
    if (hasNextPage) {
      setIsEndAnnounced(false);
    }
  }, [hasNextPage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

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

  useEffect(() => {
    const announcer = document.getElementById("activity-announcer");
    if (announcer && groups.length > 0 && !isLoading) {
      announcer.textContent = t("activity.itemsLoaded", {
        count: groups.length,
      });
    }
  }, [groups.length, isLoading, t]);

  if (isLoading && groups.length === 0) {
    return (
      <div className="space-y-1.5 md:space-y-2 p-1.5 md:p-2" role="status" aria-label={t("activity.loading", "در حال بارگذاری فعالیت‌ها")}>
        {[1, 2, 3].map((i) => (
          <ActivitySkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div
        id="activity-announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      <div
        ref={containerRef}
        className={cn(
          "overflow-y-auto scrollbar-thin scrollbar-thumb-[hsl(var(--surface-muted))] scrollbar-track-transparent",
          className
        )}
        style={{
          contain: "layout style",
          height: "100%",
          position: "relative",
        }}
        role="feed"
        aria-label={t("activity.feedLabel", "فید فعالیت‌ها")}
        aria-busy={isFetchingNextPage}
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
                  key={`loader-${virtualRow.index}`}
                  ref={loadMoreTriggerRef}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <LoaderRow isFetchingNextPage={isFetchingNextPage} hasNextPage={hasNextPage} />
                </div>
              );
            }

            if (!group) return null;

            const isLastItem = virtualRow.index === groups.length - 1;

            const activityItemProps: {
              group: ActivityGroupDto;
              index: number;
              isLast: boolean;
              onActivityClick: (activity: any, group: ActivityGroupDto) => void;
              virtualSize: number;
              virtualStart: number;
              lastItemRef?: (node?: Element | null | undefined) => void;
              onAnimationComplete?: () => void;
            } = {
              group,
              index: virtualRow.index,
              isLast: isLastItem,
              onActivityClick,
              virtualSize: virtualRow.size,
              virtualStart: virtualRow.start,
            };

            if (isLastItem) {
              activityItemProps.lastItemRef = loadMoreTriggerRef;
            }

            if (isLastItem && !hasNextPage) {
              activityItemProps.onAnimationComplete = () => {
                const announcer = document.getElementById("activity-announcer");
                if (announcer) {
                  announcer.textContent = t("activity.endOfList", "به انتهای لیست فعالیت‌ها رسیدید");
                }
              };
            }

            return <ActivityItem key={group.entityId} {...activityItemProps} />;
          })}
        </div>
      </div>
    </>
  );
});

VirtualizedActivityList.displayName = "VirtualizedActivityList";