'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, Users } from 'lucide-react'
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { cn } from '@/lib/utils'

import { MemberList } from '@/components/members/member-list'
import type { AdminWorkspace } from '@/hooks/use-admin-workspaces'
import {
  PLANS,
  STATUSES,
  useUpdateSubscriptionPlan,
  useUpdateSubscriptionStatus,
  type Plan,
  type SubscriptionStatus,
} from '@/hooks/use-admin-subscriptions'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDate, adminNumber } from '@/lib/admin-format'

/**
 * One row is the whole customer relationship: identity, members AND the
 * subscription. The subscription used to live on a second URL
 * (`/customers?tab=subscriptions`); this card is now the single place an
 * operator reads and manages it, so the two URLs were collapsed into one.
 *
 * Expiry is derived from `period_end`, not from the stored status: a past-due
 * period with a stale `active` status is still expired to the operator. Nothing
 * here writes that derived state back by itself — only an explicit click does.
 */
export function WorkspaceRow({
  workspace,
  onOpen360,
}: {
  workspace: AdminWorkspace
  onOpen360?: (id: string) => void
}) {
  const t = useTranslations()
  const dateLocale = useAdminLocale()
  const [expanded, setExpanded] = useState(false)
  const regionId = useId()

  const updatePlan = useUpdateSubscriptionPlan()
  const updateStatus = useUpdateSubscriptionStatus()

  const periodEndMs = workspace.subscriptionPeriodEnd
    ? new Date(workspace.subscriptionPeriodEnd).getTime()
    : null
  const expired = periodEndMs !== null && Number.isFinite(periodEndMs) && periodEndMs < Date.now()
  const hasSubscription = Boolean(workspace.plan && workspace.subscriptionId)
  const status: SubscriptionStatus = expired
    ? 'expired'
    : isStatus(workspace.subscriptionStatus)
      ? workspace.subscriptionStatus
      : 'active'
  const busy =
    updateStatus.isPending && updateStatus.variables?.subscriptionId === workspace.subscriptionId

  const reset = () => {
    if (!workspace.subscriptionId) return
    updateStatus.mutate({
      subscriptionId: workspace.subscriptionId,
      status: 'active',
      reason: t('admin.subscriptions.resetReason'),
    })
  }
  const changePlan = (next: string) => {
    if (!workspace.subscriptionId || !isPlan(next) || next === workspace.plan) return
    updatePlan.mutate({
      subscriptionId: workspace.subscriptionId,
      plan: next,
      reason: t('admin.subscriptions.upgradeReason'),
    })
  }

  return (
    <li
      className={cn(
        'overflow-hidden rounded-2xl border bg-card transition-colors',
        expired
          ? 'border-[hsl(var(--color-destructive)/0.7)] bg-[hsl(var(--color-destructive)/0.04)]'
          : expanded
            ? 'border-blue-500/50'
            : 'border-border hover:border-border-strong',
      )}
      data-expired={expired ? 'true' : 'false'}
    >
      <div className="flex items-center justify-between p-4">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls={regionId}
          className="flex min-w-0 flex-1 items-center gap-3 text-start transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:gap-4"
        >
          <ChevronLeft
            aria-hidden="true"
            className={cn(
              'h-5 w-5 shrink-0 text-muted-foreground transition-transform rtl:-scale-x-100',
              expanded && '-rotate-90',
            )}
          />

          <span
            aria-hidden="true"
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/25 to-violet-500/25 text-sm font-bold text-blue-400 sm:flex"
          >
            {workspace.name.trim().charAt(0).toUpperCase() || '—'}
          </span>

          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{workspace.name}</div>
            <div className="mt-0.5 truncate text-sm text-muted-foreground">
              {t('admin.workspaces.owner')}:{' '}
              {workspace.ownerName ?? workspace.ownerEmail ?? t('admin.workspaces.noOwner')}
            </div>

            {/* Same subscription information the old second URL used to show. */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SubscriptionBadges
                plan={workspace.plan}
                status={status}
                isTrial={workspace.isTrial === true}
                expired={expired}
              />
              <StatusBadge active={workspace.is_active} />
              <MemberCount count={workspace.memberCount} label={t('admin.workspaces.members')} />
              {workspace.subscriptionPeriodEnd && (
                <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                  {t('admin.subscriptions.periodEnd')}:{' '}
                  {adminDate(workspace.subscriptionPeriodEnd, dateLocale)}
                </span>
              )}
            </div>
          </div>
        </button>

        {onOpen360 && (
          <Button
            variant="outline"
            size="sm"
            className="ms-3 shrink-0 text-xs"
            onClick={() => onOpen360(workspace.id)}
          >
            {t('admin.customers.view360')}
          </Button>
        )}
      </div>

      {expired && (
        <p
          role="alert"
          className="mx-4 mb-3 rounded-xl border border-[hsl(var(--color-destructive)/0.5)] bg-[hsl(var(--color-destructive)/0.12)] p-3 text-sm font-medium text-[hsl(var(--color-destructive))]"
        >
          {t('admin.subscriptions.expiredAlert')}
        </p>
      )}

      {/*
        Rendered only while open. Keeping it mounted-but-hidden would leave the
        member rows in the tab order and readable by a screen reader while
        visually collapsed.
      */}
      {expanded && (
        <div className="space-y-4 border-t border-border bg-background/40 px-2 pb-2">
          <MemberList
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            expanded={expanded}
            regionId={regionId}
          />

          {hasSubscription && (
            <div
              className="mx-2 space-y-3 rounded-xl border border-border bg-card p-3"
              data-subscription-controls=""
            >
              <div className="text-xs font-semibold text-foreground">
                {t('admin.subscriptions.managementTitle')}
              </div>

              {(updatePlan.isError || updateStatus.isError) && (
                <p role="alert" className="text-xs text-destructive">
                  {t('admin.subscriptions.updateError')}
                </p>
              )}

              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">{t('admin.subscriptions.status')}</span>
                  <Select
                    value={status}
                    disabled={busy}
                    onValueChange={(next) => {
                      if (!workspace.subscriptionId || !isStatus(next) || next === status) return
                      updateStatus.mutate({
                        subscriptionId: workspace.subscriptionId,
                        status: next,
                        reason: t('admin.subscriptions.changeReason'),
                      })
                    }}
                  >
                    <SelectTrigger
                      className="h-10 w-40 rounded-xl"
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
                </label>

                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">{t('admin.subscriptions.plan')}</span>
                  <Select
                    value={isPlan(workspace.plan) ? workspace.plan : 'free'}
                    disabled={busy}
                    onValueChange={changePlan}
                  >
                    <SelectTrigger
                      className="h-10 w-40 rounded-xl"
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
                </label>

                {expired && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={reset}>
                    {t('admin.subscriptions.resetSubscription')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function SubscriptionBadges({
  plan,
  status,
  isTrial,
  expired,
}: {
  plan: string | null
  status: SubscriptionStatus
  isTrial: boolean
  expired: boolean
}) {
  const t = useTranslations()
  return (
    <>
      <Badge variant={expired ? 'destructive' : 'secondary'}>
        {plan ? t(`admin.plan.${plan}`) : t('admin.workspaces.noSubscription')}
      </Badge>
      <Badge variant={expired ? 'destructive' : 'outline'}>{t(`admin.status.${status}`)}</Badge>
      {isTrial && <Badge variant="secondary">{t('admin.subscriptions.trial')}</Badge>}
      {expired && <Badge variant="destructive">{t('admin.subscriptions.expired')}</Badge>}
    </>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  const t = useTranslations()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
        active
          ? 'border-success/40 bg-success/10 text-success'
          : 'border-border bg-accent text-muted-foreground',
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-success' : 'bg-muted-foreground')}
        aria-hidden="true"
      />
      {active ? t('admin.workspaces.active') : t('admin.workspaces.inactive')}
    </span>
  )
}

function MemberCount({ count, label }: { count: number; label: string }) {
  const dateLocale = useAdminLocale()
  return (
    <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
      <Users className="h-4 w-4" aria-hidden="true" />
      <span>{adminNumber(count, dateLocale)}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

function isStatus(value: string | null): value is SubscriptionStatus {
  return value !== null && (STATUSES as readonly string[]).includes(value)
}

function isPlan(value: string | null): value is Plan {
  return value !== null && (PLANS as readonly string[]).includes(value)
}
