"use client";

import React from "react";
import { WifiOff, Wifi, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   OfflineBanner v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   No inline styles — all classes
   ═══════════════════════════════════════════════════════════════════════════ */

export interface OfflineBannerProps {
  pendingCount: number;
  isOnline: boolean;
  isSyncing?: boolean;
}

const OfflineBanner: React.FC<OfflineBannerProps> = ({
  pendingCount,
  isOnline,
  isSyncing = false,
}) => {
  const isVisible = !isOnline || pendingCount > 0 || isSyncing;

  if (!isVisible) return null;

  // Determine which variant to show
  const variant: "offline" | "syncing" | "pending" = !isOnline
    ? "offline"
    : isSyncing
      ? "syncing"
      : "pending";

  const variantStyles: Record<
    typeof variant,
    { bg: string; fg: string; border: string; Icon: React.ElementType; iconClass: string }
  > = {
    offline: {
      bg: "bg-[hsl(var(--color-warning)/0.1)]",
      fg: "text-[hsl(var(--color-warning))]",
      border: "border-[hsl(var(--color-warning)/0.25)]",
      Icon: WifiOff,
      iconClass: "text-[hsl(var(--color-warning))]",
    },
    syncing: {
      bg: "bg-[hsl(var(--color-primary)/0.1)]",
      fg: "text-[hsl(var(--color-primary))]",
      border: "border-[hsl(var(--color-primary)/0.25)]",
      Icon: Loader2,
      iconClass: "animate-spin text-[hsl(var(--color-primary))]",
    },
    pending: {
      bg: "bg-[hsl(var(--color-success)/0.1)]",
      fg: "text-[hsl(var(--color-success))]",
      border: "border-[hsl(var(--color-success)/0.25)]",
      Icon: Wifi,
      iconClass: "text-[hsl(var(--color-success))]",
    },
  };

  const styles = variantStyles[variant];
  const Icon = styles.Icon;

  const message = (() => {
    if (!isOnline) {
      return pendingCount > 0
        ? `شما آفلاین هستید — ${pendingCount} عملیات در انتظار همگام‌سازی`
        : "شما آفلاین هستید — اطلاعات ذخیره شده قابل مشاهده است";
    }
    if (isSyncing) return "در حال همگام‌سازی...";
    return `${pendingCount} عملیات در انتظار همگام‌سازی`;
  })();

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-2",
        "px-4 py-2.5",
        "text-sm font-medium",
        "border-b",
        "transition-colors duration-300",
        "motion-reduce:transition-none",
        styles.bg,
        styles.fg,
        styles.border,
      )}
    >
      <Icon className={cn("size-4 shrink-0", styles.iconClass)} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
};

export { OfflineBanner };