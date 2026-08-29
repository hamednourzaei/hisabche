'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'

import {
  EmptyState,
  ErrorState,
  FilterPill,
  ListSkeleton,
  Pagination,
  Panel,
  StatusDot,
  type StatusTone,
} from '@/components/admin-shell/admin-ui'
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

const PAGE_SIZE = 20

/** Rows within this many days of expiry are highlighted, never filtered. */
const EXPIRING_SOON_DAYS = 7

/**
 * Status → dot colour. Every dot sits beside its own translated label, so the
 * colour reinforces the word rather than replacing it — a red/green-only
 * signal would be unreadable to a colour-blind operator.
 */
const STATUS_TONE: Record<SubscriptionStatus, StatusTone> = {
  active: 'positive',
  trial: 'neutral',
  expired: 'negative',
  cancelled: 'neutral',
  past_due: 'attention',
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

  return (
    <div className="space-y-6">
      {/*
        Honest about a real limitation rather than shipping buckets that only
        cover the loaded page. See use-admin-subscriptions.ts.
      */}
      <p className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
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
          <FilterPill
            selected={plan === 'all'}
            onClick={() => {
              setPlan('all')
              setPage(0)
            }}
          >
            {t('admin.subscriptions.allPlans')}
          </FilterPill>
          {PLANS.map((p) => (
            <FilterPill
              key={p}
              selected={plan === p}
              onClick={() => {
                setPlan(p)
                setPage(0)
              }}
            >
              {t(`admin.plan.${p}`)}
            </FilterPill>
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
          <FilterPill
            selected={status === 'all'}
            onClick={() => {
              setStatus('all')
              setPage(0)
            }}
          >
            {t('admin.subscriptions.allStatuses')}
          </FilterPill>
          {STATUSES.map((value) => (
            <FilterPill
              key={value}
              selected={status === value}
              tone={STATUS_TONE[value]}
              onClick={() => {
                setStatus(value)
                setPage(0)
              }}
            >
              {t(`admin.status.${value}`)}
            </FilterPill>
          ))}
        </div>

        {/* The audit reason. Kept beside the filters because it applies to
            every mutation made from this screen, not to one row. */}
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

      {isLoading && <ListSkeleton rows={5} height="h-28" />}

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

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        busy={isFetching}
        onPage={setPage}
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
  const t = useTranslations()
  const days = daysUntilExpiry(subscription.period_end)

  // Highlighting only — the row is already on screen. Filtering on this would
  // silently miss every subscription on another page.
  const expired = days !== null && days < 0
  const expiringSoon = days !== null && days >= 0 && days <= EXPIRING_SOON_DAYS

  void reason // consumed by the parent's mutate calls

  return (
    <Panel
      as="li"
      className={cn(
        'flex flex-col gap-4 p-4 transition-colors lg:flex-row lg:items-center lg:justify-between',
        expired ? 'border-destructive/40' : 'hover:border-border-strong',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-400">
            {t(`admin.plan.${subscription.plan}`)}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-accent px-3 py-1 text-xs font-medium">
            <StatusDot tone={STATUS_TONE[subscription.status as SubscriptionStatus] ?? 'neutral'} />
            {t(`admin.status.${subscription.status}`)}
          </span>
          {subscription.is_trial && (
            <span className="inline-flex items-center rounded-full border border-violet-500/40 bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-400">
              {t('admin.subscriptions.trial')}
            </span>
          )}
          {expired && (
            <span className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/15 px-3 py-1 text-xs font-medium text-destructive">
              <StatusDot tone="negative" />
              {t('admin.subscriptions.expired')}
            </span>
          )}
          {expiringSoon && (
            <span className="inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning/15 px-3 py-1 text-xs font-medium text-warning">
              <StatusDot tone="attention" />
              {t('admin.subscriptions.expiringSoon')}
            </span>
          )}
        </div>

        <div className="mt-1 text-sm text-muted-foreground">
          {t('admin.subscriptions.periodEnd')}:{' '}
          {subscription.period_end ? (
            <>
              <time dateTime={subscription.period_end} suppressHydrationWarning>
                {new Date(subscription.period_end).toLocaleDateString()}
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

        {/* A subscription with no workspace_id is mid-migration. Saying so
            beats rendering an empty cell that looks like a bug. */}
        {!subscription.workspace_id && (
          <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
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
    </Panel>
  )
}
