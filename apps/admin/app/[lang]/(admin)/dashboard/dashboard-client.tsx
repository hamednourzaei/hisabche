'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { useTranslations } from 'next-intl'
import { useAdminSession } from '@/hooks/use-admin-session'
import { useAdminMetrics } from '@/hooks/use-admin-api'
import { usePathname, useRouter } from 'next/navigation'

/**
 * Platform KPI cards.
 *
 * Each entry names the field it reads so the mapping to
 * `AdminService.getMetrics()` is visible in one place. Adding a card without a
 * field here is impossible by construction — which is the point, because the
 * previous version rendered `adminStatus?.status`, a field the endpoint never
 * returned, and every card showed `?`.
 *
 * DELIBERATELY ABSENT: MRR, ARR, revenue. No authoritative pricing source
 * exists (PLANS carries no price, checkout_sessions carries no amount), so any
 * revenue card would display an invented number on the control panel of a
 * financial product.
 */
interface Kpi {
  /** i18n key under `admin.kpi`. */
  key: string
  value: number
  /** Rendered smaller, beneath the number. */
  hint?: string
}

export function DashboardClient() {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations()
  const { loading: authLoading, error: authError } = useAdminSession()
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useAdminMetrics()

  const localePrefix = pathname.split('/').filter(Boolean)[0] || 'fa'

  if (authLoading || metricsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <span className="text-lg animate-pulse">{t('app.loading')}</span>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="min-h-screen p-6">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-4">
          {authError === 'NO_SESSION' ? t('auth.sessionExpired') : t('app.error')}
        </div>
        <button
          type="button"
          onClick={() => router.replace(`/${localePrefix}/login`)}
          className="underline text-red-700"
        >
          {t('common.back')}
        </button>
      </div>
    )
  }

  if (metricsError || !metrics) {
    return (
      <div className="min-h-screen p-6">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-4">
          {t('app.error')}
        </div>
      </div>
    )
  }

  const { workspaces, members, subscriptions } = metrics

  const kpis: Kpi[] = [
    { key: 'totalWorkspaces', value: workspaces.total },
    { key: 'activeWorkspaces', value: workspaces.active },
    { key: 'newThisMonth', value: workspaces.newThisMonth },
    { key: 'totalMembers', value: members.total },
    { key: 'activeSubscriptions', value: subscriptions.active },
    { key: 'expiredSubscriptions', value: subscriptions.expired },
    { key: 'expiringSoon', value: subscriptions.expiringInSevenDays },
    { key: 'trialSubscriptions', value: subscriptions.trial },
  ]

  // Plan mix comes straight from the `plan` column, never from a plan name.
  const planEntries = Object.entries(subscriptions.byPlan)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.dashboard.title')}</h1>
        <time
          className="text-sm text-muted-foreground"
          dateTime={metrics.generatedAt}
          suppressHydrationWarning
        >
          {new Date(metrics.generatedAt).toLocaleString()}
        </time>
      </div>

      {/*
        Migration transparency. While subscriptions are still being attributed
        to workspaces, the plan mix below does not cover every business — and
        an admin console that presents partial data as complete invites wrong
        decisions. Shown only when it is actually incomplete.
      */}
      {subscriptions.workspaceAttributedPercent < 100 && (
        <div className="rounded border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {t('admin.notice.migrationInProgress', {
            percent: subscriptions.workspaceAttributedPercent,
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t(`admin.kpi.${kpi.key}`)}</CardTitle>
            </CardHeader>
            <CardContent>
              {/*
                `toLocaleString()` so Persian and Dari get their own digits —
                a platform console for Afghan and Iranian shops should not show
                Latin numerals in a Persian UI.
              */}
              <div className="text-2xl font-bold tabular-nums">{kpi.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {planEntries.length > 0 && (
        <section aria-labelledby="plan-mix-heading" className="space-y-3">
          <h2 id="plan-mix-heading" className="text-lg font-semibold">
            {t('admin.dashboard.planMix')}
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {planEntries.map(([plan, count]) => (
              <Card key={plan}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium capitalize">{plan}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">{count.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('admin.dashboard.ofTotal', { total: subscriptions.total })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
