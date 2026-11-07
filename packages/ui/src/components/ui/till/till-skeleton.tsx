'use client'

import { Skeleton } from '../skeleton'

export function TillSkeleton() {
  return (
    <div className="space-y-6">
      {/* ── Top Bar ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-4 w-52 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </div>

      {/* ── Cashbox / Register Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-24 rounded-md" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-8 w-36 rounded-lg" />
            <div className="pt-2 border-t border-[hsl(var(--border-default))] flex justify-between">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* ── Session Movements / Activity List ── */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-32 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-xl border border-[hsl(var(--border-default))]"
            >
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-3 w-20 rounded-md" />
              </div>
              <Skeleton className="h-5 w-24 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
