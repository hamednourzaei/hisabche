'use client'

// ============================================
// Operations › jobs › email delivery (V63 #79).
//
// Read from `email_outbox`, the one queue every outgoing email goes through.
// The counts are exact; the failure list is the latest fifty to read, with
// the recipient masked. An outbox that does not exist yet is «not
// configured», not «nothing sent».
// ============================================

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
  type TableColumn,
} from '@/components/ui'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { useAdminEmailDelivery, type EmailDeliveryReportItem } from '@/hooks/use-admin-insights'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDateTime, adminNumber, UNKNOWN_VALUE } from '@/lib/admin-format'

type FailureRow = EmailDeliveryReportItem['recentFailures'][number]

const STATUSES = ['pending', 'sending', 'sent', 'failed'] as const

export function EmailDeliveryPanel() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const { data, isLoading, isError, refetch } = useAdminEmailDelivery()

  const columns: TableColumn<FailureRow>[] = [
    {
      id: 'to',
      labelKey: 'admin.insights.email.to',
      labelFallback: 'To',
      locked: true,
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs text-foreground">
          {row.to}
        </span>
      ),
    },
    {
      id: 'subject',
      labelKey: 'admin.insights.email.subject',
      labelFallback: 'Subject',
      render: (row) => <span className="block max-w-[240px] truncate text-sm">{row.subject}</span>,
    },
    {
      id: 'attempts',
      labelKey: 'admin.insights.email.attempts',
      labelFallback: 'Attempts',
      showFrom: 'md',
      render: (row) => <span className="tabular-nums">{adminNumber(row.attempts, locale)}</span>,
      sortValue: (row) => row.attempts,
    },
    {
      id: 'error',
      labelKey: 'admin.insights.email.lastError',
      labelFallback: 'Last error',
      showFrom: 'lg',
      render: (row) => (
        <span dir="ltr" className="block max-w-[260px] truncate font-mono text-xs text-destructive">
          {row.lastError ?? UNKNOWN_VALUE}
        </span>
      ),
    },
    {
      id: 'created',
      labelKey: 'admin.insights.email.createdAt',
      labelFallback: 'Queued',
      showFrom: 'md',
      render: (row) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {adminDateTime(row.createdAt, locale)}
        </span>
      ),
      sortValue: (row) => row.createdAt,
    },
  ]

  return (
    <Card>
      <CardHeader className="text-start">
        <CardTitle>{t('admin.insights.email.title')}</CardTitle>
        <CardDescription>{t('admin.insights.email.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <Skeleton className="h-40 w-full rounded-xl" />}

        {isError && !isLoading && (
          <ErrorState message={t('admin.insights.loadError')} onRetry={() => void refetch()} />
        )}

        {!isLoading && !isError && data?.status === 'not_configured' && (
          <EmptyState
            title={t('admin.insights.notConfigured')}
            description={t('admin.insights.email.notConfiguredHint')}
          />
        )}

        {!isLoading && !isError && data?.status === 'ok' && data.byStatus && (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {STATUSES.map((status) => (
                <div key={status} className="rounded-xl border border-border p-3">
                  <dt className="text-xs text-muted-foreground">
                    {t(`admin.insights.email.status.${status}`)}
                  </dt>
                  <dd className="text-xl font-bold tabular-nums">
                    {adminNumber(data.byStatus?.[status] ?? 0, locale)}
                  </dd>
                </div>
              ))}
              <div className="rounded-xl border border-border p-3">
                <dt className="text-xs text-muted-foreground">
                  {t('admin.insights.email.sent24h')}
                </dt>
                <dd className="text-xl font-bold tabular-nums">
                  {data.sentLast24h === null
                    ? UNKNOWN_VALUE
                    : adminNumber(data.sentLast24h, locale)}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              {t('admin.insights.email.oldestPending', {
                time: data.oldestPendingAt
                  ? adminDateTime(data.oldestPendingAt, locale)
                  : UNKNOWN_VALUE,
              })}
            </p>
            <DataTable
              tableId="admin-email-failures"
              t={tableT}
              rows={data.recentFailures}
              columns={columns}
              rowKey={(row) => row.id}
              caption={t('admin.insights.email.failuresTitle')}
              emptyState={<EmptyState title={t('admin.insights.email.noFailures')} />}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
