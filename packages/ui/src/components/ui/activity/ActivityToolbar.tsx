// packages/ui/src/components/ui/activity/ActivityToolbar.tsx
"use client";

import { useState, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import { Check, X, Archive, Trash2, Pin, BellOff, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityToolbarProps {
  selectedCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onMarkRead: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onPin: () => void;
  onMute: () => void;
  className?: string;
}

export const ActivityToolbar = memo(function ActivityToolbar({
  selectedCount,
  onSelectAll,
  onClearSelection,
  onMarkRead,
  onArchive,
  onDelete,
  onPin,
  onMute,
  className,
}: ActivityToolbarProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const hasSelection = selectedCount > 0;

  // ─── Action Buttons ──────────────────────────────────────────
  const ActionButton = memo(function ActionButton({
    onClick,
    icon: Icon,
    label,
    destructive = false,
  }: {
    onClick: () => void;
    icon: React.ElementType;
    label: string;
    destructive?: boolean;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "p-1 md:p-1.5 rounded-lg transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:ring-offset-1",
          destructive
            ? "hover:bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]"
            : "hover:bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]",
          "min-h-[32px] min-w-[32px] md:min-h-0 md:min-w-0"
        )}
        aria-label={label}
        title={label}
      >
        <Icon className="size-3.5 md:size-4" aria-hidden="true" />
      </button>
    );
  });
  ActionButton.displayName = "ActionButton";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-xl",
        "border border-[hsl(var(--border-default))]",
        "bg-[hsl(var(--surface-elevated))]",
        "transition-all duration-200",
        hasSelection ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none",
        className
      )}
      role="toolbar"
      aria-label={t("activity.toolbar.label", "نوار ابزار فعالیت‌ها")}
    >
      {/* ─── Selection Info ────────────────────────────────────── */}
      <span className="text-[10px] md:text-xs font-medium text-[hsl(var(--fg-secondary))] whitespace-nowrap">
        {t("activity.selected", "{{count}} انتخاب شده", { count: selectedCount })}
      </span>

      <div className="w-px h-4 md:h-5 bg-[hsl(var(--border-default))]" aria-hidden="true" />

      {/* ─── Actions ───────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5">
        <ActionButton
          onClick={onMarkRead}
          icon={CheckCheck}
          label={t("activity.markRead", "علامت‌گذاری به‌عنوان خوانده‌شده")}
        />
        <ActionButton
          onClick={onArchive}
          icon={Archive}
          label={t("activity.archive", "بایگانی")}
        />
        <ActionButton
          onClick={onPin}
          icon={Pin}
          label={t("activity.pin", "سنجاق کردن")}
        />
        <ActionButton
          onClick={onMute}
          icon={BellOff}
          label={t("activity.mute", "بی‌صدا کردن")}
        />

        <div className="w-px h-4 md:h-5 bg-[hsl(var(--border-default))]" aria-hidden="true" />

        <ActionButton
          onClick={onDelete}
          icon={Trash2}
          label={t("activity.delete", "حذف")}
          destructive={true}
        />
      </div>

      <div className="flex-1" aria-hidden="true" />

      {/* ─── Clear Selection ───────────────────────────────────── */}
      <button
        type="button"
        onClick={onClearSelection}
        className="text-[10px] md:text-xs font-medium text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))] transition-colors px-1 py-1 rounded focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] min-h-[32px] min-w-[44px]"
        aria-label={t("activity.clearSelection", "لغو انتخاب")}
      >
        {t("activity.clearSelection", "لغو انتخاب")}
      </button>
    </div>
  );
});

ActivityToolbar.displayName = "ActivityToolbar";