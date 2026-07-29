"use client";

import { useTranslations } from "next-intl";
import { useSubscription, useTrialStatus } from '@hisabche/api'
import { Badge } from '../../badge'
import { Button } from '../../button'
import { Progress } from '../../progress'

export function BillingStatusContainer() {
  const t = useTranslations();const { data: subscription } = useSubscription()
  const { data: trialStatus } = useTrialStatus()

  if (!subscription) return null

  return (
    <div className="p-4 border rounded-lg bg-background/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant={subscription.isTrial ? 'warning' : 'default'}>
            {subscription.isTrial ? '⭐ Trial' : subscription.plan === 'free' ? t('billing.plans.free') : t(`billing.plans.${subscription.plan}`)}
          </Badge>
          {subscription.isTrial && trialStatus && (
            <span className="text-sm text-muted-fg">
              {trialStatus.daysLeft} {t('billing.days')}
            </span>
          )}
        </div>
        {subscription.plan === 'free' && !subscription.isTrial && (
          <Button size="sm" variant="outline">
            {t('billing.upgrade')}
          </Button>
        )}
      </div>
      {subscription.isTrial && trialStatus && (
        <Progress value={(trialStatus.daysLeft / 7) * 100} className="h-1.5 mt-2" />
      )}
    </div>
  )
}