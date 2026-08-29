'use client'

import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
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
import { Button, Skeleton } from '@/components/ui'
import { ErrorState, Panel } from '@/components/admin-shell/admin-ui'
import { useAdminSession } from '@/hooks/use-admin-session'
import { useAdminMetrics } from '@/hooks/use-admin-api'
import { cn } from '@/lib/utils'

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
  icon: LucideIcon
  /** Accent applied to the icon tile only — never to the number itself. */
  accent: string
}

export function DashboardClient() {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations()
  const { loading: authLoading, error: authError } = useAdminSession()
  const {
    data: metrics,
    isLoading: metricsLoading,
    isError: metricsError,
    refetch,
  } = useAdminMetrics()

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-32 w-full rounded-2xl" />
        ))}
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
      accent: 'bg-blue-500/15 text-blue-400',
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
      accent: 'bg-violet-500/15 text-violet-400',
    },
    {
      key: 'totalMembers',
      value: members.total,
      icon: Users,
      accent: 'bg-blue-500/15 text-blue-400',
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
      accent: 'bg-violet-500/15 text-violet-400',
    },
  ]

  // Plan mix comes straight from the `plan` column, never from a plan name.
  const planEntries = Object.entries(subscriptions.byPlan)
  const planTotal = planEntries.reduce((sum, [, count]) => sum + count, 0)

  return (
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

      {/*
        Migration transparency. While subscriptions are still being attributed
        to workspaces, the plan mix below does not cover every business — and
        an admin console that presents partial data as complete invites wrong
        decisions. Shown only when it is actually incomplete.
      */}
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
            <Panel key={kpi.key} className="p-5 transition-colors hover:border-border-strong">
              <span
                className={cn(
                  'mb-4 flex h-11 w-11 items-center justify-center rounded-xl',
                  kpi.accent,
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm text-muted-foreground">{t(`admin.kpi.${kpi.key}`)}</p>
              {/*
                `toLocaleString()` so Persian and Dari get their own digits —
                a platform console for Afghan and Iranian shops should not show
                Latin numerals in a Persian UI.
              */}
              <p className="mt-1 text-3xl font-bold tabular-nums">{kpi.value.toLocaleString()}</p>
            </Panel>
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
              // Share of the plan mix, not of every subscription: the
              // denominator is the sum of the buckets actually returned, so
              // the bars add up to what is drawn.
              const share = planTotal === 0 ? 0 : Math.round((count / planTotal) * 100)
              return (
                <Panel key={plan} className="p-5">
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
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 rtl:bg-gradient-to-l"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t('admin.dashboard.ofTotal', { total: subscriptions.total })}
                  </p>
                </Panel>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
