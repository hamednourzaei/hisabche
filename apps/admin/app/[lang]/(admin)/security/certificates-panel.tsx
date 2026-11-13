'use client'

// ============================================
// Security › posture › TLS certificates (V63 #58).
//
// The hosts are the app's own production origins (the CORS list) plus any the
// owner adds in `TLS_MONITORED_HOSTS`. Each is opened once an hour on the
// server; «re-check» forces a new handshake. A host that could not be reached
// is «unreachable» — never «ok», never a guessed date.
// ============================================

import { useTranslations } from 'next-intl'

import {
  Badge,
  Button,
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
import {
  useAdminCertificates,
  useRecheckCertificates,
  type CertificateReportItem,
} from '@/hooks/use-admin-insights'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDate, adminDateTime, adminNumber, UNKNOWN_VALUE } from '@/lib/admin-format'

type HostRow = CertificateReportItem['hosts'][number]

export function CertificatesPanel() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const { data, isLoading, isError, refetch } = useAdminCertificates()
  const { mutate: recheck, isPending } = useRecheckCertificates()

  const columns: TableColumn<HostRow>[] = [
    {
      id: 'host',
      labelKey: 'admin.insights.certificates.host',
      labelFallback: 'Host',
      locked: true,
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs text-foreground">
          {row.host}
        </span>
      ),
      sortValue: (row) => row.host,
    },
    {
      id: 'state',
      labelKey: 'admin.insights.certificates.state',
      labelFallback: 'State',
      render: (row) => (
        <Badge
          variant={
            row.state === 'ok' ? 'default' : row.state === 'warning' ? 'outline' : 'destructive'
          }
          className="text-xs"
        >
          {t(`admin.insights.certificates.states.${row.state}`)}
        </Badge>
      ),
      sortValue: (row) => row.daysLeft ?? -1,
    },
    {
      id: 'daysLeft',
      labelKey: 'admin.insights.certificates.daysLeft',
      labelFallback: 'Days left',
      render: (row) => (
        <span className="tabular-nums">
          {row.daysLeft === null ? UNKNOWN_VALUE : adminNumber(row.daysLeft, locale)}
        </span>
      ),
      sortValue: (row) => row.daysLeft,
    },
    {
      id: 'validTo',
      labelKey: 'admin.insights.certificates.validTo',
      labelFallback: 'Valid to',
      showFrom: 'md',
      render: (row) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {row.validTo ? adminDate(row.validTo, locale) : UNKNOWN_VALUE}
        </span>
      ),
      sortValue: (row) => row.validTo,
    },
    {
      id: 'issuer',
      labelKey: 'admin.insights.certificates.issuer',
      labelFallback: 'Issuer',
      showFrom: 'lg',
      render: (row) => (
        <span dir="ltr" className="text-xs text-muted-foreground">
          {row.issuer ?? row.error ?? UNKNOWN_VALUE}
        </span>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader className="text-start">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t('admin.insights.certificates.title')}</CardTitle>
            <CardDescription>{t('admin.insights.certificates.description')}</CardDescription>
          </div>
          <Button variant="outline" size="sm" disabled={isPending} onClick={() => recheck()}>
            {t('admin.insights.certificates.recheck')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Skeleton className="h-32 w-full rounded-xl" />}

        {isError && !isLoading && (
          <ErrorState message={t('admin.insights.loadError')} onRetry={() => void refetch()} />
        )}

        {!isLoading && !isError && data && (
          <>
            <p className="text-xs text-muted-foreground">
              {t('admin.insights.checkedAt', { time: adminDateTime(data.checkedAt, locale) })}
            </p>
            <DataTable
              tableId="admin-certificates"
              t={tableT}
              rows={data.hosts}
              columns={columns}
              rowKey={(row) => row.host}
              caption={t('admin.insights.certificates.title')}
              emptyState={
                <EmptyState
                  title={t('admin.insights.notConfigured')}
                  description={t('admin.insights.certificates.notConfiguredHint')}
                />
              }
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
