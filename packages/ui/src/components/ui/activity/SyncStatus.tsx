// packages/ui/src/components/ui/activity/SyncStatus.tsx
"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Cloud, CloudOff, RefreshCw, CheckCircle2 } from "lucide-react";

interface SyncStatusProps {
  isOnline: boolean;
  isSyncing: boolean;
  lastSynced: Date | null;
  pendingCount: number;
  onSync: () => void;
  className?: string;
}

export const SyncStatus = memo(function SyncStatus({
  isOnline,
  isSyncing,
  lastSynced,
  pendingCount,
  onSync,
  className,
}: SyncStatusProps) {
  if (!isOnline) {
    return (
      <span className={cn("flex items-center gap-1.5 text-[10px] text-[hsl(var(--color-warning))]", className)}>
        <CloudOff className="size-3.5" />
        آفلاین
        {pendingCount > 0 && (
          <span className="px-1.5 py-0.5 bg-[hsl(var(--color-warning)/0.1)] rounded">
            {pendingCount}
          </span>
        )}
      </span>
    );
  }

  if (isSyncing) {
    return (
      <span className={cn("flex items-center gap-1.5 text-[10px] text-[hsl(var(--fg-tertiary))]", className)}>
        <RefreshCw className="size-3.5 animate-spin" />
        همگام‌سازی...
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onSync}
      className={cn(
        "flex items-center gap-1.5 text-[10px] text-[hsl(var(--fg-tertiary))]",
        "hover:text-[hsl(var(--fg-primary))] transition-colors",
        className
      )}
    >
      <Cloud className="size-3.5" />
      {lastSynced
        ? `${new Date(lastSynced).toLocaleTimeString("fa-AF", {
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : "همگام‌سازی"}
    </button>
  );
});

SyncStatus.displayName = "SyncStatus";