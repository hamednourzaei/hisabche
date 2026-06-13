"use client";

import React from "react";
import { CloudOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   OfflineQueue v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   ═══════════════════════════════════════════════════════════════════════════ */

export interface OfflineQueueProps {
  pendingCount: number;
  isSyncing?: boolean;
  onSync?: () => void;
}

const OfflineQueue: React.FC<OfflineQueueProps> = ({
  pendingCount,
  isSyncing = false,
  onSync,
}) => {
  if (pendingCount === 0 && !isSyncing) return null;

  return (
    <div
      className="fixed bottom-24 start-1/2 z-40 -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={onSync}
        disabled={isSyncing}
        aria-label={`${pendingCount} عملیات در انتظار همگام‌سازی`}
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-2.5",
          "text-sm font-medium",
          "shadow-lg",
          "transition-all duration-200",
          "motion-reduce:transition-none",
          // Colors
          "bg-[hsl(var(--color-warning))]",
          "text-[hsl(var(--color-warning-fg))]",
          // States
          "hover:brightness-105",
          "active:scale-95",
          "disabled:opacity-70 disabled:cursor-wait",
        )}
      >
        {isSyncing ? (
          <Loader2
            className="size-4 animate-spin"
            aria-hidden="true"
          />
        ) : (
          <CloudOff className="size-4" aria-hidden="true" />
        )}
        {isSyncing
          ? "در حال همگام‌سازی..."
          : `${pendingCount} عملیات در انتظار`}
      </button>
    </div>
  );
};

export { OfflineQueue };