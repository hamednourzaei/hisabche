// packages/ui/src/components/ui/activity/ActivityEmptyState.tsx
"use client";

import { memo } from "react";
import { Inbox } from "lucide-react";

interface ActivityEmptyStateProps {
  title: string;
  subtitle: string;
}

export const ActivityEmptyState = memo(function ActivityEmptyState({
  title,
  subtitle,
}: ActivityEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-[hsl(var(--surface-muted))] flex items-center justify-center mb-4">
        <Inbox className="w-8 h-8 text-[hsl(var(--fg-tertiary))]" />
      </div>
      <h4 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">{title}</h4>
      <p className="text-sm text-[hsl(var(--fg-tertiary))] mt-1">{subtitle}</p>
    </div>
  );
});

ActivityEmptyState.displayName = "ActivityEmptyState";