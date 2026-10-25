'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import {
  Button,
  Card,
  EmptyState,
  Input,
  PaginationBar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@/components/ui'

import { ErrorState } from '@/components/admin-shell/admin-ui'
import { cn } from '@/lib/utils'
import { useAdminSession } from '@/hooks/use-admin-session'
import {
  PLANS,
  STATUSES,
  daysUntilExpiry,
  useAdminSubscriptions,
  useUpdateSubscriptionPlan,
  useUpdateSubscriptionStatus,
  type AdminSubscription,
  type Plan,
  type SubscriptionStatus,
} from '@/hooks/use-admin-subscriptions'
import { UpgradeRequestsPanel } from './upgrade-requests-panel'
import { PlanLimitsPanel } from './plan-limits-panel'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDate } from '@/lib/admin-format'

const PAGE_SIZE = 20

/** Rows within this many days of expiry are highlighted, never filtered. */
const EXPIRING_SOON_DAYS = 7

const STATUS_TONE: Record<SubscriptionStatus, string> = {
  active: 'bg-[hsl(var(--color-success))]',
  trial: 'bg-[hsl(var(--fg-tertiary))]',
  expired: 'bg-[hsl(var(--color-destructive))]',
  cancelled: 'bg-[hsl(var(--fg-tertiary))]',
  past_due: 'bg-[hsl(var(--color-warning))]',
}

export function SubscriptionsClient() {
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const { error: authError } = useAdminSession()

  const [plan, setPlan] = useState<Plan | 'all'>('all')
  const [status, setStatus] = useState<SubscriptionStatus | 'all'>('all')
  const [page, setPage] = useState(0)
  const [reason, setReason] = useState('')

  const localePrefix = pathname.split('/').filter(Boolean)[0] || 'fa'

  const { data, isLoading, isError, isFetching, refetch } = useAdminSubscriptions({
    ...(plan !== 'all' ? { plan } : {}),
    ...(status !== 'all' ? { status } : {}),
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  })

  const updatePlan = useUpdateSubscriptionPlan()
  const updateStatus = useUpdateSubscriptionStatus()

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

  const subscriptions = data?.subscriptions ?? []
  const total = data?.total ?? 0

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)

  return (
    <div className="space-y-6">
      {/* Paid plans are activated here, after payment — never by the customer. */}
      <UpgradeRequestsPanel />
      <PlanLimitsPanel />

      <p className="rounded-2xl border border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning)/0.1)] p-4 text-sm">
        {t('admin.subscriptions.noDateBuckets')}
      </p>

      {/* ── Filter row ──────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div
          role="group"
          aria-label={t('admin.subscriptions.plan')}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="me-1 text-sm text-muted-foreground">
            {t('admin.subscriptions.plan')}
          </span>
          <Button
            size="sm"
            variant={plan === 'all' ? 'default' : 'outline'}
            onClick={() => {
              setPlan('all')
              setPage(0)
            }}
          >
            {t('admin.subscriptions.allPlans')}
          </Button>
          {PLANS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={plan === p ? 'default' : 'outline'}
              onClick={() => {
                setPlan(p)
                setPage(0)
              }}
            >
              {t(`admin.plan.${p}`)}
            </Button>
          ))}
        </div>

        <div
          role="group"
          aria-label={t('admin.subscriptions.status')}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="me-1 text-sm text-muted-foreground">
            {t('admin.subscriptions.status')}
          </span>
          <Button
            size="sm"
            variant={status === 'all' ? 'default' : 'outline'}
            onClick={() => {
              setStatus('all')
              setPage(0)
            }}
          >
            {t('admin.subscriptions.allStatuses')}
          </Button>
          {STATUSES.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={status === value ? 'default' : 'outline'}
              onClick={() => {
                setStatus(value)
                setPage(0)
              }}
            >
              <span
                aria-hidden="true"
                className={cn('me-1.5 inline-block h-2 w-2 rounded-full', STATUS_TONE[value])}
              />
              {t(`admin.status.${value}`)}
            </Button>
          ))}
        </div>

        {/* The audit reason. */}
        <label className="flex max-w-xl flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">{t('admin.subscriptions.reason')}</span>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('admin.subscriptions.reasonHint')}
            className="h-11 rounded-xl"
          />
        </label>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState message={t('admin.subscriptions.loadError')} onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && subscriptions.length === 0 && (
        <EmptyState title={t('admin.subscriptions.empty')} />
      )}

      {(updatePlan.isError || updateStatus.isError) && (
        <p role="alert" className="text-sm text-destructive">
          {t('admin.subscriptions.updateError')}
        </p>
      )}

      {subscriptions.length > 0 && (
        <ul className="space-y-3">
          {subscriptions.map((subscription) => (
            <SubscriptionRow
              key={subscription.id}
              subscription={subscription}
              reason={reason}
              busy={
                (updatePlan.isPending &&
                  updatePlan.variables?.subscriptionId === subscription.id) ||
                (updateStatus.isPending &&
                  updateStatus.variables?.subscriptionId === subscription.id)
              }
              onPlan={(next) =>
                updatePlan.mutate({
                  subscriptionId: subscription.id,
                  plan: next,
                  ...(reason ? { reason } : {}),
                })
              }
              onStatus={(next) =>
                updateStatus.mutate({
                  subscriptionId: subscription.id,
                  status: next,
                  ...(reason ? { reason } : {}),
                })
              }
            />
          ))}
        </ul>
      )}

      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        busy={isFetching}
        onPage={setPage}
        showingLabel={t('admin.pagination.showing', { from, to, total })}
        previousLabel={t('admin.pagination.previous')}
        nextLabel={t('admin.pagination.next')}
      />
    </div>
  )
}

