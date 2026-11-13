'use client'

// ============================================
// Security › events › failed sign-ins (V63 #49).
//
// Two views of the same window, one table: by address (one source guessing
// many passwords) and by account (many sources against one account). The
// account is a one-way fingerprint — the console never learns the address.
//
// What it does NOT cover is said on the screen: the admin console signs in
// straight through Supabase, so only the product's sign-in route is counted.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import {
  Badge,
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
import { useAdminFailedLogins, type FailedLoginBucketItem } from '@/hooks/use-admin-insights'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDateTime, adminNumber, UNKNOWN_VALUE } from '@/lib/admin-format'

const WINDOW_HOURS = 24
type View = 'ip' | 'account'

export function FailedLoginsPanel() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const [view, setView] = useState<View>('ip')
  const { data, isLoading, isError, refetch } = useAdminFailedLogins(WINDOW_HOURS)

  const rows = data?.summary ? (view === 'ip' ? data.summary.byIp : data.summary.byAccount) : []

  const columns: TableColumn<FailedLoginBucketItem>[] = [
    {
      id: 'source',
      labelKey:
        view === 'ip' ? 'admin.insights.failedLogins.ip' : 'admin.insights.failedLogins.account',
      labelFallback: view === 'ip' ? 'IP' : 'Account',
      locked: true,
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs text-foreground">
          {row.key}
        </span>
      ),
      sortValue: (row) => row.key,
    },
    {
      id: 'attempts',
      labelKey: 'admin.insights.failedLogins.attempts',
      labelFallback: 'Attempts',
      render: (row) => <span className="tabular-nums">{adminNumber(row.attempts, locale)}</span>,
      sortValue: (row) => row.attempts,
    },
    {
      id: 'spread',
      labelKey:
        view === 'ip'
          ? 'admin.insights.failedLogins.accountsTried'
          : 'admin.insights.failedLogins.addressesUsed',
      labelFallback: 'Spread',
      showFrom: 'md',
      render: (row) => <span className="tabular-nums">{adminNumber(row.spread, locale)}</span>,
      sortValue: (row) => row.spread,
    },
    {
      id: 'last',
      labelKey: 'admin.insights.failedLogins.lastAttempt',
      labelFallback: 'Last attempt',
      showFrom: 'md',
      render: (row) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {adminDateTime(row.lastAt, locale)}
        </span>
      ),
      sortValue: (row) => row.lastAt,
    },
    {
      id: 'flag',
      labelKey: 'admin.insights.failedLogins.flag',
      labelFallback: 'Flag',
      align: 'end',
      render: (row) =>
        row.flagged ? (
          <Badge variant="destructive" className="text-xs">
            {t('admin.insights.failedLogins.flagged')}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">{UNKNOWN_VALUE}</span>
        ),
      sortValue: (row) => (row.flagged ? 1 : 0),
    },
  ]

  return (
    <Card>
      <CardHeader className="text-start">
        <CardTitle>{t('admin.insights.failedLogins.title')}</CardTitle>
        <CardDescription>
          {t('admin.insights.failedLogins.description', { hours: WINDOW_HOURS })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <Skeleton className="h-40 w-full rounded-xl" />}

        {isError && !isLoading && (
          <ErrorState message={t('admin.insights.loadError')} onRetry={() => void refetch()} />
        )}

        {!isLoading && !isError && data?.status === 'not_configured' && (
          <EmptyState
            title={t('admin.insights.notConfigured')}
            description={t('admin.insights.failedLogins.notConfiguredHint')}
          />
        )}

        {!isLoading && !isError && data?.status === 'ok' && data.summary && (
          <>
            <p className="text-sm text-muted-foreground">
              {t('admin.insights.failedLogins.summary', {
                total: adminNumber(data.total ?? data.summary.total, locale),
                ips: adminNumber(data.summary.flaggedIps, locale),
                accounts: adminNumber(data.summary.flaggedAccounts, locale),
              })}
            </p>
            {data.truncated && (
              <p className="text-sm text-warning">{t('admin.insights.truncated')}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {t('admin.insights.failedLogins.scope')}
            </p>
            <DataTable
              tableId="admin-failed-logins"
              t={tableT}
              rows={rows}
              columns={columns}
              rowKey={(row) => row.key}
              caption={t('admin.insights.failedLogins.title')}
              actions={
                <TableFilterSelect
                  label={t('admin.insights.failedLogins.groupBy')}
                  value={view}
                  allValue="ip"
                  onChange={(value) => setView(value === 'account' ? 'account' : 'ip')}
                  options={[
                    { value: 'ip', label: t('admin.insights.failedLogins.byIp') },
                    { value: 'account', label: t('admin.insights.failedLogins.byAccount') },
                  ]}
                />
              }
              emptyState={
                <EmptyState
                  title={t('admin.insights.failedLogins.none')}
                  description={t('admin.insights.failedLogins.noneHint', { hours: WINDOW_HOURS })}
                />
              }
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
