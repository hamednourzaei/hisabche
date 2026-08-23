// ============================================
// The default loading state for a dashboard route.
//
// Most routes had no `loading.tsx` at all, so navigating to them left the
// previous screen on-screen with nothing happening — on a slow connection
// that reads as a dead click rather than as loading. Next.js renders this the
// instant a navigation starts, so every route now answers immediately.
//
// It is deliberately generic: a heading, a stat row, a body block. Routes with
// a tailored skeleton (invoices, warehouse, customers) keep theirs — this is
// the floor, not a replacement.
// ============================================
'use client'

import { memo } from 'react'

import { cn } from '../../lib/utils'
import { Skeleton } from './skeleton'

export interface PageSkeletonProps {
  /** Cards in the stat row. 0 hides it. */
  stats?: number
  /** Rows in the body block. */
  rows?: number
  className?: string
}

export const PageSkeleton = memo(function PageSkeleton({
  stats = 4,
  rows = 6,
  className,
}: PageSkeletonProps) {
  return (
    <div
      // Announced, not just drawn: a screen-reader user gets "loading" rather
      // than silence while the boxes pulse.
      role="status"
      aria-busy="true"
      className={cn('w-full min-w-0 space-y-6', className)}
    >
      <span className="sr-only">…</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      {stats > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: stats }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-[var(--radius-lg)]" />
          ))}
        </div>
      ) : null}

      <div className="space-y-2 rounded-[var(--radius-lg)] border border-[hsl(var(--border-default))] p-4">
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
})

PageSkeleton.displayName = 'PageSkeleton'
