// packages/ui/src/components/ui/activity/ActivityFeedList.tsx
// Plain scrollable feed with an IntersectionObserver sentinel for
// "load more". Replaces the previous @tanstack/react-virtual based
// VirtualizedActivityList — activity feeds are paginated 20 at a time
// server-side and aren't large enough per-page to need row virtualization;
// this keeps the same infinite-scroll behavior with far less code.
"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityGroupDto, ActivityItemDto } from "@hisabche/api";
import { ActivityGroupCard } from "./ActivityGroupCard";

export interface ActivityFeedListProps {
  groups: ActivityGroupDto[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onActivityClick: (activity: ActivityItemDto, group: ActivityGroupDto) => void;
  className?: string;
}

export function ActivityFeedList({
  groups,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onActivityClick,
  className,
}: ActivityFeedListProps) {
  const { t } = useTranslation();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div
      className={cn("overflow-y-auto h-full", className)}
      role="feed"
      aria-busy={isFetchingNextPage}
      aria-label={t("activity.feedLabel", "فید فعالیت‌ها")}
    >
      <div className="space-y-1.5 md:space-y-2 p-1.5 md:p-2">
        {groups.map((group) => (
          <ActivityGroupCard
            key={`${group.entityType}-${group.entityId}`}
            group={group}
            onActivityClick={onActivityClick}
          />
        ))}
      </div>

      {(hasNextPage || isFetchingNextPage) && (
        <div ref={sentinelRef} className="flex items-center justify-center py-3 md:py-4">
          {isFetchingNextPage ? (
            <span className="flex items-center gap-2 text-[11px] md:text-xs text-[hsl(var(--fg-tertiary))]">
              <Loader2 className="size-3.5 md:size-4 animate-spin text-[hsl(var(--color-primary))]" aria-hidden="true" />
              {t("activity.loadingMore", "بارگذاری بیشتر...")}
            </span>
          ) : (
            <span className="text-[11px] md:text-xs text-[hsl(var(--fg-tertiary))]">
              {t("activity.scrollForMore", "برای بارگذاری بیشتر اسکرول کنید")}
            </span>
          )}
        </div>
      )}

      {!hasNextPage && groups.length > 0 && (
        <div className="flex items-center justify-center py-3 md:py-4">
          <span className="text-[11px] md:text-xs text-[hsl(var(--fg-tertiary))]">
            {t("activity.endOfList", "به انتهای لیست رسیدید")}
          </span>
        </div>
      )}
    </div>
  );
}

ActivityFeedList.displayName = "ActivityFeedList";
