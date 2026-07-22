// packages/ui/src/components/ui/activity/ActivityHeader.tsx
"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Bell, CheckCheck, X } from "lucide-react";

interface ActivityHeaderProps {
  title: string;
  unreadCount: number;
  onMarkAllRead: () => void;
  onClose: () => void;
  className?: string;
}

export const ActivityHeader = memo(function ActivityHeader({
  title,
  unreadCount,
  onMarkAllRead,
  onClose,
  className,
}: ActivityHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-4 py-3 border-b border-[hsl(var(--border-default))]",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {title}
        </h3>
        {unreadCount > 0 && (
          <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]">
            {unreadCount} جدید
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.1)] transition-colors"
          >
            <CheckCheck className="size-3.5" />
            خواندن همه
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors"
          aria-label="بستن"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
});

ActivityHeader.displayName = "ActivityHeader";