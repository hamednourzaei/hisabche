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
import { useAdminCapabilitiesSnapshot, type AdminCapabilitiesSnapshot } from '@/hooks/use-admin-ops'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminNumber } from '@/lib/admin-format'

type CapRow = AdminCapabilitiesSnapshot['capabilities'][number]

export function AdminCapabilitiesPanel() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const [statusFilter, setStatusFilter] = useState('ALL')

  const { data, isLoading, isError, refetch } = useAdminCapabilitiesSnapshot()

  const filtered = (data?.capabilities ?? []).filter((c) =>
    statusFilter === 'ALL' ? true : c.status === statusFilter,
  )

  const columns: TableColumn<CapRow>[] = [
    {
      id: 'key',
      labelKey: 'admin.controlPlane.capabilities.capabilityKey',
      labelFallback: 'کلید قابلیت',
      locked: true,
      render: (c) => (
        <span dir="ltr" className="font-mono text-xs font-semibold text-foreground">
          {c.key}
        </span>
      ),
      sortValue: (c) => c.key,
    },
    {
      id: 'status',
      labelKey: 'admin.controlPlane.common.status',
      labelFallback: 'وضعیت',
      render: (c) => (
        <Badge
          variant={
            c.status === 'available' ? 'default' : c.status === 'partial' ? 'secondary' : 'outline'
          }
          className="text-xs"
        >
          {c.status}
        </Badge>
      ),
      sortValue: (c) => c.status,
    },
    {
      id: 'requires',
      labelKey: 'admin.controlPlane.capabilities.requires',
      labelFallback: 'وابستگی‌ها',
      showFrom: 'md',
      render: (c) => (
        <span dir="ltr" className="font-mono text-xs text-muted-foreground">
          {c.requires.length > 0 ? c.requires.join(', ') : '—'}
        </span>
      ),
      sortValue: (c) => c.requires.length,
    },
    {
      id: 'limitations',
      labelKey: 'admin.controlPlane.capabilities.limitations',
      labelFallback: 'محدودیت‌های ثبت‌شده',
      showFrom: 'lg',
      render: (c) => (
        <span className="text-xs text-muted-foreground">
          {c.limitations.length > 0 ? c.limitations.join(', ') : '—'}
        </span>
      ),
      sortValue: (c) => c.limitations.length,
    },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>{t('admin.controlPlane.capabilities.title')}</CardTitle>
          <CardDescription>{t('admin.controlPlane.capabilities.description')}</CardDescription>
        </div>
        <div className="w-44">
          <SelectField
            aria-label={t('admin.controlPlane.common.status')}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'ALL', label: t('admin.filters.all') },
              { value: 'available', label: 'available' },
              { value: 'partial', label: 'partial' },
              { value: 'planned', label: 'planned' },
            ]}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">
                {t('admin.controlPlane.capabilities.industriesCount')}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {adminNumber(data.industryCount, locale)}
              </p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">
                {t('admin.controlPlane.capabilities.enginesCount')}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {adminNumber(data.engineCount, locale)}
              </p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">
                {t('admin.controlPlane.capabilities.availableCount')}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {adminNumber(data.statusCounts.available, locale)}
              </p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">
                {t('admin.controlPlane.capabilities.partialCount')}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {adminNumber(data.statusCounts.partial, locale)}
              </p>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <Skeleton className="h-44 w-full rounded-xl" />
        ) : isError ? (
          <ErrorState
            message={t('admin.controlPlane.capabilities.loadError')}
            onRetry={() => void refetch()}
          />
        ) : (
          <DataTable
            tableId="admin-product-capabilities"
            t={tableT}
            rows={filtered}
            columns={columns}
            rowKey={(c) => c.key}
            caption={t('admin.controlPlane.capabilities.title')}
            minWidthClass="min-w-[760px]"
            emptyState={
              <EmptyState
                title={t('admin.controlPlane.capabilities.empty')}
                description={t('admin.controlPlane.capabilities.description')}
              />
            }
          />
        )}
      </CardContent>
    </Card>
  )
}
