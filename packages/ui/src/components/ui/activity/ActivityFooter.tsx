// packages/ui/src/components/ui/activity/ActivityFooter.tsx
"use client";

import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ArrowRight, Loader2 } from "lucide-react";

interface ActivityFooterProps {
  onViewAll: () => void;
  label?: string;
  className?: string;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export const ActivityFooter = memo(function ActivityFooter({
  onViewAll,
  label,
  className,
  loading = false,
  disabled = false,
  icon,
}: ActivityFooterProps) {
  const { t } = useTranslation();

  const handleClick = useCallback(() => {
    if (!loading && !disabled) {
      onViewAll();
    }
  }, [loading, disabled, onViewAll]);

  const displayLabel = label || t("activity.viewAll", "مشاهده همه فعالیت‌ها");

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      className={cn(
        "flex items-center justify-center gap-1 md:gap-1.5 px-3 md:px-4 py-2 md:py-2.5 text-[10px] md:text-xs font-medium",
        "text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--color-primary))]",
        "border-t border-[hsl(var(--border-default))]",
        "hover:bg-[hsl(var(--surface-muted))] transition-colors duration-150",
        "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:ring-offset-1",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "min-h-[36px] md:min-h-[44px]",
        className
      )}
      aria-label={displayLabel}
    >
      {loading ? (
        <>
          <Loader2 className="size-3 md:size-3.5 animate-spin" aria-hidden="true" />
          <span>{t("activity.loading", "بارگذاری...")}</span>
        </>
      ) : (
        <>
          <span>{displayLabel}</span>
          {icon || <ArrowRight className="size-3 md:size-3.5 rtl:rotate-180" aria-hidden="true" />}
        </>
      )}
    </button>
  );
});

ActivityFooter.displayName = "ActivityFooter";