'use client'

import { useState } from 'react'
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
  Input,
  Skeleton,
  useLocalePush,
  type TableColumn,
} from '@/components/ui'
import {
  useAdminOfflineDevices,
  useAdminOfflineFleetHealth,
  useAdminOfflineReviews,
  type OfflineDeviceRecord,
} from '@/hooks/use-admin-offline'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDateTime, adminNumber, UNKNOWN_VALUE } from '@/lib/admin-format'

export function AdminDevicesOpsPanel() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const push = useLocalePush()
  const tableT = useAdminTableT()
  const [workspaceFilter, setWorkspaceFilter] = useState('')
  const trimmedWs = workspaceFilter.trim()

  const { data, isLoading, isError, refetch } = useAdminOfflineDevices(trimmedWs || undefined)
  const { data: fleet } = useAdminOfflineFleetHealth()
  const { data: reviewsData } = useAdminOfflineReviews(trimmedWs || undefined)

  const devices = data?.devices ?? []
  const columns: TableColumn<OfflineDeviceRecord>[] = [
    {
      id: 'deviceId',
      labelKey: 'admin.controlPlane.devices.deviceId',
      labelFallback: 'شناسه دستگاه',
      locked: true,
      render: (d) => (
        <span dir="ltr" className="font-mono text-xs font-medium text-foreground">
          {d.device_id}
        </span>
      ),
      sortValue: (d) => d.device_id,
    },
    {
      id: 'workspaceId',
      labelKey: 'admin.controlPlane.common.workspace',
      labelFallback: 'کسب‌وکار',
      showFrom: 'md',
      render: (d) => (
        <span dir="ltr" className="font-mono text-xs text-muted-foreground">
          {d.workspace_id}
        </span>
      ),
      sortValue: (d) => d.workspace_id,
    },
    {
      id: 'seat',
      labelKey: 'admin.controlPlane.devices.seat',
      labelFallback: 'نوع دستگاه',
      render: (d) => (
        <Badge variant="outline" className="text-xs">
          {d.device_seat}
        </Badge>
      ),
      sortValue: (d) => d.device_seat,
    },
    {
      id: 'label',
      labelKey: 'admin.controlPlane.devices.label',
      labelFallback: 'برچسب',
      showFrom: 'md',
      render: (d) => <span className="text-xs text-foreground">{d.label ?? UNKNOWN_VALUE}</span>,
      sortValue: (d) => d.label ?? '',
    },
    {
      id: 'status',
      labelKey: 'admin.controlPlane.common.status',
      labelFallback: 'وضعیت',
      render: (d) => (
        <Badge variant={d.is_active ? 'default' : 'secondary'} className="text-xs">
          {d.is_active
            ? t('admin.controlPlane.common.active')
            : t('admin.controlPlane.common.inactive')}
        </Badge>
      ),
      sortValue: (d) => (d.is_active ? 1 : 0),
    },
    {
      id: 'lastSeen',
      labelKey: 'admin.controlPlane.devices.lastSeen',
      labelFallback: 'آخرین فعالیت',
      showFrom: 'lg',
      render: (d) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {d.last_seen_at ? adminDateTime(d.last_seen_at, locale) : UNKNOWN_VALUE}
        </span>
      ),
      sortValue: (d) => d.last_seen_at ?? '',
    },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t('admin.controlPlane.devices.title')}</CardTitle>
            <CardDescription>{t('admin.controlPlane.devices.description')}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => push('/offline?tab=devices')}>
            {t('admin.controlPlane.devices.openOfflineHub')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fleet?.health ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  {t('admin.controlPlane.devices.activeLicences')}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {adminNumber(Number(fleet.health.activeLicences ?? 0), locale)}
                </p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  {t('admin.controlPlane.devices.registeredSeats')}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {adminNumber(devices.length, locale)}
                </p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  {t('admin.controlPlane.devices.bannedLicences')}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {adminNumber(Number(fleet.health.bannedLicences ?? 0), locale)}
                </p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  {t('admin.controlPlane.devices.pendingReviews')}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {adminNumber(
                    (reviewsData?.reviews ?? []).filter((r) => r.status === 'pending').length,
                    locale,
                  )}
                </p>
              </div>
            </div>
          ) : null}

          <div className="max-w-sm">
            <Input
              dir="ltr"
              value={workspaceFilter}
              onChange={(e) => setWorkspaceFilter(e.target.value)}
              placeholder={t('admin.controlPlane.common.filterWorkspaceId')}
              aria-label={t('admin.controlPlane.common.filterWorkspaceId')}
            />
          </div>

          {isLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : isError ? (
            <ErrorState
              message={t('admin.controlPlane.devices.loadError')}
              onRetry={() => void refetch()}
            />
          ) : (
            <DataTable
              tableId="admin-customers-devices-ops"
              t={tableT}
              rows={devices}
              columns={columns}
              rowKey={(d) => d.id}
              caption={t('admin.controlPlane.devices.title')}
              minWidthClass="min-w-[760px]"
              emptyState={
                <EmptyState
                  title={t('admin.controlPlane.devices.empty')}
                  description={t('admin.controlPlane.devices.emptyHint')}
                />
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
