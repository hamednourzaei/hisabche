// packages/ui/src/components/ui/activity/ActivitySkeleton.tsx
"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

interface ActivitySkeletonProps {
  count?: number;
  className?: string;
  variant?: "card" | "item";
}

export const ActivitySkeleton = memo(function ActivitySkeleton({
  count = 3,
  className,
  variant = "card",
}: ActivitySkeletonProps) {
  const isCard = variant === "card";

  return (
    <div className={cn("space-y-2 p-2", className)} role="status" aria-label="در حال بارگذاری فعالیت‌ها">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "border border-[hsl(var(--border-default))] rounded-xl",
            "animate-pulse",
            isCard ? "p-3" : "p-2"
          )}
        >
          <div className={cn(
            "flex items-start gap-3",
            !isCard && "gap-2"
          )}>
            {/* Icon placeholder */}
            <div
              className={cn(
                "rounded-full bg-[hsl(var(--surface-muted))] shrink-0",
                isCard ? "w-10 h-10" : "w-6 h-6"
              )}
            />

            <div className="flex-1 space-y-2">
              {/* Title */}
              <div
                className={cn(
                  "bg-[hsl(var(--surface-muted))] rounded",
                  isCard ? "h-4 w-3/4" : "h-3 w-2/3"
                )}
              />

              {/* Subtitle */}
              {isCard && (
                <div className="h-3 bg-[hsl(var(--surface-muted))] rounded w-1/2" />
              )}

              {/* Footer info */}
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "bg-[hsl(var(--surface-muted))] rounded",
                    isCard ? "h-3 w-16" : "h-2 w-12"
                  )}
                />
                <div
                  className={cn(
                    "bg-[hsl(var(--surface-muted))] rounded",
                    isCard ? "h-3 w-12" : "h-2 w-10"
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

ActivitySkeleton.displayName = "ActivitySkeleton";