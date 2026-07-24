// packages/ui/src/components/ui/activity/ActivityHeader.tsx
"use client";

import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Bell, CheckCheck, X, Loader2 } from "lucide-react";

interface ActivityHeaderProps {
  title?: string;
  unreadCount: number;
  onMarkAllRead: () => void;
  onClose: () => void;
  className?: string;
  isMarkingAll?: boolean;
  icon?: React.ReactNode;
  showClose?: boolean;
}

export const ActivityHeader = memo(function ActivityHeader({
  title,
  unreadCount,
  onMarkAllRead,
  onClose,
  className,
  isMarkingAll = false,
  icon,
  showClose = true,
}: ActivityHeaderProps) {
  const { t } = useTranslation();

  const displayTitle = title || t("activity.title", "فعالیت‌ها");

  const handleMarkAllRead = useCallback(() => {
    if (!isMarkingAll) {
      onMarkAllRead();
    }
  }, [isMarkingAll, onMarkAllRead]);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-4 py-3",
        "border-b border-[hsl(var(--border-default))]",
        "bg-[hsl(var(--surface-elevated)]",
        className
      )}
      role="banner"
      aria-label={displayTitle}
    >
      {/* ─── Title ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 min-w-0">
        {icon || <Bell className="size-4 text-[hsl(var(--fg-secondary))] shrink-0" aria-hidden="true" />}
        <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))] truncate">
          {displayTitle}
        </h3>
        {unreadCount > 0 && (
          <span
            className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]"
            aria-label={t("activity.unreadCount", "{{count}} مورد خوانده نشده", {
              count: unreadCount,
            })}
          >
            {unreadCount} {t("activity.new", "جدید")}
          </span>
        )}
      </div>

      {/* ─── Actions ───────────────────────────────────────────── */}
      <div className="flex items-center gap-1 shrink-0">
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={isMarkingAll}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg",
              "text-[11px] font-medium",
              "text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.1)]",
              "transition-colors duration-150",
              "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "min-h-[32px]"
            )}
            aria-label={t("activity.markAllRead", "علامت‌گذاری همه به عنوان خوانده شده")}
          >
            {isMarkingAll ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCheck className="size-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">
              {t("activity.markAllRead", "خواندن همه")}
            </span>
          </button>
        )}

        {showClose && (
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "p-1 rounded-lg",
              "text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
              "transition-colors duration-150",
              "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]",
              "min-h-[32px] min-w-[32px]"
            )}
            aria-label={t("action.close", "بستن")}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
});

ActivityHeader.displayName = "ActivityHeader";