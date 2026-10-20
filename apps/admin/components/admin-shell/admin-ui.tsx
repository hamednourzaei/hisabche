'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui'

/**
 * Shared error state for admin screens.
 * Primitives (Card, EmptyState, Skeleton, Pagination, etc.) come from @hisabche/ui.
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTranslations()
  return (
    // `role="alert"` so the failure is announced rather than only drawn.
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-destructive">{message}</span>
      <Button size="sm" variant="outline" className="min-h-[44px]" onClick={onRetry}>
        {t('admin.error.retry')}
      </Button>
    </div>
  )
}
