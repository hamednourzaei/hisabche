'use client'

import { useTranslations } from 'next-intl'
import { Skeleton } from '@/components/ui'

const TAB_PLACEHOLDERS = ['a', 'b', 'c', 'd'] as const
const ROW_PLACEHOLDERS = ['a', 'b', 'c', 'd', 'e'] as const

/**
 * Group-level loading boundary. It mirrors the hub layout — title, tab bar,
 * rows — so the content area is never a blank rectangle while a hub fetches.
 * The skeletons are decorative; the status text carries the announcement.
 */
export default function AdminLoading() {
  const t = useTranslations()

  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">{t('admin.loading.label')}</span>

      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="flex gap-2">
        {TAB_PLACEHOLDERS.map((key) => (
          <Skeleton key={key} className="h-9 w-24 rounded-[var(--radius-md)]" />
        ))}
      </div>

      <div className="space-y-2">
        {ROW_PLACEHOLDERS.map((key) => (
          <Skeleton key={key} className="h-14 w-full rounded-[var(--radius-md)]" />
        ))}
      </div>
    </div>
  )
}
