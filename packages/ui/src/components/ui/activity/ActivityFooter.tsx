// packages/ui/src/components/ui/activity/ActivityFooter.tsx
"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

interface ActivityFooterProps {
  onViewAll: () => void;
  label?: string;
  className?: string;
}

export const ActivityFooter = memo(function ActivityFooter({
  onViewAll,
  label = "مشاهده همه فعالیت‌ها",
  className,
}: ActivityFooterProps) {
  return (
    <button
      type="button"
      onClick={onViewAll}
      className={cn(
        "flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium",
        "text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--color-primary))]",
        "border-t border-[hsl(var(--border-default))]",
        "hover:bg-[hsl(var(--surface-muted))] transition-colors duration-150",
        className
      )}
    >
      {label}
      <ArrowRight className="size-3.5 rtl:rotate-180" />
    </button>
  );
});

ActivityFooter.displayName = "ActivityFooter";