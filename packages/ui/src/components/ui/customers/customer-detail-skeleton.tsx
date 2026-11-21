'use client'

import { Skeleton } from '../skeleton'

/**
 * The shape of the customer profile while it loads — the same layout the view
 * draws (owner-approved mockup, 21 Nov 2026): identity, balance hero, KPIs and
 * aging in a rail that becomes sticky beside the tabs from 1200px.
 */
export function CustomerDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-5 min-[1200px]:grid min-[1200px]:grid-cols-[344px_minmax(0,1fr)] min-[1200px]:grid-rows-[auto_minmax(0,1fr)] min-[1200px]:gap-[18px]">
      <div className="contents min-[1200px]:col-start-1 min-[1200px]:row-span-2 min-[1200px]:row-start-1 min-[1200px]:grid min-[1200px]:gap-4 min-[1200px]:self-start">
        {/* Identity */}
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-44 rounded-lg" />
              <Skeleton className="h-4 w-32 rounded-md" />
            </div>
          </div>
          <Skeleton className="mt-3 h-4 w-full rounded-md" />
        </div>

        {/* Balance hero */}
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 space-y-3">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-9 w-52 rounded-lg" />
          <div className="grid grid-cols-2 gap-2.5">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        </div>

        {/* KPIs */}
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3.5">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 min-[1200px]:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[76px] rounded-xl" />
            ))}
          </div>
        </div>

        {/* Aging */}
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 space-y-3">
          <Skeleton className="h-4 w-40 rounded-md" />
          <Skeleton className="h-2.5 w-full rounded-full" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>

      {/* Actions */}
      <div className="hidden items-center gap-2 md:flex min-[1200px]:col-start-2 min-[1200px]:row-start-1">
        <Skeleton className="h-10 w-32 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>

      {/* Tabs + statement rows */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 space-y-4 min-[1200px]:col-start-2 min-[1200px]:row-start-2">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
