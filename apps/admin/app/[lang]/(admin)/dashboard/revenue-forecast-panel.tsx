'use client'

// ============================================
// Dashboard › revenue (V63 #103).
//
// Net receipts per month from the billing ledger (payments − refunds), and
// the next three months as the mean of the last three COMPLETE months —
// `forecastMonthlyRevenue` in `backend/src/services/intelligence/
// forecast.domain.ts`. With fewer than three complete months the forecast is
// `insufficient_data` and every projected figure is «—», not a guess.
// ============================================

import { useTranslations } from 'next-intl'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from '@/components/ui'
import { ErrorState } from '@/components/admin-shell/admin-ui'
import { useAdminRevenueForecast } from '@/hooks/use-admin-insights'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminMoney, UNKNOWN_VALUE } from '@/lib/admin-format'

export function RevenueForecastPanel() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const { data, isLoading, isError, refetch } = useAdminRevenueForecast()

  const history = (data?.history ?? []).slice(-6)
  const peak = Math.max(1, ...history.map((point) => Math.abs(point.netMinor)))
  const forecast = data?.forecast ?? null

  return (
    <Card>
      <CardHeader className="text-start">
        <CardTitle>{t('admin.insights.forecast.title')}</CardTitle>
        <CardDescription>{t('admin.insights.forecast.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading && <Skeleton className="h-48 w-full rounded-xl" />}

        {isError && !isLoading && (
          <ErrorState message={t('admin.insights.loadError')} onRetry={() => void refetch()} />
        )}

        {!isLoading && !isError && data?.status === 'not_configured' && (
          <EmptyState
            title={t('admin.insights.notConfigured')}
            description={t('admin.insights.forecast.notConfiguredHint')}
          />
        )}

        {!isLoading && !isError && data?.status === 'ok' && history.length === 0 && (
          <EmptyState
            title={t('admin.insights.forecast.noHistory')}
            description={t('admin.insights.forecast.noHistoryHint')}
          />
        )}

        {!isLoading && !isError && data?.status === 'ok' && history.length > 0 && (
          <>
            <section aria-labelledby="revenue-history-heading" className="space-y-2">
              <h3 id="revenue-history-heading" className="text-sm font-semibold">
                {t('admin.insights.forecast.history')}
              </h3>
              <ul className="space-y-2">
                {history.map((point) => (
                  <li
                    key={point.month}
                    className="grid grid-cols-[5rem_1fr_auto] items-center gap-3 text-sm"
                  >
                    <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                      {point.month}
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-accent" aria-hidden="true">
                      <span
                        className="block h-full rounded-full bg-[hsl(var(--color-primary))]"
                        style={{ width: `${Math.round((Math.abs(point.netMinor) / peak) * 100)}%` }}
                      />
                    </span>
                    <span className="tabular-nums">
                      {adminMoney(point.netMinor, 'IRR', locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="revenue-forecast-heading" className="space-y-2">
              <h3 id="revenue-forecast-heading" className="text-sm font-semibold">
                {t('admin.insights.forecast.next')}
              </h3>
              {forecast?.status === 'insufficient_data' && (
                <p className="text-sm text-warning">
                  {t('admin.insights.forecast.insufficient', { months: forecast.basisMonths })}
                </p>
              )}
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(forecast?.next ?? []).map((point) => (
                  <div key={point.month} className="rounded-xl border border-border p-3">
                    <dt dir="ltr" className="font-mono text-xs text-muted-foreground">
                      {point.month}
                    </dt>
                    <dd className="text-lg font-bold tabular-nums">
                      {point.projectedMinor === null
                        ? UNKNOWN_VALUE
                        : adminMoney(point.projectedMinor, 'IRR', locale)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground">{t('admin.insights.forecast.method')}</p>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  )
}