function SubscriptionRow({
  subscription,
  reason,
  busy,
  onPlan,
  onStatus,
}: {
  subscription: AdminSubscription
  reason: string
  busy: boolean
  onPlan: (plan: Plan) => void
  onStatus: (status: SubscriptionStatus) => void
}) {
  const dateLocale = useAdminLocale()
  const t = useTranslations()
  const days = daysUntilExpiry(subscription.period_end)

  const expired = days !== null && days < 0
  const expiringSoon = days !== null && days >= 0 && days <= EXPIRING_SOON_DAYS

  void reason

  return (
    <li
      className={cn(
        'flex flex-col gap-4 rounded-2xl border bg-card p-4 transition-colors lg:flex-row lg:items-center lg:justify-between',
        expired
          ? 'border-[hsl(var(--color-destructive)/0.4)]'
          : 'border-border hover:border-border-strong',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-[hsl(var(--color-primary)/0.4)] bg-[hsl(var(--color-primary)/0.15)] px-3 py-1 text-xs font-medium text-[hsl(var(--color-primary))]">
            {t(`admin.plan.${subscription.plan}`)}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-accent px-3 py-1 text-xs font-medium">
            <span
              aria-hidden="true"
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                STATUS_TONE[subscription.status as SubscriptionStatus] ??
                  'bg-[hsl(var(--fg-tertiary))]',
              )}
            />
            {t(`admin.status.${subscription.status}`)}
          </span>
          {subscription.is_trial && (
            <span className="inline-flex items-center rounded-full border border-violet-500/40 bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-400">
              {t('admin.subscriptions.trial')}
            </span>
          )}
          {expired && (
            <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--color-destructive)/0.4)] bg-[hsl(var(--color-destructive)/0.15)] px-3 py-1 text-xs font-medium text-[hsl(var(--color-destructive))]">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--color-destructive))]"
              />
              {t('admin.subscriptions.expired')}
            </span>
          )}
          {expiringSoon && (
            <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning)/0.15)] px-3 py-1 text-xs font-medium text-[hsl(var(--color-warning))]">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--color-warning))]"
              />
              {t('admin.subscriptions.expiringSoon')}
            </span>
          )}
        </div>

        <div className="mt-1 text-sm text-muted-foreground">
          {t('admin.subscriptions.periodEnd')}:{' '}
          {subscription.period_end ? (
            <>
              <time dateTime={subscription.period_end} suppressHydrationWarning>
                {adminDate(subscription.period_end, dateLocale)}
              </time>
              {days !== null && (
                <span className="ms-2">
                  {days >= 0
                    ? t('admin.subscriptions.expiresIn', { days })
                    : t('admin.subscriptions.expiredAgo', { days: Math.abs(days) })}
                </span>
              )}
            </>
          ) : (
            t('admin.subscriptions.noPeriod')
          )}
        </div>

        {subscription.workspace_id && (
          <div className="mt-1 text-xs text-muted-foreground">
            {t('admin.subscriptions.workspaceId')}:{' '}
            <code dir="ltr" className="select-all font-mono" data-workspace-id="">
              {subscription.workspace_id}
            </code>
          </div>
        )}

        {!subscription.workspace_id && (
          <div className="mt-1 text-xs text-[hsl(var(--color-warning))]">
            {t('admin.workspaces.noOwner')}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        <Select
          value={subscription.plan}
          disabled={busy}
          onValueChange={(v) => {
            if (v !== subscription.plan) onPlan(v as Plan)
          }}
        >
          <SelectTrigger
            className="h-11 w-40 rounded-xl"
            aria-label={t('admin.subscriptions.changePlan')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLANS.map((p) => (
              <SelectItem key={p} value={p}>
                {t(`admin.plan.${p}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={subscription.status}
          disabled={busy}
          onValueChange={(v) => {
            if (v !== subscription.status) onStatus(v as SubscriptionStatus)
          }}
        >
          <SelectTrigger
            className="h-11 w-40 rounded-xl"
            aria-label={t('admin.subscriptions.changeStatus')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`admin.status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </li>
  )
}
