// packages/ui/src/components/ui/activity/SyncStatus.tsx
"use client";

import { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

interface SyncStatusProps {
  isOnline: boolean;
  isSyncing: boolean;
  lastSynced: Date | null;
  pendingCount: number;
  onSync: () => void;
  className?: string;
  showLabel?: boolean;
  showTimestamp?: boolean;
  compact?: boolean;
}

export const SyncStatus = memo(function SyncStatus({
  isOnline,
  isSyncing,
  lastSynced,
  pendingCount,
  onSync,
  className,
  showLabel = true,
  showTimestamp = true,
  compact = false,
}: SyncStatusProps) {
  const { t } = useTranslation();

  // ─── Format last synced time ──────────────────────────────────────────────
  const formattedTime = useMemo(() => {
    if (!lastSynced) return null;
    try {
      return new Date(lastSynced).toLocaleTimeString("fa-AF", {
        hour: "2-digit",
        minute: "2-digit",
        ...(!compact && { second: "2-digit" }),
      });
    } catch {
      return null;
    }
  }, [lastSynced, compact]);

  // ─── Handle sync click ────────────────────────────────────────────────────
  const handleSync = useCallback(() => {
    if (!isSyncing && isOnline) {
      onSync();
    }
  }, [isSyncing, isOnline, onSync]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  // ── Offline state ────────────────────────────────────────────
  if (!isOnline) {
    return (
      <span
        className={cn(
          "flex items-center gap-1.5 text-xs",
          "text-[hsl(var(--color-warning))]",
          className
        )}
        role="status"
        aria-live="polite"
      >
        <CloudOff className="size-3.5 shrink-0" aria-hidden="true" />
        {showLabel && (
          <span className={cn(compact && "hidden sm:inline")}>
            {t("sync.offline", "آفلاین")}
          </span>
        )}
        {pendingCount > 0 && (
          <span
            className={cn(
              "px-1.5 py-0.5 bg-[hsl(var(--color-warning)/0.1)] rounded text-[9px] font-medium",
              compact && "text-[8px]"
            )}
          >
            {pendingCount}
          </span>
        )}
      </span>
    );
  }

  // ── Syncing state ────────────────────────────────────────────
  if (isSyncing) {
    return (
      <span
        className={cn(
          "flex items-center gap-1.5 text-xs",
          "text-[hsl(var(--fg-tertiary))]",
          className
        )}
        role="status"
        aria-live="polite"
      >
        <RefreshCw className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
        {showLabel && (
          <span className={cn(compact && "hidden sm:inline")}>
            {t("sync.syncing", "همگام‌سازی...")}
          </span>
        )}
      </span>
    );
  }

  // ── Synced state ─────────────────────────────────────────────
  return (
    <button
      type="button"
      onClick={handleSync}
      className={cn(
        "flex items-center gap-1.5 text-xs",
        "text-[hsl(var(--fg-tertiary))]",
        "hover:text-[hsl(var(--fg-primary))] transition-colors duration-150",
        "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:ring-offset-1 rounded",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      disabled={!isOnline}
      aria-label={t("sync.syncNow", "همگام‌سازی")}
    >
      <Cloud className="size-3.5 shrink-0" aria-hidden="true" />

      {showLabel && (
        <span className={cn(compact && "hidden sm:inline")}>
          {t("sync.sync", "همگام‌سازی")}
        </span>
      )}

      {showTimestamp && formattedTime && (
        <span
          className={cn(
            "text-[9px] opacity-70",
            compact && "hidden sm:inline"
          )}
        >
          • {formattedTime}
        </span>
      )}

      {pendingCount > 0 && (
        <span
          className={cn(
            "px-1.5 py-0.5 bg-[hsl(var(--color-info)/0.1)] text-[hsl(var(--color-info))] rounded text-[9px] font-medium",
            compact && "text-[8px]"
          )}
        >
          {pendingCount}
        </span>
      )}
    </button>
  );
});

SyncStatus.displayName = "SyncStatus";