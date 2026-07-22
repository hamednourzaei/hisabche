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

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl",
        "border border-[hsl(var(--border-default))]",
        "bg-[hsl(var(--surface-elevated))]",
        "transition-all duration-200",
        hasSelection ? "opacity-100" : "opacity-0 pointer-events-none",
        className
      )}
    >
      {/* ─── Selection Info ────────────────────────────────────── */}
      <span className="text-xs font-medium text-[hsl(var(--fg-secondary))]">
        {t("activity.selected", { count: selectedCount })}
      </span>

      <div className="w-px h-5 bg-[hsl(var(--border-default))]" />

      {/* ─── Actions ───────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onMarkRead}
          className="p-1.5 rounded-lg hover:bg-[hsl(var(--surface-muted))] transition-colors"
          title={t("activity.markRead", "علامت‌گذاری به‌عنوان خوانده‌شده")}
        >
          <CheckCheck className="size-4 text-[hsl(var(--fg-secondary))]" />
        </button>

        <button
          type="button"
          onClick={onArchive}
          className="p-1.5 rounded-lg hover:bg-[hsl(var(--surface-muted))] transition-colors"
          title={t("activity.archive", "بایگانی")}
        >
          <Archive className="size-4 text-[hsl(var(--fg-secondary))]" />
        </button>

        <button
          type="button"
          onClick={onPin}
          className="p-1.5 rounded-lg hover:bg-[hsl(var(--surface-muted))] transition-colors"
          title={t("activity.pin", "سنجاق کردن")}
        >
          <Pin className="size-4 text-[hsl(var(--fg-secondary))]" />
        </button>

        <button
          type="button"
          onClick={onMute}
          className="p-1.5 rounded-lg hover:bg-[hsl(var(--surface-muted))] transition-colors"
          title={t("activity.mute", "بی‌صدا کردن")}
        >
          <BellOff className="size-4 text-[hsl(var(--fg-secondary))]" />
        </button>

        <div className="w-px h-5 bg-[hsl(var(--border-default))]" />

        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-lg hover:bg-[hsl(var(--color-destructive)/0.1)] transition-colors"
          title={t("activity.delete", "حذف")}
        >
          <Trash2 className="size-4 text-[hsl(var(--color-destructive))]" />
        </button>
      </div>

      <div className="flex-1" />

      {/* ─── Clear Selection ───────────────────────────────────── */}
      <button
        type="button"
        onClick={onClearSelection}
        className="text-xs font-medium text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))] transition-colors"
      >
        {t("activity.clearSelection", "لغو انتخاب")}
      </button>
    </div>
  );
});

ActivityToolbar.displayName = "ActivityToolbar";