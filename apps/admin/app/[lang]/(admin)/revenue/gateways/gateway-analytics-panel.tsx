'use client'

// ============================================
// Revenue › gateways › analytics (V63 #10 success rate, #12 webhook log).
//
// The rate comes from the provider's own outcome events, as processed by
// `/api/webhooks/stripe` (`invoice.paid` vs `invoice.payment_failed`). It is
// Stripe's only: the PayPal and bank flows are confirmed by an admin and have
// no outcome events, so they have no rate — said on the screen, not drawn as
// 0 %. The log lists processed events without their payload.
//
// Replay is NOT offered. A processed event is kept as the claim that stops a
// second delivery from applying twice; re-running it would mean deleting that
// claim (a compensating DELETE — not done here) or fetching the event again
// from the provider with live credentials.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  Skeleton,
  TableFilterSelect,
  type TableColumn,
} from '@/components/ui'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { useAdminGatewayAnalytics, type GatewayAnalyticsItem } from '@/hooks/use-admin-insights'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDateTime, adminNumber, UNKNOWN_VALUE } from '@/lib/admin-format'

type EventRow = GatewayAnalyticsItem['events'][number]
const WINDOWS = ['7', '30', '90'] as const

export function GatewayAnalyticsPanel() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const [days, setDays] = useState<string>('7')
  const { data, isLoading, isError, refetch } = useAdminGatewayAnalytics(Number(days))

  const columns: TableColumn<EventRow>[] = [
    {
      id: 'type',
      labelKey: 'admin.insights.gateways.eventType',
      labelFallback: 'Event',
      locked: true,
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs text-foreground">
          {row.type}
        </span>
      ),
      sortValue: (row) => row.type,
    },
    {
      id: 'id',
      labelKey: 'admin.insights.gateways.eventId',
      labelFallback: 'Event id',
      showFrom: 'md',
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs text-muted-foreground">
          {row.id}
        </span>
      ),
    },
    {
      id: 'processed',
      labelKey: 'admin.insights.gateways.processedAt',
      labelFallback: 'Processed',
      render: (row) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {row.processedAt ? adminDateTime(row.processedAt, locale) : UNKNOWN_VALUE}
        </span>
      ),
      sortValue: (row) => row.processedAt,
    },
  ]

  const stripe = data?.stripe ?? null

  return (
    <Card>
      <CardHeader className="text-start">
        <CardTitle>{t('admin.insights.gateways.title')}</CardTitle>
        <CardDescription>{t('admin.insights.gateways.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <Skeleton className="h-40 w-full rounded-xl" />}

        {isError && !isLoading && (
          <ErrorState message={t('admin.insights.loadError')} onRetry={() => void refetch()} />
        )}

        {!isLoading && !isError && data?.status === 'not_configured' && (
          <EmptyState
            title={t('admin.insights.notConfigured')}
            description={t('admin.insights.gateways.notConfiguredHint')}
          />
        )}

        {!isLoading && !isError && data?.status === 'ok' && (
          <>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border p-3">
                <dt className="text-xs text-muted-foreground">
                  {t('admin.insights.gateways.stripeRate', { days: data.windowDays })}
                </dt>
                <dd className="text-xl font-bold tabular-nums">
                  {stripe?.ratePercent === null || stripe === null
                    ? UNKNOWN_VALUE
                    : t('admin.insights.percent', {
                        value: adminNumber(stripe.ratePercent, locale, 1),
                      })}
                </dd>
              </div>
              <div className="rounded-xl border border-border p-3">
                <dt className="text-xs text-muted-foreground">
                  {t('admin.insights.gateways.succeeded')}
                </dt>
                <dd className="text-xl font-bold tabular-nums">
                  {adminNumber(stripe?.succeeded ?? 0, locale)}
                </dd>
              </div>
              <div className="rounded-xl border border-border p-3">
                <dt className="text-xs text-muted-foreground">
                  {t('admin.insights.gateways.failed')}
                </dt>
                <dd className="text-xl font-bold tabular-nums">
                  {adminNumber(stripe?.failed ?? 0, locale)}
                </dd>
              </div>
            </dl>
            {stripe?.status === 'no_events' && (
              <p className="text-sm text-muted-foreground">
                {t('admin.insights.gateways.noEvents')}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{t('admin.insights.gateways.scope')}</p>
            <DataTable
              tableId="admin-gateway-webhooks"
              t={tableT}
              rows={data.events}
              columns={columns}
              rowKey={(row) => row.id}
              caption={t('admin.insights.gateways.logTitle')}
              actions={
                <TableFilterSelect
                  label={t('admin.insights.window')}
                  value={days}
                  allValue="7"
                  onChange={setDays}
                  options={WINDOWS.map((value) => ({
                    value,
                    label: t('admin.insights.days', { days: Number(value) }),
                  }))}
                />
              }
              emptyState={
                <EmptyState
                  title={t('admin.insights.gateways.noLog')}
                  description={t('admin.insights.gateways.noLogHint')}
                />
              }
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
