"use client";

import { useTranslation } from 'react-i18next'
import { usePlans, useUpgrade } from '@hisabche/api'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../card'
import { Button } from '../../button'
import { Badge } from '../../badge'
import { Check } from 'lucide-react'

export function PricingContainer() {
  const { t } = useTranslation()
  const { data: plans, isLoading } = usePlans()
  const upgrade = useUpgrade()

  if (isLoading) {
    return <div className="text-center py-12">{t('billing.loading')}</div>
  }

  if (!plans) return null

  return (
    <div className="container py-12">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold">{t('billing.pricing.title')}</h1>
        <p className="text-muted-fg mt-2">{t('billing.pricing.subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {plans.map((plan) => {
          const isPopular = plan.plan === 'pro'
          return (
            <Card key={plan.plan} className={`relative ${isPopular ? 'border-primary shadow-lg' : ''}`}>
              {isPopular && <Badge className="absolute -top-2 right-4">{t('billing.popular')}</Badge>}
              <CardHeader>
                <CardTitle>{t(`billing.plans.${plan.plan}`)}</CardTitle>
                <CardDescription>
                  {plan.priceMonthly ? (
                    <span className="text-3xl font-bold">${plan.priceMonthly}</span>
                  ) : (
                    <span className="text-3xl font-bold">{t('billing.free')}</span>
                  )}
                  {plan.priceMonthly && <span className="text-sm text-muted-fg"> / {t('billing.month')}</span>}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.featureKeys.map((key: string) => (
                    <li key={key} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 mt-0.5" />
                      <span>{t(key)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" onClick={() => upgrade.mutate({ plan: plan.plan, interval: 'month' })}>
                  {plan.plan === 'free' ? t('billing.startFree') : t('billing.startPro')}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}