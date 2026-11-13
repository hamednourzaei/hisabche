'use client'

// ============================================
// Dashboard › overview › signup funnel (V63 #94).
//
// A cohort: the people who signed up in the window, how many of THEM own a
// business (sandboxes left out), how many of those businesses have paid. Each
// step is a subset of the one before, so no share can pass 100 %. An empty
// window has no percentages («—»), not 0 %.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  TableFilterSelect,
} from '@/components/ui'
import { ErrorState } from '@/components/admin-shell/admin-ui'
import { useAdminSignupFunnel } from '@/hooks/use-admin-insights'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminNumber, UNKNOWN_VALUE } from '@/lib/admin-format'

const WINDOWS = ['30', '90', '365'] as const

export function SignupFunnelPanel() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const [days, setDays] = useState<string>('30')
  const { data, isLoading, isError, refetch } = useAdminSignupFunnel(Number(days))

  const percent = (value: number | null) =>
    value === null
      ? UNKNOWN_VALUE
      : t('admin.insights.percent', { value: adminNumber(value, locale, 1) })

  return (
    <Card>
      <CardHeader className="text-start">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t('admin.insights.funnel.title')}</CardTitle>
            <CardDescription>{t('admin.insights.funnel.description')}</CardDescription>
          </div>
          <TableFilterSelect
            label={t('admin.insights.window')}
            value={days}
            allValue="30"
            onChange={setDays}
            options={WINDOWS.map((value) => ({
              value,
              label: t('admin.insights.days', { days: Number(value) }),
            }))}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Skeleton className="h-32 w-full rounded-xl" />}

        {isError && !isLoading && (
          <ErrorState message={t('admin.insights.loadError')} onRetry={() => void refetch()} />
        )}

        {!isLoading && !isError && data && (
          <>
            {data.truncated && (
              <p className="text-sm text-warning">
                {t('admin.insights.funnel.truncated', {
                  shown: adminNumber(data.steps[0]?.count ?? 0, locale),
                  total: adminNumber(data.cohortTotal, locale),
                })}
              </p>
            )}
            <ol className="space-y-3">
              {data.steps.map((step) => (
                <li key={step.id} className="space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {t(`admin.insights.funnel.steps.${step.id}`)}
                    </span>
                    <span className="tabular-nums">
                      {adminNumber(step.count, locale)}
                      <span className="ms-2 text-xs text-muted-foreground">
                        {t('admin.insights.funnel.share', {
                          ofFirst: percent(step.ofFirstPercent),
                          ofPrevious: percent(step.ofPreviousPercent),
                        })}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-accent" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-[hsl(var(--color-primary))]"
                      style={{ width: `${step.ofFirstPercent ?? 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">{t('admin.insights.funnel.scope')}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
