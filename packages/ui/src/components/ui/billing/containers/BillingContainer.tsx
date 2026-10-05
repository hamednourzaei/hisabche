'use client'

import { useLocale, useTranslations } from 'next-intl'
import { SearchableTable } from '../../data-table'
import {
  useSubscription,
  useTrialStatus,
  useUsage,
  useUpgradeRequests,
  useCancelUpgradeRequest,
  useCancelSubscription,
  type SubscriptionEvent,
} from '@hisabche/api'
import {
  formatDate,
  formatMoney,
  fractionDigits,
  resolveIntlLocale,
  type KnownCurrency,
  type UiLanguage,
} from '@hisabche/formatting'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../card'
import { Button } from '../../button'
import { Badge } from '../../badge'
import { Progress } from '../../progress'
import { Loader2 } from 'lucide-react'

import { PricingPage } from '../PricingPage'

export function BillingContainer() {
  const t = useTranslations()
  const { data: subscription, isLoading: subLoading } = useSubscription()
  const { data: trialStatus, isLoading: trialLoading } = useTrialStatus()
  const { data: usage, isLoading: usageLoading } = useUsage()
  const cancel = useCancelSubscription()
  const lang = useLocale() as UiLanguage
  const { data: history } = useUpgradeRequests()
  const withdraw = useCancelUpgradeRequest()
  const pendingRequest = history?.requests.find((r) => r.status === 'pending') ?? null
  // Minor units → the currency's own amount; null = negotiated, shown as «—».
  const money = (minor: number | null, currency: string | null) => {
    if (minor === null || !currency) return '—'
    const code = currency as KnownCurrency
    return formatMoney(minor / 10 ** fractionDigits(code), code, resolveIntlLocale(lang))
  }

  const isLoading = subLoading || trialLoading || usageLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--fg-tertiary))]" />
      </div>
    )
  }

  if (!subscription) return null

  const planName =
    subscription.plan === 'free'
      ? t('billing.plans.free.name')
      : subscription.plan === 'pro'
        ? t('billing.plans.pro.name')
        : t('billing.plans.enterprise.name')

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('billing.title')}</h1>
        <p className="text-[hsl(var(--fg-tertiary))]">{t('billing.subtitle')}</p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>{t('billing.currentPlan')}</CardTitle>
          <CardDescription>
            {subscription.isTrial ? t('billing.trialDescription') : t('billing.activePlan')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Badge
                variant={subscription.isTrial ? 'warning' : 'default'}
                className="text-lg px-4 py-1"
              >
                {subscription.isTrial ? `⭐ ${t('billing.trial')}` : planName}
              </Badge>
              {subscription.isTrial && trialStatus && (
                <div className="mt-2 text-sm">
                  <span>{t('billing.daysLeft', { days: trialStatus.daysLeft })}</span>
                  <Progress
                    value={Math.min(
                      100,
                      (trialStatus.daysLeft / (trialStatus.totalDays ?? 7)) * 100,
                    )}
                    className="h-2 mt-1"
                  />
                </div>
              )}
            </div>
            {/* ⚠️ THIS CONDITION USED TO BE THE BUG.

                It read `plan === 'free' && !subscription.isTrial`, so a person
                ON THE TRIAL — the one most likely to be on this page because
                they want to buy — saw no upgrade control at all. And where it
                did show, it called `upgrade.mutate({ plan: 'pro', interval:
                'month' })`: one hardcoded plan, one hardcoded interval, with
                `usePlans()` and `priceYearly` both built and unreachable.

                The plans now render below for anyone who is not already on a
                paid plan, so there is nothing left for this button to do. */}
          </div>

          {!subscription.isTrial && subscription.plan !== 'free' && subscription.periodEnd ? (
            <p className="text-sm text-[hsl(var(--fg-secondary))]" data-period-end="">
              {t('billing.request.validUntil', { date: formatDate(subscription.periodEnd, lang) })}
            </p>
          ) : null}

          {pendingRequest ? (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[hsl(var(--color-primary)/0.08)] p-2 text-sm"
            >
              <span>
                {t('billing.request.pendingBanner', {
                  plan: t(`billing.plans.${pendingRequest.requested_plan}.name`),
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={withdraw.isPending}
                onClick={() => withdraw.mutate(pendingRequest.id)}
              >
                {t('billing.request.withdraw')}
              </Button>
            </div>
          ) : null}

          {subscription.cancelAtPeriodEnd && (
            <div className="rounded-lg bg-[hsl(var(--color-warning)/0.1)] p-2 text-sm text-[hsl(var(--color-warning))]">
              ⚠️ {t('billing.cancelScheduled')}
            </div>
          )}

          {subscription.plan !== 'free' && !subscription.isTrial && (
            <Button variant="outline" size="sm" onClick={() => cancel.mutate()}>
              {t('billing.cancelSubscription')}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ─── Plans ───────────────────────────────────────────────────
          The answer to «هیچ گزینه ارتقایی در اینجا نیست». Shown to anyone on
          the free plan AND to anyone on the trial, which is the case the old
          condition excluded. Someone already paying sees their plan marked as
          current rather than a wall of buy buttons. */}
      {/* Anyone below the top plan may ask for a bigger one — a pro
          subscriber had no way to reach enterprise (reported). */}
      {subscription.plan !== 'enterprise' || subscription.isTrial ? (
        <PricingPage
          currentPlan={subscription.plan}
          isTrial={subscription.isTrial}
          pendingRequest={pendingRequest}
        />
      ) : null}

      {/* ─── Subscription log: every request, activation and its period ─── */}
      <Card data-subscription-history="">
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t('billing.request.history')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!history ? null : !history.configured ? (
            <p className="text-sm text-[hsl(var(--fg-tertiary))]">
              {t('billing.request.notConfigured')}
            </p>
          ) : history.events.length === 0 ? (
            <p className="text-sm text-[hsl(var(--fg-tertiary))]">
              {t('billing.request.noHistory')}
            </p>
          ) : (
            <SearchableTable<SubscriptionEvent>
              tableId="billing-history"
              rows={history.events}
              rowKey={(event) => event.id}
              words={(event) => [t(`billing.request.events.${event.event}`), event.note ?? '']}
              empty={t('billing.request.noHistory')}
              minWidthClass="min-w-[520px]"
              columns={[
                {
                  id: 'date',
                  labelKey: 'billing.request.col.date',
                  labelFallback: t('billing.request.col.date'),
                  sortValue: (event) => event.created_at,
                  render: (event) => (
                    <span className="whitespace-nowrap tabular-nums">
                      {formatDate(event.created_at, lang)}
                    </span>
                  ),
                },
                {
                  id: 'event',
                  labelKey: 'billing.request.col.event',
                  labelFallback: t('billing.request.col.event'),
                  locked: true,
                  sortValue: (event) => event.event,
                  render: (event) => (
                    <>
                      {t(`billing.request.events.${event.event}`)}
                      {event.note ? (
                        <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
                          {event.note}
                        </span>
                      ) : null}
                    </>
                  ),
                },
                {
                  id: 'plan',
                  labelKey: 'billing.request.col.plan',
                  labelFallback: t('billing.request.col.plan'),
                  sortValue: (event) => event.plan ?? '',
                  render: (event) => (event.plan ? t(`billing.plans.${event.plan}.name`) : '—'),
                },
                {
                  id: 'amount',
                  labelKey: 'billing.request.col.amount',
                  labelFallback: t('billing.request.col.amount'),
                  align: 'end',
                  sortValue: (event) => event.amount_minor,
                  render: (event) => (
                    <span className="tabular-nums">
                      {money(event.amount_minor, event.currency)}
                    </span>
                  ),
                },
                {
                  id: 'until',
                  labelKey: 'billing.request.col.until',
                  labelFallback: t('billing.request.col.until'),
                  showFrom: 'md',
                  sortValue: (event) => event.period_end,
                  render: (event) => (
                    <span className="whitespace-nowrap tabular-nums">
                      {event.period_end ? formatDate(event.period_end, lang) : '—'}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      {/* Usage */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t('billing.usage.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!subscription.isTrial && subscription.plan === 'free' && (
              <div className="rounded-lg bg-[hsl(var(--color-warning)/0.1)] p-2 text-xs text-[hsl(var(--fg-secondary))]">
                ⚠️ {t('billing.usage.freeWarning')}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-sm">
                  <span>{t('billing.usage.invoices')}</span>
                  <span>
                    {usage.usage.invoices} / {usage.limits.invoices ?? '∞'}
                  </span>
                </div>
                <Progress
                  value={
                    usage.limits.invoices
                      ? (usage.usage.invoices / usage.limits.invoices) * 100
                      : 100
                  }
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span>{t('billing.usage.users')}</span>
                  <span>
                    {usage.usage.users} / {usage.limits.users ?? '∞'}
                  </span>
                </div>
                <Progress
                  value={usage.limits.users ? (usage.usage.users / usage.limits.users) * 100 : 100}
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
