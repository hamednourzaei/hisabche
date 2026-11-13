'use client'

// ============================================
// Product › developers › API usage (V63 #113).
//
// Public-API requests from `api_request_logs` (written per request by the
// developer platform), grouped by key or by route. The count is exact; the
// grouping reads at most the newest 10 000 requests in the window and the
// screen says when that ceiling cut it.
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
import { useAdminApiUsage, type ApiUsageBucketItem } from '@/hooks/use-admin-insights'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminNumber, UNKNOWN_VALUE } from '@/lib/admin-format'

type Row = ApiUsageBucketItem & { workspaceId?: string | undefined; label: string }

export function ApiUsagePanel() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const [days, setDays] = useState<string>('7')
  const [view, setView] = useState<string>('key')
  const { data, isLoading, isError, refetch } = useAdminApiUsage(Number(days))

  const summary = data?.summary ?? null
  const rows: Row[] = !summary
    ? []
    : view === 'route'
      ? summary.byRoute.map((row) => ({ ...row, label: row.key }))
      : summary.byKey.map((row) => {
          const named = data?.keyNames[row.key]
          return { ...row, label: named ? `${named.name} (${named.prefix}…)` : row.key }
        })

  const columns: TableColumn<Row>[] = [
    {
      id: 'label',
      labelKey: view === 'route' ? 'admin.insights.api.route' : 'admin.insights.api.key',
      labelFallback: view === 'route' ? 'Route' : 'Key',
      locked: true,
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs text-foreground">
          {row.label}
        </span>
      ),
      sortValue: (row) => row.label,
    },
    {
      id: 'requests',
      labelKey: 'admin.insights.api.requests',
      labelFallback: 'Requests',
      render: (row) => <span className="tabular-nums">{adminNumber(row.requests, locale)}</span>,
      sortValue: (row) => row.requests,
    },
    {
      id: 'clientErrors',
      labelKey: 'admin.insights.api.clientErrors',
      labelFallback: '4xx',
      showFrom: 'md',
      render: (row) => (
        <span className="tabular-nums">{adminNumber(row.clientErrors, locale)}</span>
      ),
      sortValue: (row) => row.clientErrors,
    },
    {
      id: 'serverErrors',
      labelKey: 'admin.insights.api.serverErrors',
      labelFallback: '5xx',
      showFrom: 'md',
      render: (row) => (
        <span className="tabular-nums">{adminNumber(row.serverErrors, locale)}</span>
      ),
      sortValue: (row) => row.serverErrors,
    },
    {
      id: 'p95',
      labelKey: 'admin.insights.api.p95',
      labelFallback: 'p95',
      showFrom: 'lg',
      render: (row) => (
        <span className="tabular-nums">
          {t('admin.insights.api.ms', { value: adminNumber(row.p95Ms, locale) })}
        </span>
      ),
      sortValue: (row) => row.p95Ms,
    },
    {
      id: 'workspace',
      labelKey: 'admin.insights.api.workspace',
      labelFallback: 'Business',
      showFrom: 'lg',
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs text-muted-foreground">
          {row.workspaceId ? `${row.workspaceId.slice(0, 8)}…` : UNKNOWN_VALUE}
        </span>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader className="text-start">
        <CardTitle>{t('admin.insights.api.title')}</CardTitle>
        <CardDescription>{t('admin.insights.api.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <Skeleton className="h-40 w-full rounded-xl" />}

        {isError && !isLoading && (
          <ErrorState message={t('admin.insights.loadError')} onRetry={() => void refetch()} />
        )}

        {!isLoading && !isError && data?.status === 'not_configured' && (
          <EmptyState
            title={t('admin.insights.notConfigured')}
            description={t('admin.insights.api.notConfiguredHint')}
          />
        )}

        {!isLoading && !isError && data?.status === 'ok' && (
          <>
            <p className="text-sm text-muted-foreground">
              {t('admin.insights.api.summary', {
                total: adminNumber(data.total ?? 0, locale),
                days: data.windowDays,
              })}
            </p>
            {data.truncated && (
              <p className="text-sm text-warning">{t('admin.insights.truncated')}</p>
            )}
            <DataTable
              tableId="admin-api-usage"
              t={tableT}
              rows={rows}
              columns={columns}
              rowKey={(row) => row.key}
              caption={t('admin.insights.api.title')}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <TableFilterSelect
                    label={t('admin.insights.api.groupBy')}
                    value={view}
                    allValue="key"
                    onChange={setView}
                    options={[
                      { value: 'key', label: t('admin.insights.api.byKey') },
                      { value: 'route', label: t('admin.insights.api.byRoute') },
                    ]}
                  />
                  <TableFilterSelect
                    label={t('admin.insights.window')}
                    value={days}
                    allValue="7"
                    onChange={setDays}
                    options={['1', '7', '30'].map((value) => ({
                      value,
                      label: t('admin.insights.days', { days: Number(value) }),
                    }))}
                  />
                </div>
              }
              emptyState={
                <EmptyState
                  title={t('admin.insights.api.none')}
                  description={t('admin.insights.api.noneHint')}
                />
              }
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
