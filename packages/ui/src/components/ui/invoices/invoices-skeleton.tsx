"use client";

import { cn } from "@/lib/utils";

const CARD_ITEMS = [1, 2, 3, 4, 5, 6] as const;

/* ═══════════════════════════════════════════════════════════════════════════
   InvoicesSkeleton v2.2 — Pixel-Perfect Match with InvoicesView
   Same layout structure, same spacing, same responsive breakpoints
   Zero CLS (Cumulative Layout Shift) when data loads
   ═══════════════════════════════════════════════════════════════════════════ */

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="skeleton-shimmer h-7 w-28 rounded-lg sm:h-8 sm:w-32 lg:h-9 lg:w-36" />
        <div className="skeleton-shimmer h-3.5 w-44 rounded-md sm:h-4 sm:w-52" />
      </div>
      <div className="skeleton-shimmer h-[44px] w-full rounded-full sm:h-10 sm:w-36" />
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="skeleton-shimmer h-[44px] w-full rounded-xl sm:h-10 sm:max-w-sm" />
      <div className="skeleton-shimmer h-[44px] w-full rounded-full sm:h-10 sm:w-24" />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[hsl(var(--border-default))]",
        "bg-[hsl(var(--surface-elevated))]",
        "p-4 sm:p-5 space-y-3 sm:space-y-4",
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
          <div className="skeleton-shimmer h-10 w-10 shrink-0 rounded-xl sm:h-11 sm:w-11" />
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="skeleton-shimmer h-4 w-16 rounded-md sm:w-20" />
            <div className="skeleton-shimmer h-3 w-12 rounded-md sm:w-16" />
          </div>
        </div>
        <div className="skeleton-shimmer h-5 w-14 shrink-0 rounded-full sm:h-5 sm:w-16" />
      </div>

      {/* Total */}
      <div className="space-y-1.5">
        <div className="skeleton-shimmer h-3 w-10 rounded-md sm:w-12" />
        <div className="skeleton-shimmer h-7 w-24 rounded-lg sm:h-8 sm:w-28" />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-1 sm:gap-1.5">
        <div className="skeleton-shimmer h-[44px] w-[44px] rounded-full sm:h-10 sm:w-10" />
        <div className="skeleton-shimmer h-[44px] w-[44px] rounded-full sm:h-10 sm:w-10" />
      </div>
    </div>
  );
}

function PaginationSkeleton() {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 pt-4">
      <div className="skeleton-shimmer h-[44px] w-20 rounded-full sm:h-10 sm:w-20" />
      <div className="skeleton-shimmer h-5 w-14 rounded-md" />
      <div className="skeleton-shimmer h-[44px] w-20 rounded-full sm:h-10 sm:w-20" />
    </div>
  );
}

export function InvoicesSkeleton() {
  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in-up">
      <HeaderSkeleton />
      <SearchSkeleton />

      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CARD_ITEMS.map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      <PaginationSkeleton />
    </div>
  );
}