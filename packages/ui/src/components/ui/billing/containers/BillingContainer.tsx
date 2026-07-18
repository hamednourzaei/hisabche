"use client";

import { useTranslation } from 'react-i18next'
import { useSubscription, useTrialStatus, useUsage, useUpgrade, useCancelSubscription } from '@hisabche/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../card'
import { Button } from '../../button'
import { Badge } from '../../badge'
import { Progress } from '../../progress'
import { Loader2, Check, X } from 'lucide-react'

export function BillingContainer() {
  const { t } = useTranslation()
  const { data: subscription, isLoading: subLoading } = useSubscription()
  const { data: trialStatus, isLoading: trialLoading } = useTrialStatus()
  const { data: usage, isLoading: usageLoading } = useUsage()
  const upgrade = useUpgrade()
  const cancel = useCancelSubscription()

  const isLoading = subLoading || trialLoading || usageLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-fg" />
      </div>
    )
  }

  if (!subscription) return null

  const planName = subscription.plan === 'free' ? t('billing.plans.free') :
                    subscription.plan === 'pro' ? t('billing.plans.pro') : t('billing.plans.enterprise')

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('billing.title')}</h1>
        <p className="text-muted-fg">{t('billing.subtitle')}</p>
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
              <Badge variant={subscription.isTrial ? 'warning' : 'default'} className="text-lg px-4 py-1">
                {subscription.isTrial ? `⭐ ${t('billing.trial')}` : planName}
              </Badge>
              {subscription.isTrial && trialStatus && (
                <div className="mt-2 text-sm">
                  <span>{t('billing.daysLeft', { days: trialStatus.daysLeft })}</span>
                  <Progress value={(trialStatus.daysLeft / 7) * 100} className="h-2 mt-1" />
                </div>
              )}
            </div>
            {subscription.plan === 'free' && !subscription.isTrial && (
              <Button onClick={() => upgrade.mutate({ plan: 'pro', interval: 'month' })}>
                {t('billing.upgradeNow')}
              </Button>
            )}
          </div>

          {subscription.cancelAtPeriodEnd && (
            <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
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

      {/* Usage */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t('billing.usage.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!subscription.isTrial && subscription.plan === 'free' && (
              <div className="text-xs text-muted-fg bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                ⚠️ {t('billing.usage.freeWarning')}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-sm">
                  <span>{t('billing.usage.invoices')}</span>
                  <span>{usage.usage.invoices} / {usage.limits.invoices ?? '∞'}</span>
                </div>
                <Progress value={usage.limits.invoices ? (usage.usage.invoices / usage.limits.invoices) * 100 : 100} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span>{t('billing.usage.users')}</span>
                  <span>{usage.usage.users} / {usage.limits.users ?? '∞'}</span>
                </div>
                <Progress value={usage.limits.users ? (usage.usage.users / usage.limits.users) * 100 : 100} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}