'use client'

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
  SelectField,
  Skeleton,
  type TableColumn,
} from '@/components/ui'
import { useAdminGatewayEvents, type AdminGatewayEventItem } from '@/hooks/use-admin-ops'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDateTime, adminNumber, UNKNOWN_VALUE } from '@/lib/admin-format'

export function AdminGatewayEventsPanel() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const [statusFilter, setStatusFilter] = useState('ALL')

  const { data, isLoading, isError, refetch } = useAdminGatewayEvents(
    statusFilter === 'ALL' ? {} : { status: statusFilter },
  )

  const events = data?.events ?? []
  const columns: TableColumn<AdminGatewayEventItem>[] = [
    {
      id: 'provider',
      labelKey: 'admin.controlPlane.gatewayEvents.provider',
      labelFallback: 'درگاه / شناسه رخداد',
      locked: true,
      render: (ev) => (
        <div className="min-w-0">
          <div className="text-xs font-semibold text-foreground">{ev.provider}</div>
          <div dir="ltr" className="font-mono text-xs text-muted-foreground">
            {ev.event_id ?? ev.id.slice(0, 12)}
          </div>
        </div>
      ),
      sortValue: (ev) => ev.created_at,
    },
    {
      id: 'signature',
      labelKey: 'admin.controlPlane.gatewayEvents.signature',
      labelFallback: 'اعتبار امضا',
      render: (ev) => (
        <Badge variant={ev.signature_valid ? 'default' : 'destructive'} className="text-xs">
          {ev.signature_valid
            ? t('admin.controlPlane.gatewayEvents.validSig')
            : t('admin.controlPlane.gatewayEvents.invalidSig')}
        </Badge>
      ),
      sortValue: (ev) => (ev.signature_valid ? 1 : 0),
    },
    {
      id: 'status',
      labelKey: 'admin.controlPlane.common.status',
      labelFallback: 'وضعیت',
      render: (ev) => (
        <Badge variant="outline" className="text-xs">
          {ev.processing_status}
        </Badge>
      ),
      sortValue: (ev) => ev.processing_status,
    },
    {
      id: 'amount',
      labelKey: 'admin.controlPlane.gatewayEvents.amountCurrency',
      labelFallback: 'مبلغ / واحد',
      showFrom: 'md',
      render: (ev) => (
        <span dir="ltr" className="font-mono text-xs tabular-nums">
          {ev.amount_minor !== null
            ? `${adminNumber(ev.amount_minor, locale)} ${ev.currency ?? ''}`
            : UNKNOWN_VALUE}
        </span>
      ),
      sortValue: (ev) => ev.amount_minor ?? 0,
    },
    {
      id: 'attempts',
      labelKey: 'admin.controlPlane.gatewayEvents.attempts',
      labelFallback: 'تلاش‌ها',
      showFrom: 'lg',
      render: (ev) => (
        <span className="text-xs tabular-nums">{adminNumber(ev.delivery_attempts, locale)}</span>
      ),
      sortValue: (ev) => ev.delivery_attempts,
    },
    {
      id: 'when',
      labelKey: 'admin.controlPlane.gatewayEvents.receivedAt',
      labelFallback: 'زمان دریافت',
      showFrom: 'lg',
      render: (ev) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {adminDateTime(ev.created_at, locale)}
        </span>
      ),
      sortValue: (ev) => ev.created_at,
    },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>{t('admin.controlPlane.gatewayEvents.title')}</CardTitle>
          <CardDescription>{t('admin.controlPlane.gatewayEvents.description')}</CardDescription>
        </div>
        <div className="w-44">
          <SelectField
            aria-label={t('admin.controlPlane.common.status')}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'ALL', label: t('admin.filters.all') },
              { value: 'processed', label: 'processed' },
              { value: 'rejected_signature', label: 'rejected_signature' },
              { value: 'failed', label: 'failed' },
            ]}
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-44 w-full rounded-xl" />
        ) : isError ? (
          <ErrorState
            message={t('admin.controlPlane.gatewayEvents.loadError')}
            onRetry={() => void refetch()}
          />
        ) : (
          <DataTable
            tableId="admin-gateway-webhook-events"
            t={tableT}
            rows={events}
            columns={columns}
            rowKey={(e) => e.id}
            caption={t('admin.controlPlane.gatewayEvents.title')}
            minWidthClass="min-w-[780px]"
            emptyState={
              <EmptyState
                title={t('admin.controlPlane.gatewayEvents.empty')}
                description={t('admin.controlPlane.gatewayEvents.emptyHint')}
              />
            }
          />
        )}
      </CardContent>
    </Card>
  )
}
