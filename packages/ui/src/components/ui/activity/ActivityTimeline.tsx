// packages/ui/src/components/ui/activity/ActivityTimeline.tsx
"use client";

import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ActivityItem, type ActivityItemData } from "./ActivityItem";

interface ActivityTimelineProps {
  activities: ActivityItemData[];
  onActivityClick?: (activity: ActivityItemData) => void;
  className?: string;
  size?: "sm" | "md";
}

export const ActivityTimeline = memo(function ActivityTimeline({
  activities,
  onActivityClick,
  className,
  size = "md",
}: ActivityTimelineProps) {
  const { t } = useTranslation();

  if (!activities || activities.length === 0) {
    return (
      <div className="py-3 md:py-4 text-center text-xs md:text-sm text-[hsl(var(--fg-tertiary))] px-2 md:px-0">
        {t("activity.timeline.empty", "هیچ فعالیتی ثبت نشده است")}
      </div>
    );
  }

  const createClickHandler = useCallback(
    (activity: ActivityItemData) => {
      if (onActivityClick) {
        return () => onActivityClick(activity);
      }
      return undefined;
    },
    [onActivityClick]
  );

  return (
    <div className={cn("space-y-0.5 md:space-y-0.5", className)}>
      {activities.map((activity, index) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          isLast={index === activities.length - 1}
          onClick={createClickHandler(activity)}
          size={size}
        />
      ))}
    </div>
  );
});

ActivityTimeline.displayName = "ActivityTimeline";