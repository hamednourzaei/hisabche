// packages/ui/src/components/ui/accounting/AccountingSkeleton.tsx
"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

interface AccountingSkeletonProps {
  rows?: number;
  className?: string;
}

export const AccountingSkeleton = memo(function AccountingSkeleton({
  rows = 6,
  className,
}: AccountingSkeletonProps) {
  return (
    <div className={cn("space-y-1.5 md:space-y-2 p-2 md:p-3", className)} role="status" aria-label="در حال بارگذاری">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-9 md:h-10 lg:h-11 rounded-lg bg-[hsl(var(--surface-muted))] animate-pulse"
          style={{ animationDelay: `${Math.min(i * 40, 200)}ms` }}
        />
      ))}
    </div>
  );
});
