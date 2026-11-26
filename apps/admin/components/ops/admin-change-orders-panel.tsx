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
  Skeleton,
  type TableColumn,
} from '@/components/ui'
import {
  useAdminChangeOrders,
  useDecideAdminChangeOrder,
  type AdminChangeOrderItem,
} from '@/hooks/use-admin-ops'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDateTime, adminNumber, UNKNOWN_VALUE } from '@/lib/admin-format'

export function AdminChangeOrdersPanel() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const [target, setTarget] = useState<{
    order: AdminChangeOrderItem
    decision: 'approved' | 'rejected'
  } | null>(null)

  const { data, isLoading, isError, refetch } = useAdminChangeOrders()
  const { mutateAsync: decideOrder } = useDecideAdminChangeOrder()

  const orders = data?.orders ?? []
  const columns: TableColumn<AdminChangeOrderItem>[] = [
    {
      id: 'title',
      labelKey: 'admin.controlPlane.changeOrders.orderTitle',
      labelFallback: 'عنوان تغییر',
      locked: true,
      render: (o) => (
        <div className="min-w-0">
          <div className="text-xs font-semibold text-foreground">{o.title}</div>
          <div className="text-xs text-muted-foreground">
            {o.project_name ?? o.project_id.slice(0, 8)} ·{' '}
            {o.workspace_name ?? o.workspace_id.slice(0, 8)}
          </div>
        </div>
      ),
      sortValue: (o) => o.created_at,
    },
    {
      id: 'delta',
      labelKey: 'admin.controlPlane.changeOrders.deltaBudget',
      labelFallback: 'تغییر بودجه',
      render: (o) => (
        <span dir="ltr" className="font-mono text-xs tabular-nums">
          {o.delta_budget > 0
            ? `+${adminNumber(o.delta_budget, locale)}`
            : adminNumber(o.delta_budget, locale)}{' '}
          {o.project_currency ?? ''}
        </span>
      ),
      sortValue: (o) => o.delta_budget,
    },
    {
      id: 'status',
      labelKey: 'admin.controlPlane.common.status',
      labelFallback: 'وضعیت',
      render: (o) => (
        <Badge
          variant={
            o.status === 'approved'
              ? 'default'
              : o.status === 'rejected'
                ? 'destructive'
                : 'secondary'
          }
          className="text-xs"
        >
          {o.status}
        </Badge>
      ),
      sortValue: (o) => o.status,
    },
    {
      id: 'createdAt',
      labelKey: 'admin.controlPlane.changeOrders.createdAt',
      labelFallback: 'زمان ثبت',
      showFrom: 'md',
      render: (o) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {adminDateTime(o.created_at, locale)}
        </span>
      ),
      sortValue: (o) => o.created_at,
    },
    {
      id: 'actions',
      labelKey: 'admin.controlPlane.common.actions',
      labelFallback: 'اقدامات',
      align: 'end',
      locked: true,
      render: (o) =>
        o.status === 'pending_approval' ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              className="min-h-[36px] text-xs"
              onClick={() => setTarget({ order: o, decision: 'approved' })}
            >
              {t('admin.revenue.approve')}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="min-h-[36px] text-xs"
              onClick={() => setTarget({ order: o, decision: 'rejected' })}
            >
              {t('admin.revenue.reject')}
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{UNKNOWN_VALUE}</span>
        ),
    },
  ]

  const handleConfirm = async ({
    stepUpTimestamp,
    reason,
  }: {
    stepUpTimestamp: string
    reason?: string
  }) => {
    if (!target) return
    await decideOrder({
      orderId: target.order.id,
      decision: target.decision,
      ...(reason ? { reason } : {}),
      expectedVersion: target.order.project_version,
      stepUpTimestamp,
    })
    setTarget(null)
    void refetch()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.controlPlane.changeOrders.title')}</CardTitle>
        <CardDescription>{t('admin.controlPlane.changeOrders.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-44 w-full rounded-xl" />
        ) : isError ? (
          <ErrorState
            message={t('admin.controlPlane.changeOrders.loadError')}
            onRetry={() => void refetch()}
          />
        ) : (
          <DataTable
            tableId="admin-ops-change-orders"
            t={tableT}
            rows={orders}
            columns={columns}
            rowKey={(o) => o.id}
            caption={t('admin.controlPlane.changeOrders.title')}
            minWidthClass="min-w-[780px]"
            emptyState={
              <EmptyState
                title={t('admin.controlPlane.changeOrders.empty')}
                description={t('admin.controlPlane.changeOrders.emptyHint')}
              />
            }
          />
        )}
      </CardContent>

      <StepUpDialog
        open={Boolean(target)}
        onOpenChange={(open) => !open && setTarget(null)}
        title={t('admin.controlPlane.changeOrders.confirmTitle')}
        description={t('admin.controlPlane.changeOrders.confirmDesc', {
          title: target?.order.title ?? '',
          decision: target?.decision ?? '',
        })}
        destructive={target?.decision === 'rejected'}
        requireReason={target?.decision === 'rejected'}
        reasonLabel={t('admin.revenue.rejectionReasonLabel')}
        onConfirm={handleConfirm}
      />
    </Card>
  )
}
