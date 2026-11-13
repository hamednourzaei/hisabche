'use client'

// ============================================
// Customers › workspace 360 › overview › usage (V63 #84).
//
// Exact counts per business: members, active devices, invoices, and — for the
// last 30 days — AI questions and API requests, plus live API keys. A metric
// whose table is not there yet says «not configured»; storage is not metered
// per business at all and says «not measured». Neither is drawn as 0.
// ============================================

import { useTranslations } from 'next-intl'

import { Skeleton } from '@/components/ui'
import { ErrorState } from '@/components/admin-shell/admin-ui'
import {
  useAdminWorkspaceUsage,
  type UsageMetricItem,
  type WorkspaceUsageItem,
} from '@/hooks/use-admin-insights'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminNumber } from '@/lib/admin-format'

const METRICS = [
  'members',
  'activeDevices',
  'invoices',
  'aiQueries',
  'apiRequests',
  'activeApiKeys',
  'storageBytes',
] as const satisfies ReadonlyArray<keyof WorkspaceUsageItem>

export function WorkspaceUsageSection({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations()
  const locale = useAdminLocale()
  const { data, isLoading, isError, refetch } = useAdminWorkspaceUsage(workspaceId)

  const shown = (metric: UsageMetricItem): string => {
    if (metric.status === 'not_configured') return t('admin.insights.usage.notConfigured')
    if (metric.status === 'not_measured' || metric.value === null)
      return t('admin.insights.usage.notMeasured')
    return adminNumber(metric.value, locale)
  }

  return (
    <section
      aria-labelledby="workspace-usage-heading"
      className="space-y-2 rounded-xl border border-border p-4"
    >
      <h3 id="workspace-usage-heading" className="text-sm font-bold text-foreground">
        {t('admin.insights.usage.title')}
      </h3>
      {isLoading && <Skeleton className="h-24 w-full rounded-xl" />}
      {isError && !isLoading && (
        <ErrorState message={t('admin.insights.loadError')} onRetry={() => void refetch()} />
      )}
      {!isLoading && !isError && data && (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {METRICS.map((key) => (
              <div key={key} className="rounded-lg bg-muted/40 p-2">
                <dt className="text-xs text-muted-foreground">
                  {t(`admin.insights.usage.metrics.${key}`, { days: data.windowDays })}
                </dt>
                <dd className="text-base font-semibold tabular-nums">{shown(data[key])}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  )
}
