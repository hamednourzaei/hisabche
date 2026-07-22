// packages/ui/src/components/ui/activity/ActivitySkeleton.tsx
"use client";

import { memo } from "react";

export const ActivitySkeleton = memo(function ActivitySkeleton() {
  return (
    <div className="space-y-2 p-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-3 border border-[hsl(var(--border-default))] rounded-xl animate-pulse"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[hsl(var(--surface-muted))]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-[hsl(var(--surface-muted))] rounded w-3/4" />
              <div className="h-3 bg-[hsl(var(--surface-muted))] rounded w-1/2" />
              <div className="h-3 bg-[hsl(var(--surface-muted))] rounded w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

ActivitySkeleton.displayName = "ActivitySkeleton";