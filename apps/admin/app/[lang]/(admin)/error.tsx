'use client'

import { useTranslations } from 'next-intl'
import { ErrorState } from '@/components/admin-shell/admin-ui'

/**
 * Route-level failure boundary for every admin screen.
 *
 * It renders inside `(admin)/layout.tsx`, so the header and rail stay in place
 * and the operator can navigate away instead of being dropped on the framework
 * error surface. `error.message` is deliberately not shown: server messages
 * can contain identifiers an operator must not see.
 */
export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations()

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{t('admin.error.title')}</h2>
      <p className="text-sm text-muted-foreground">{t('admin.error.hint')}</p>
      <ErrorState message={t('admin.error.generic')} onRetry={reset} />
    </div>
  )
}
