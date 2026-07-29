"use client";

import { useTranslations } from "next-intl";
import { useSubscription, useTrialStatus } from '@hisabche/api'
import { Badge } from '../badge'
import { Progress } from '../progress'
import { Button } from '../button'

export function BillingStatus() {
  const t = useTranslations();const { data: subscription, isLoading } = useSubscription()
  const { data: trialStatus } = useTrialStatus()

  if (isLoading) return <div>{t('billing.loading')}</div>
  if (!subscription) return null

  const isTrial = subscription.isTrial
  const planKey = subscription.plan === 'free' ? 'billing.plans.free' : 
                   subscription.plan === 'pro' ? 'billing.plans.pro' : 'billing.plans.enterprise'

  return (
    <div className="p-4 border rounded-lg bg-background">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{t('billing.currentPlan')}</span>
            <Badge variant={isTrial ? 'warning' : 'default'}>
              {isTrial ? `⭐ ${t('billing.trial')}` : t(planKey)}
            </Badge>
          </div>
          
          {isTrial && trialStatus && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {t('billing.daysLeft', { days: trialStatus.daysLeft })}
                </span>
                <span className="text-muted-fg">
                  {trialStatus.isInGracePeriod ? `⏳ ${t('billing.gracePeriod')}` : ''}
                </span>
              </div>
              <Progress 
                value={(trialStatus.daysLeft / 7) * 100} 
                className="h-2 mt-1"
              />
            </div>
          )}
        </div>

        {subscription.plan === 'free' && !isTrial && (
          <Button size="sm">{t('billing.upgradeNow')}</Button>
        )}
      </div>
    </div>
  )
}