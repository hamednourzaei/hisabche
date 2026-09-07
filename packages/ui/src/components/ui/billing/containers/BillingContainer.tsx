'use client'

import { useTranslations } from 'next-intl'
import {
  useSubscription,
  useTrialStatus,
  useUsage,
  useUpgrade,
  useCancelSubscription,
} from '@hisabche/api'
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
  const upgrade = useUpgrade()
  const cancel = useCancelSubscription()

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
      {subscription.plan === 'free' || subscription.isTrial ? (
        <PricingPage currentPlan={subscription.plan} isTrial={subscription.isTrial} />
      ) : null}

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
