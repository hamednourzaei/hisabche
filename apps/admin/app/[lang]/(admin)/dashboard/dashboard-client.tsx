'use client'

import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Button, Card, EmptyState, HubTabs, Skeleton, useHubTab } from '@/components/ui'
import { ErrorState } from '@/components/admin-shell/admin-ui'
import { useAdminSession } from '@/hooks/use-admin-session'
import { useAdminMetrics } from '@/hooks/use-admin-api'
import { useAdminPastDue } from '@/hooks/use-admin-past-due'
import { cn } from '@/lib/utils'

const DASHBOARD_TABS = ['overview', 'revenue', 'alerts'] as const
type DashboardTab = (typeof DASHBOARD_TABS)[number]

interface Kpi {
  key: string
  value: number
  icon: LucideIcon
  accent: string
}

export function DashboardClient() {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations()
  const [tab, setTab] = useHubTab<DashboardTab>(DASHBOARD_TABS)

  const { loading: authLoading, error: authError } = useAdminSession()
  const {
    data: metrics,
    isLoading: metricsLoading,
    isError: metricsError,
    refetch,
  } = useAdminMetrics()
  const { data: pastDueData, isLoading: pastDueLoading } = useAdminPastDue()

  const localePrefix = pathname.split('/').filter(Boolean)[0] || 'fa'

  if (authError) {
    return (
      <div className="space-y-4">
        <ErrorState
          message={authError === 'NO_SESSION' ? t('auth.sessionExpired') : t('app.error')}
          onRetry={() => router.replace(`/${localePrefix}/login`)}
        />
        <Button variant="outline" onClick={() => router.replace(`/${localePrefix}/login`)}>
          {t('auth.signIn')}
        </Button>
      </div>
    )
  }

  if (authLoading || metricsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (metricsError || !metrics) {
    return <ErrorState message={t('app.error')} onRetry={() => void refetch()} />
  }

  const { workspaces, members, subscriptions } = metrics

  const kpis: Kpi[] = [
    {
      key: 'totalWorkspaces',
      value: workspaces.total,
      icon: Building2,
      accent: 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]',
    },
    {
      key: 'activeWorkspaces',
      value: workspaces.active,
      icon: CheckCircle2,
      accent: 'bg-success/15 text-success',
    },
    {
      key: 'newThisMonth',
      value: workspaces.newThisMonth,
      icon: TrendingUp,
      accent: 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]',
    },
    {
      key: 'totalMembers',
      value: members.total,
      icon: Users,
      accent: 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]',
    },
    {
      key: 'activeSubscriptions',
      value: subscriptions.active,
      icon: CreditCard,
      accent: 'bg-success/15 text-success',
    },
    {
      key: 'expiredSubscriptions',
      value: subscriptions.expired,
      icon: AlertTriangle,
      accent: 'bg-destructive/15 text-destructive',
    },
    {
      key: 'expiringSoon',
      value: subscriptions.expiringInSevenDays,
      icon: CalendarClock,
      accent: 'bg-warning/15 text-warning',
    },
    {
      key: 'trialSubscriptions',
      value: subscriptions.trial,
      icon: Sparkles,
      accent: 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]',
    },
  ]

  const planEntries = Object.entries(subscriptions.byPlan)
  const planTotal = planEntries.reduce((sum, [, count]) => sum + count, 0)
  const pastDueList = pastDueData?.subscriptions ?? []

  return (
    <div className="space-y-6">
      <HubTabs
        label={t('admin.hubs.dashboard.title')}
        items={[
          { id: 'overview', label: t('admin.hubs.dashboard.overview') },
          { id: 'revenue', label: t('admin.hubs.dashboard.revenue') },
          { id: 'alerts', label: t('admin.hubs.dashboard.alerts') },
        ]}
        active={tab}
        onSelect={setTab}
      />

      {tab === 'overview' && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t('admin.dashboard.description')}</p>
            <time
              className="text-xs text-muted-foreground tabular-nums"
              dateTime={metrics.generatedAt}
              suppressHydrationWarning
            >
              {t('admin.dashboard.generatedAt', {
                time: new Date(metrics.generatedAt).toLocaleString(),
              })}
            </time>
          </div>

          {subscriptions.workspaceAttributedPercent < 100 && (
            <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
              <p className="min-w-0">
                {t('admin.notice.migrationInProgress', {
                  percent: subscriptions.workspaceAttributedPercent,
                })}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => {
              const Icon = kpi.icon
              return (
                <Card key={kpi.key} className="p-5 transition-colors hover:border-border-strong">
                  <span
                    className={cn(
                      'mb-4 flex h-11 w-11 items-center justify-center rounded-xl',
                      kpi.accent,
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="text-sm text-muted-foreground">{t(`admin.kpi.${kpi.key}`)}</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">
                    {kpi.value.toLocaleString()}
                  </p>
                </Card>
              )
            })}
          </div>

          {planEntries.length > 0 && (
            <section aria-labelledby="plan-mix-heading" className="space-y-4">
              <h2 id="plan-mix-heading" className="text-lg font-bold">
                {t('admin.dashboard.planMix')}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {planEntries.map(([plan, count]) => {
                  const share = planTotal === 0 ? 0 : Math.round((count / planTotal) * 100)
                  return (
                    <Card key={plan} className="p-5">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-sm font-medium capitalize">{plan}</p>
                        <p className="text-2xl font-bold tabular-nums">{count.toLocaleString()}</p>
                      </div>
                      <div
                        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-accent"
                        role="img"
                        aria-label={t('admin.dashboard.planShare', { plan, percent: share })}
                      >
                        <div
                          className="h-full rounded-full bg-[hsl(var(--color-primary))]"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t('admin.dashboard.ofTotal', { total: subscriptions.total })}
                      </p>
                    </Card>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'revenue' && (
        <Card className="p-8">
          <EmptyState
            title={t('admin.hubs.dashboard.revenue')}
            description={t('admin.empty.comingInNextStep')}
          />
        </Card>
      )}

      {tab === 'alerts' && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold">{t('admin.hubs.dashboard.alerts')}</h2>
          {pastDueLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-2xl" />
              ))}
            </div>
          ) : pastDueList.length === 0 ? (
            <Card className="p-8">
              <EmptyState title={t('admin.shell.alertsNone')} />
            </Card>
          ) : (
            <ul className="space-y-3">
              {pastDueList.map((sub) => (
                <li key={sub.id}>
                  <Card className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-destructive">{sub.workspace_id}</p>
                      <p className="text-xs text-muted-foreground">
                        {sub.plan} · {sub.status}
                      </p>
                    </div>
                    <Link
                      href={`/${localePrefix}/revenue?tab=subscriptions&status=past_due`}
                      className="text-xs text-[hsl(var(--color-primary))] hover:underline"
                    >
                      {t('admin.subscriptions.title')}
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
