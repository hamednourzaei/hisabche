"use client";

import { useTranslation } from 'react-i18next'
import { useUsage } from '@hisabche/api'
import { Card, CardContent, CardHeader, CardTitle } from '../card'
import { Progress } from '../progress'

export function UsageWidget() {
  const { t } = useTranslation()
  const { data, isLoading } = useUsage()

  if (isLoading) return <div>{t('billing.loading')}</div>
  if (!data) return null

  const { usage, limits, plan, isTrial } = data

  const getProgress = (used: number, limit: number | null) => {
    if (limit === null) return 100
    return Math.min((used / limit) * 100, 100)
  }

  const showWarning = !isTrial && plan === 'free'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{t('billing.usage.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showWarning && (
          <div className="text-xs text-muted-fg bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
            ⚠️ {t('billing.usage.freeWarning')}
          </div>
        )}

        <div>
          <div className="flex justify-between text-sm">
            <span>{t('billing.usage.invoices')}</span>
            <span>{usage.invoices} / {limits.invoices ?? '∞'}</span>
          </div>
          <Progress value={getProgress(usage.invoices, limits.invoices)} className="h-2" />
        </div>

        <div>
          <div className="flex justify-between text-sm">
            <span>{t('billing.usage.users')}</span>
            <span>{usage.users} / {limits.users ?? '∞'}</span>
          </div>
          <Progress value={getProgress(usage.users, limits.users)} className="h-2" />
        </div>

        <div>
          <div className="flex justify-between text-sm">
            <span>{t('billing.usage.workspaces')}</span>
            <span>{usage.workspaces} / {limits.workspaces ?? '∞'}</span>
          </div>
          <Progress value={getProgress(usage.workspaces, limits.workspaces)} className="h-2" />
        </div>
      </CardContent>
    </Card>
  )
}